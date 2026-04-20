import { performSync } from "@/app/data";
import { scanEmailAccounts } from "@/lib/email-scanner";
import { checkOverdueStatus } from "@/app/actions";
import { getOldestMedia, autoPurgeMedia } from "@/app/actions/optimizer"; // Ensure autoPurgeMedia is imported

declare global {
  var isCronRunning: boolean | undefined;
}

export function initCron() {
  if (globalThis.isCronRunning) return;
  globalThis.isCronRunning = true;

  console.log("Initializing Job Scheduler...");

  const runSyncJob = async () => {
    try { await performSync(); console.log("Cron: Sync Complete."); } catch (e) { console.error("Cron: Sync Failed", e); }
  };

  const runScanJob = async () => {
    try { await scanEmailAccounts(); console.log("Cron: Email Scan Complete."); } catch (e) { console.error("Cron: Email Scan Failed", e); }
  };

  const runOverdueJob = async () => {
    try { await checkOverdueStatus(); console.log("Cron: Overdue Check Complete."); } catch (e) { console.error("Cron: Overdue Check Failed", e); }
  };

  // NEW: Background Optimizer Cache Refresh
const runOptimizerRefresh = async () => {
    console.log("Cron: Running Optimizer Check...");
    try {
        await getOldestMedia(); // Refreshes the cache for the UI
        
        // Run the auto-purge check
        const didPurge = await autoPurgeMedia();
        if (didPurge) {
             console.log("Cron: Auto-Purge Executed Successfully.");
        } else {
             console.log("Cron: Storage levels safe. No purge needed.");
        }
    } catch (e) { 
        console.error("Cron: Optimizer Check Failed", e); 
    }
  };

  // Run immediately on server start
  runSyncJob();
  runScanJob();
  runOverdueJob();
  runOptimizerRefresh();

  // Standard 1-hour intervals
  setInterval(runSyncJob, 1000 * 60 * 60);
  setInterval(runScanJob, 1000 * 60 * 60);
  setInterval(runOverdueJob, 1000 * 60 * 60);
  setInterval(runOptimizerRefresh, 1000 * 60 * 60);
}