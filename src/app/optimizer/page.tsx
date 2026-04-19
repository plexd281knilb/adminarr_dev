"use client";

import { useState, useEffect } from "react";
import { getDiskUsage, getOldestMedia, queueInTdarr } from "@/app/actions/optimizer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle } from "lucide-react";

type MediaItem = {
  guid: string;
  latest_activity: string;
  file_path: string;
};

export default function OptimizerPage() {
  const [usage, setUsage] = useState<number>(0);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [diskUsage, mediaList] = await Promise.all([
          getDiskUsage(),
          getOldestMedia()
        ]);
        setUsage(diskUsage);
        setMedia(mediaList);
      } catch (error) {
        console.error("Error loading optimizer data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSendToTdarr = async (filePath: string) => {
    // Add file to processing Set to trigger loading state for this specific row
    setProcessingFiles(prev => new Set(prev).add(filePath));
    
    try {
      const success = await queueInTdarr(filePath);
      if (success) {
        // Remove from the local UI list instantly if successfully queued
        setMedia(prev => prev.filter(m => m.file_path !== filePath));
      } else {
        alert("Failed to queue file in Tdarr. Please check your Tdarr API connection.");
      }
    } catch (error) {
      console.error("Tdarr queue error:", error);
      alert("An unexpected error occurred while communicating with Tdarr.");
    } finally {
      // Always remove the processing state, success or fail
      setProcessingFiles(prev => {
        const next = new Set(prev);
        next.delete(filePath);
        return next;
      });
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 overflow-hidden">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Media Optimizer</h1>

      {/* Disk Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle>Array Storage Usage (/mnt/user)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm font-medium">Capacity</span>
            <span className="text-sm font-medium">{usage}%</span>
          </div>
          <Progress value={usage} className={usage > 75 ? "bg-red-500" : "bg-primary"} />
          {usage > 75 ? (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1 font-medium">
              <AlertCircle className="h-3 w-3" /> Usage is over 75% threshold. Recommend cleaning or converting old media.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-2">
               Array is healthy.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Oldest Media Table */}
      <Card>
        <CardHeader>
          <CardTitle>Oldest Unwatched Media (Top 50)</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 overflow-x-auto">
          {loading ? (
            <div className="flex flex-col space-y-3 py-6">
               <p className="text-sm text-muted-foreground animate-pulse font-medium">
                 Copying snapshot databases and running queries...
               </p>
            </div>
          ) : media.length === 0 ? (
            <p className="text-sm text-muted-foreground">No media found or databases could not be read.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Path</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {media.map((item) => (
                  <TableRow key={item.guid}>
                    <TableCell className="font-mono text-xs max-w-xs md:max-w-md truncate" title={item.file_path}>
                      {item.file_path.split('/').pop()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(item.latest_activity).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        variant="secondary"
                        disabled={processingFiles.has(item.file_path)}
                        onClick={() => handleSendToTdarr(item.file_path)}
                      >
                        {processingFiles.has(item.file_path) ? "Queueing..." : "Send to Tdarr"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}