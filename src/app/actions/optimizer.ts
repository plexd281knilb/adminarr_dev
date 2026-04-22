"use server"

import fs from 'fs';
import { statfs } from 'fs/promises';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getOptimizerSettings() {
    return await prisma.settings.findFirst({ where: { id: "global" } });
}

export async function saveOptimizerSettings(data: any) {
    await prisma.settings.update({
        where: { id: "global" },
        data: {
            plexDbMain: data.plexDbMain,
            plexDbKids: data.plexDbKids,
            plexDbBackup: data.plexDbBackup,
            tdarrUrl: data.tdarrUrl,
            optimizerSchedule: data.optimizerSchedule,
            warningThreshold: data.warningThreshold ? parseInt(data.warningThreshold, 10) : 70,
            deletionThreshold: data.deletionThreshold ? parseInt(data.deletionThreshold, 10) : 75,
            purgeAmount: data.purgeAmount ? parseInt(data.purgeAmount, 10) : 5
        }
    });
    revalidatePath("/optimizer");
}

export async function getDiskUsage() {
  const settings = await prisma.settings.findFirst({ where: { id: "global" } });
  const mountPath = "/mnt/user"; 
  try {
    const stats = await statfs(mountPath);
    return Math.round(((stats.blocks - stats.bfree) / stats.blocks) * 100);
  } catch { return 0; }
}

// ----------------------------------------------------------------------
// JAVASCRIPT TRANSLATOR: Offloads the heavy string replacements from SQLite to V8
// ----------------------------------------------------------------------
function translatePath(filePath: string, libraryName: string): string {
    if (filePath.includes('/Kid_TV/')) return filePath.replace('/Kid_TV/', '/mnt/user/Kid_TV_Shows/');
    if (filePath.includes('/Kid_tvshows/')) return filePath.replace('/Kid_tvshows/', '/mnt/user/Kid_TV_Shows/');
    if (filePath.includes('/4k_tv_shows/')) return filePath.replace('/4k_tv_shows/', '/mnt/user/4k_TV_Shows/');
    if (filePath.includes('/tvshows/')) return filePath.replace('/tvshows/', '/mnt/user/Kid_TV_Shows/');
    if (filePath.includes('/tv_shows/')) return filePath.replace('/tv_shows/', '/mnt/user/TV_Shows/');
    if (filePath.includes('/tv/')) return filePath.replace('/tv/', '/mnt/user/TV_Shows/');
    if (filePath.includes('/4k_Movies/')) return filePath.replace('/4k_Movies/', '/mnt/user/4k_Movies/');
    if (filePath.includes('/4k_movies/')) return filePath.replace('/4k_movies/', '/mnt/user/4k_Movies/');
    if (filePath.includes('/Kid_Movies/')) return filePath.replace('/Kid_Movies/', '/mnt/user/Kid_Movies/');
    if (filePath.includes('/Kid_movies/')) return filePath.replace('/Kid_movies/', '/mnt/user/Kid_Movies/');
    if (filePath.includes('/movies/') && libraryName === 'Kids Movies') return filePath.replace('/movies/', '/mnt/user/Kid_Movies/');
    if (filePath.includes('/movies/')) return filePath.replace('/movies/', '/mnt/user/Movies/');
    return filePath;
}

// Helper to scan a single SQLite database without crashing it
function scanSingleDatabase(dbPath: string): any[] {
    let db: Database.Database | null = null;
    try {
        db = new Database(dbPath, { readonly: true });
        
        const stmt = db.prepare(`
            SELECT 
                CASE WHEN mi.guid LIKE '%local%' THEN hints ELSE mi.guid END AS guid,
                CASE WHEN datetime(mi.created_at, 'unixepoch', 'localtime') > miv.viewed_at 
                     THEN datetime(mi.created_at, 'unixepoch', 'localtime') 
                     ELSE IFNULL(miv.viewed_at, datetime(mi.created_at, 'unixepoch', 'localtime')) 
                END AS active_dt,
                mp.file AS raw_file_path,
                ls.name AS library_name,
                mitem.video_codec
            FROM metadata_items AS mi
            JOIN library_sections AS ls ON mi.library_section_id = ls.id
            JOIN media_items AS mitem ON mitem.metadata_item_id = mi.id
            JOIN media_parts AS mp ON mp.media_item_id = mitem.id
            LEFT JOIN (SELECT MAX(datetime(viewed_at, 'unixepoch', 'localtime')) AS viewed_at, guid FROM metadata_item_views GROUP BY guid) miv ON miv.guid = mi.guid
            WHERE ls.name IN ('Movies','TV Shows', 'Kids Movies', 'Kids TV Shows')
        `);
        return stmt.all();
    } catch (e) {
        console.error(`Failed to scan DB: ${dbPath}`, e);
        return [];
    } finally {
        if (db) db.close();
    }
}

export async function getOldestMedia() {
  const settings = await prisma.settings.findFirst({ where: { id: "global" } });
  if (!settings?.plexDbMain) return [];

  const runId = crypto.randomUUID();
  const DB_MAIN_TMP = `/tmp/main_plex_${runId}.db`;
  const DB_KIDS_TMP = `/tmp/kids_plex_${runId}.db`;
  const DB_BACKUP_TMP = `/tmp/backup_plex_${runId}.db`;
  
  let allRawRows: any[] = [];

  try {
    if (fs.existsSync(settings.plexDbMain)) {
        fs.copyFileSync(settings.plexDbMain, DB_MAIN_TMP);
        allRawRows = allRawRows.concat(scanSingleDatabase(DB_MAIN_TMP));
    }
    if (settings.plexDbKids && fs.existsSync(settings.plexDbKids)) {
        fs.copyFileSync(settings.plexDbKids, DB_KIDS_TMP);
        allRawRows = allRawRows.concat(scanSingleDatabase(DB_KIDS_TMP));
    }
    if (settings.plexDbBackup && fs.existsSync(settings.plexDbBackup)) {
        fs.copyFileSync(settings.plexDbBackup, DB_BACKUP_TMP);
        allRawRows = allRawRows.concat(scanSingleDatabase(DB_BACKUP_TMP));
    }

    const globalGuidActivity = new Map<string, string>(); 
    const validMediaItems: any[] = [];

    for (const row of allRawRows) {
        const finalPath = translatePath(row.raw_file_path, row.library_name);
        
        if (!finalPath.startsWith('/mnt/user/') || finalPath.includes('placeholders')) continue;

        validMediaItems.push({
            guid: row.guid,
            file_path: finalPath,
            video_codec: row.video_codec,
            active_dt: row.active_dt
        });

        const currentMax = globalGuidActivity.get(row.guid);
        if (!currentMax || row.active_dt > currentMax) {
            globalGuidActivity.set(row.guid, row.active_dt);
        }
    }

    const uniquePaths = new Set<string>();
    const finalResults = [];

    for (const item of validMediaItems) {
        if (!uniquePaths.has(item.file_path)) {
            uniquePaths.add(item.file_path);
            finalResults.push({
                // CRITICAL FIX: Add a fallback empty string to satisfy TypeScript's strict type checking
                latest_activity: globalGuidActivity.get(item.guid) || "", 
                file_path: item.file_path,
                guid: item.guid,
                video_codec: item.video_codec
            });
        }
    }

    finalResults.sort((a, b) => (a.latest_activity < b.latest_activity ? -1 : 1));
    return finalResults.slice(0, 50);

  } finally {
    [DB_MAIN_TMP, DB_KIDS_TMP, DB_BACKUP_TMP].forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
  }
}

export async function bulkQueueInTdarr(filePaths: string[]) {
  const settings = await prisma.settings.findFirst({ where: { id: "global" } });
  let successCount = 0;
  for (const path of filePaths) {
    try {
      const res = await fetch(`${settings?.tdarrUrl}/api/v2/cruddb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { collection: "FileJSONDB", mode: "update", docID: path, obj: { Statc: "Queued" } } })
      });
      if (res.ok) successCount++;
    } catch (e) { console.error(e); }
  }
  return successCount;
}

export async function bulkDeleteMedia(filePaths: string[]) {
  let deletedCount = 0;
  for (const path of filePaths) {
    try {
      if (fs.existsSync(path)) {
        fs.unlinkSync(path);
        deletedCount++;
      }
    } catch (e) { console.error(e); }
  }
  return deletedCount;
}

export async function autoPurgeMedia() {
    const usage = await getDiskUsage();
    const settings = await getOptimizerSettings();
    const delThreshold = settings?.deletionThreshold || 75;
    const purgeAmt = settings?.purgeAmount || 5;

    if (usage >= delThreshold) {
        console.log(`[Optimizer] CRITICAL: Disk usage at ${usage}%. Threshold is ${delThreshold}%. Initiating purge...`);
        const oldest = await getOldestMedia();
        
        if (oldest.length > 0) {
            const toDelete = oldest.slice(0, purgeAmt).map(m => m.file_path);
            const deletedCount = await bulkDeleteMedia(toDelete);
            console.log(`[Optimizer] Purged ${deletedCount} old media files to restore space.`);
            return true;
        }
    }
    return false;
}