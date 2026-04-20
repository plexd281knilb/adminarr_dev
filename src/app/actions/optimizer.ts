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
            // NEW: Parse the purge amount
            purgeAmount: data.purgeAmount ? parseInt(data.purgeAmount, 10) : 5
        }
    });
    revalidatePath("/optimizer");
}

export async function getDiskUsage() {
  const settings = await prisma.settings.findFirst({ where: { id: "global" } });
  const mountPath = "/mnt/user"; // Hardcoded for Unraid standard
  try {
    const stats = await statfs(mountPath);
    return Math.round(((stats.blocks - stats.bfree) / stats.blocks) * 100);
  } catch { return 0; }
}

export async function getOldestMedia() {
  const settings = await prisma.settings.findFirst({ where: { id: "global" } });
  if (!settings?.plexDbMain) return [];

  const runId = crypto.randomUUID();
  const DB_MAIN_TMP = `/tmp/main_plex_${runId}.db`;
  const DB_KIDS_TMP = `/tmp/kids_plex_${runId}.db`;
  const DB_BACKUP_TMP = `/tmp/backup_plex_${runId}.db`;
  
  let db: Database.Database | null = null;

  try {
    // Copy snapshots from the paths saved in the DB
    if (fs.existsSync(settings.plexDbMain)) fs.copyFileSync(settings.plexDbMain, DB_MAIN_TMP);
    if (settings.plexDbKids && fs.existsSync(settings.plexDbKids)) fs.copyFileSync(settings.plexDbKids, DB_KIDS_TMP);
    if (settings.plexDbBackup && fs.existsSync(settings.plexDbBackup)) fs.copyFileSync(settings.plexDbBackup, DB_BACKUP_TMP);

    db = new Database(DB_MAIN_TMP, { readonly: true });
    if (fs.existsSync(DB_KIDS_TMP)) db.exec(`ATTACH DATABASE '${DB_KIDS_TMP}' AS kids;`);
    if (fs.existsSync(DB_BACKUP_TMP)) db.exec(`ATTACH DATABASE '${DB_BACKUP_TMP}' AS backup;`);

    // Added mitem.video_codec to the SELECT statement
    const stmt = db.prepare(`
      WITH AllMedia AS (
          SELECT mi.guid, IFNULL(miv.viewed_at, datetime(mi.created_at, 'unixepoch')) as active_dt, mp.file as file_path, mitem.video_codec
          FROM metadata_items AS mi
          JOIN library_sections AS ls ON mi.library_section_id = ls.id
          JOIN media_items AS mitem ON mitem.metadata_item_id = mi.id
          JOIN media_parts AS mp ON mp.media_item_id = mitem.id
          LEFT JOIN (SELECT MAX(datetime(viewed_at, 'unixepoch')) AS viewed_at, guid FROM metadata_item_views GROUP BY guid) miv ON miv.guid = mi.guid
          WHERE ls.name IN ('Movies','TV Shows', 'Kids Movies', 'Kids TV Shows')
      )
      SELECT DISTINCT active_dt as latest_activity, file_path, guid, video_codec
      FROM AllMedia
      WHERE file_path LIKE '/mnt/user/%' 
      ORDER BY latest_activity ASC LIMIT 50;
    `);

    return stmt.all() as any[];
  } catch (error) {
    console.error(error);
    return [];
  } finally {
    if (db) db.close();
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
    const purgeAmt = settings?.purgeAmount || 5; // NEW: Dynamically pull the amount

    if (usage >= delThreshold) {
        console.log(`[Optimizer] CRITICAL: Disk usage at ${usage}%. Threshold is ${delThreshold}%. Initiating purge...`);
        const oldest = await getOldestMedia();
        
        if (oldest.length > 0) {
            // NEW: Slice based on the user's configured amount instead of hardcoded 5
            const toDelete = oldest.slice(0, purgeAmt).map(m => m.file_path);
            const deletedCount = await bulkDeleteMedia(toDelete);
            console.log(`[Optimizer] Purged ${deletedCount} old media files to restore space.`);
            return true;
        }
    }
    return false;
}