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
  const mountPath = "/mnt/user"; // Hardcoded for Unraid standard
  try {
    const stats = await statfs(mountPath);
    return Math.round(((stats.blocks - stats.bfree) / stats.blocks) * 100);
  } catch { return 0; }
}

// Helper to generate the massive path-replacement SQL block
const getSelectBlock = (dbPrefix = "") => `
  SELECT 
      CASE WHEN mi.guid LIKE '%local%' THEN hints ELSE mi.guid END AS guid,
      CASE WHEN datetime(mi.created_at, 'unixepoch', 'localtime') > miv.viewed_at 
           THEN datetime(mi.created_at, 'unixepoch', 'localtime') 
           ELSE IFNULL(miv.viewed_at, datetime(mi.created_at, 'unixepoch', 'localtime')) 
      END AS active_dt,
      CASE 
          WHEN mp.file LIKE '%/Kid_TV/%'      THEN replace(mp.file,'/Kid_TV/','/mnt/user/Kid_TV_Shows/')
          WHEN mp.file LIKE '%/Kid_tvshows/%' THEN replace(mp.file,'/Kid_tvshows/','/mnt/user/Kid_TV_Shows/')
          WHEN mp.file LIKE '%/4k_tv_shows/%' THEN replace(mp.file,'/4k_tv_shows/','/mnt/user/4k_TV_Shows/')
          WHEN mp.file LIKE '%/tvshows/%'     THEN replace(mp.file,'/tvshows/','/mnt/user/Kid_TV_Shows/')
          WHEN mp.file LIKE '%/tv_shows/%'    THEN replace(mp.file,'/tv_shows/','/mnt/user/TV_Shows/')
          WHEN mp.file LIKE '%/tv/%'          THEN replace(mp.file,'/tv/','/mnt/user/TV_Shows/')
          WHEN mp.file LIKE '%/4k_Movies/%'   THEN replace(mp.file,'/4k_Movies/','/mnt/user/4k_Movies/')
          WHEN mp.file LIKE '%/4k_movies/%'   THEN replace(mp.file,'/4k_movies/','/mnt/user/4k_Movies/')
          WHEN mp.file LIKE '%/Kid_Movies/%'  THEN replace(mp.file,'/Kid_Movies/','/mnt/user/Kid_Movies/')
          WHEN mp.file LIKE '%/Kid_movies/%'  THEN replace(mp.file,'/Kid_movies/','/mnt/user/Kid_Movies/')
          WHEN mp.file LIKE '%/movies/%' AND ls.name = 'Kids Movies' THEN replace(mp.file,'/movies/','/mnt/user/Kid_Movies/')
          WHEN mp.file LIKE '%/movies/%'      THEN replace(mp.file,'/movies/','/mnt/user/Movies/')
          ELSE mp.file
      END AS file_path,
      mitem.video_codec
  FROM ${dbPrefix}metadata_items AS mi
  JOIN ${dbPrefix}library_sections AS ls ON mi.library_section_id = ls.id
  JOIN ${dbPrefix}media_items AS mitem ON mitem.metadata_item_id = mi.id
  JOIN ${dbPrefix}media_parts AS mp ON mp.media_item_id = mitem.id
  LEFT JOIN (SELECT MAX(datetime(viewed_at, 'unixepoch', 'localtime')) AS viewed_at, guid FROM ${dbPrefix}metadata_item_views GROUP BY guid) miv ON miv.guid = mi.guid
  WHERE ls.name IN ('Movies','TV Shows', 'Kids Movies', 'Kids TV Shows')
`;

export async function getOldestMedia() {
  const settings = await prisma.settings.findFirst({ where: { id: "global" } });
  if (!settings?.plexDbMain) return [];

  const runId = crypto.randomUUID();
  const DB_MAIN_TMP = `/tmp/main_plex_${runId}.db`;
  const DB_KIDS_TMP = `/tmp/kids_plex_${runId}.db`;
  const DB_BACKUP_TMP = `/tmp/backup_plex_${runId}.db`;
  
  let db: Database.Database | null = null;

  try {
    if (fs.existsSync(settings.plexDbMain)) fs.copyFileSync(settings.plexDbMain, DB_MAIN_TMP);
    if (settings.plexDbKids && fs.existsSync(settings.plexDbKids)) fs.copyFileSync(settings.plexDbKids, DB_KIDS_TMP);
    if (settings.plexDbBackup && fs.existsSync(settings.plexDbBackup)) fs.copyFileSync(settings.plexDbBackup, DB_BACKUP_TMP);

    db = new Database(DB_MAIN_TMP, { readonly: true });
    
    // Dynamically build the query based on which databases actually exist
    let queryBlocks = [getSelectBlock("")]; // Main DB

    if (fs.existsSync(DB_KIDS_TMP)) {
      db.exec(`ATTACH DATABASE '${DB_KIDS_TMP}' AS kids;`);
      queryBlocks.push(getSelectBlock("kids."));
    }
    
    if (fs.existsSync(DB_BACKUP_TMP)) {
      db.exec(`ATTACH DATABASE '${DB_BACKUP_TMP}' AS backup;`);
      queryBlocks.push(getSelectBlock("backup."));
    }

    const finalQuery = `
      WITH AllMedia AS (
          ${queryBlocks.join("\nUNION ALL\n")}
      ),
      GlobalGuidActivity AS (
          SELECT guid, MAX(active_dt) AS latest_activity
          FROM AllMedia
          GROUP BY guid
      )
      SELECT DISTINCT ga.latest_activity, am.file_path, am.guid, am.video_codec
      FROM AllMedia am
      JOIN GlobalGuidActivity ga ON am.guid = ga.guid
      WHERE am.file_path LIKE '/mnt/user/%' 
        AND am.file_path NOT LIKE '%placeholders%'
      ORDER BY ga.latest_activity ASC LIMIT 50;
    `;

    const stmt = db.prepare(finalQuery);
    return stmt.all() as any[];
  } catch (error) {
    console.error("SQL Error in getOldestMedia:", error);
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