"use client";

import { useState, useEffect } from "react";
import { 
    getDiskUsage, getOldestMedia, bulkQueueInTdarr, 
    bulkDeleteMedia, getOptimizerSettings, saveOptimizerSettings 
} from "@/app/actions/optimizer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Settings, Trash2, Send, RefreshCw, HardDrive, Loader2 } from "lucide-react";

export default function OptimizerPage() {
  const [usage, setUsage] = useState<number>(0);
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dUsage, mList, settings] = await Promise.all([
        getDiskUsage(), getOldestMedia(), getOptimizerSettings()
      ]);
      setUsage(dUsage);
      setMedia(mList);
      setConfig(settings);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const toggleFile = (path: string) => {
    const next = new Set(selectedFiles);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelectedFiles(next);
  };

  const handleBulkQueue = async () => {
    if (!confirm(`Master, send ${selectedFiles.size} files to Tdarr?`)) return;
    await bulkQueueInTdarr(Array.from(selectedFiles));
    setSelectedFiles(new Set());
    loadData();
  };

  const handleBulkDelete = async () => {
    if (!confirm(`CAUTION: Permanently delete ${selectedFiles.size} files from the array?`)) return;
    await bulkDeleteMedia(Array.from(selectedFiles));
    setSelectedFiles(new Set());
    loadData();
  };

  const formatCodec = (codec: string) => {
    if (!codec) return "Unknown";
    const c = codec.toLowerCase();
    if (c === "hevc" || c === "h265") return "H.265 / HEVC";
    if (c === "h264" || c === "avc") return "H.264 / AVC";
    if (c === "mpeg4") return "MPEG-4";
    return codec.toUpperCase();
  };

  // Dual Threshold Logic
  const warnThresh = config?.warningThreshold || 70;
  const delThresh = config?.deletionThreshold || 75;

  let barColor = "bg-primary";
  if (usage >= delThresh) barColor = "bg-red-500";
  else if (usage >= warnThresh) barColor = "bg-yellow-500";

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-3">
            <HardDrive className="text-primary h-8 w-8" /> Media Optimizer
        </h1>
        <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} disabled={loading}>
                <RefreshCw className={loading ? "animate-spin mr-2" : "mr-2"} size={16} /> Run Scan Now
            </Button>
            <SettingsDialog config={config} onSave={loadData} />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Array Storage Usage</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm font-medium">
             <span>/mnt/user (Warn: {warnThresh}% | Auto-Purge: {delThresh}%)</span>
             <span className={usage >= warnThresh ? "font-bold" : ""}>{usage}%</span>
          </div>
          <Progress value={usage} className={barColor} />
          
          {usage >= delThresh && (
            <p className="text-xs text-red-500 mt-2 font-bold animate-pulse">
              CRITICAL: Storage exceeds {delThresh}%. The automated scheduler is actively purging old media.
            </p>
          )}
          {usage >= warnThresh && usage < delThresh && (
            <p className="text-xs text-yellow-500 mt-2 font-semibold">
              WARNING: Storage exceeds {warnThresh}%. Review old media below to prevent automated purging.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Only show the media table if we've crossed the warning threshold */}
      {usage >= warnThresh && (
          <Card className="border-yellow-500/50 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between bg-yellow-500/10">
              <CardTitle>Oldest Unwatched Media (At Risk)</CardTitle>
              {selectedFiles.size > 0 && (
                <div className="flex gap-2 animate-in fade-in zoom-in">
                    <Button size="sm" variant="secondary" onClick={handleBulkQueue}>
                        <Send className="h-4 w-4 mr-2" /> Bulk Tdarr ({selectedFiles.size})
                    </Button>
                    <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                        <Trash2 className="h-4 w-4 mr-2" /> Bulk Delete ({selectedFiles.size})
                    </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Filename</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Last Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {media.map((item) => {
                      const codec = formatCodec(item.video_codec);
                      const isInefficient = codec.includes("H.264") || codec.includes("MPEG");
                      
                      return (
                        <TableRow key={item.guid}>
                          <TableCell>
                            <Checkbox 
                                checked={selectedFiles.has(item.file_path)} 
                                onCheckedChange={() => toggleFile(item.file_path)} 
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs truncate max-w-md">{item.file_path.split('/').pop()}</TableCell>
                          <TableCell>
                            <Badge variant={isInefficient ? "destructive" : "secondary"} className="whitespace-nowrap">
                                {codec}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{new Date(item.latest_activity).toLocaleDateString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
      )}
    </div>
  );
}

function SettingsDialog({ config, onSave }: any) {
    const handleSave = async (e: any) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        await saveOptimizerSettings(Object.fromEntries(formData));
        onSave();
    };

    return (
        <Dialog>
            <DialogTrigger asChild><Button variant="secondary"><Settings className="mr-2 h-4 w-4" /> Config</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Optimizer Settings</DialogTitle>
                    <DialogDescription>
                        Configure paths for Plex databases, Tdarr API connections, and automated thresholds.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Main Plex DB Path</Label>
                            <Input name="plexDbMain" defaultValue={config?.plexDbMain} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Kids Plex DB</Label>
                                <Input name="plexDbKids" defaultValue={config?.plexDbKids} />
                            </div>
                            <div className="space-y-2">
                                <Label>Backup Plex DB</Label>
                                <Input name="plexDbBackup" defaultValue={config?.plexDbBackup} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tdarr URL</Label>
                                <Input name="tdarrUrl" defaultValue={config?.tdarrUrl} />
                            </div>
                            {/* RESTORED: Cron Schedule */}
                            <div className="space-y-2">
                                <Label>Schedule (Cron Expression)</Label>
                                <Input name="optimizerSchedule" defaultValue={config?.optimizerSchedule} placeholder="0 0 * * *" />
                            </div>
                        </div>
                        
                        {/* THE AUTOMATION CONTROLS */}
                        <div className="grid grid-cols-3 gap-4 border-t pt-4 mt-2">
                            <div className="space-y-2">
                                <Label className="text-yellow-600 dark:text-yellow-500 font-bold">Warning (%)</Label>
                                <Input name="warningThreshold" type="number" min="1" max="99" defaultValue={config?.warningThreshold || 70} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-red-600 dark:text-red-500 font-bold">Auto-Purge (%)</Label>
                                <Input name="deletionThreshold" type="number" min="1" max="99" defaultValue={config?.deletionThreshold || 75} />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold">Purge Amount</Label>
                                <Input name="purgeAmount" type="number" min="1" max="50" defaultValue={config?.purgeAmount || 5} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter><Button type="submit">Save Changes</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}