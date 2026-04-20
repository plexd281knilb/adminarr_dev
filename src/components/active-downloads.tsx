"use client";

import { useState, useEffect } from "react";
import { getDashboardActivity, getMediaAppsActivity } from "@/app/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Server, Download, Activity, ListVideo, PlayCircle, Loader2 } from "lucide-react";

export default function ActiveDownloads() {
    const [dashboardData, setDashboardData] = useState<any[]>([]);
    const [appsData, setAppsData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLiveStats = async () => {
            try {
                const [dash, apps] = await Promise.all([
                    getDashboardActivity(),
                    getMediaAppsActivity()
                ]);
                setDashboardData(dash || []);
                setAppsData(apps || []);
            } catch (error) {
                console.error("Failed to fetch live stats", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLiveStats();
        // MASTER'S OPTIMIZATION: 5 seconds is the sweet spot for "Live" feel without API spam
        const intervalId = setInterval(fetchLiveStats, 5000);
        return () => clearInterval(intervalId);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
        );
    }

    const downloadApps = appsData.filter((app: any) => 
        ["sabnzbd", "nzbget", "radarr", "sonarr", "lidarr", "readarr"].includes(app?.type?.toLowerCase())
    );

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {downloadApps.map((app: any) => {
                if (!app.queue || app.queue.length === 0) return null;
                return (
                    <Card key={app.id} className="overflow-hidden border-primary/10 shadow-sm">
                        <CardHeader className="bg-muted/30 pb-3">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-tight">
                                <Download className="h-4 w-4 text-primary" />
                                {app.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            {app.queue.map((item: any, i: number) => {
                                const progress = item.percentage || (item.size > 0 ? ((item.size - item.sizeleft) / item.size * 100) : 0);
                                return (
                                    <div key={`${app.id}-item-${i}`} className="space-y-1.5">
                                        <div className="flex justify-between text-xs gap-4">
                                            <span className="truncate font-medium flex-1" title={item.filename || item.title}>
                                                {item.filename || item.title || "Processing..."}
                                            </span>
                                            <span className="text-muted-foreground font-mono shrink-0">
                                                {item.timeleft?.split('.')[0] || "00:00:00"}
                                            </span>
                                        </div>
                                        <Progress value={parseFloat(progress.toString())} className="h-1.5" />
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}