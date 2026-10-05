'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { getIndexingStats, toggleCronActive, runManualBatch, type IndexingStats } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Globe, CheckCircle, AlertTriangle, Play, HelpCircle, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GoogleIndexingDashboard() {
  const [stats, setStats] = useState<IndexingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTogglingCron, setIsTogglingCron] = useState(false);
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const { toast } = useToast();

  const fetchStats = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const data = await getIndexingStats();
      setStats(data);
    } catch (err) {
      toast({
        title: "Error fetching data",
        description: "Could not retrieve indexing statistics.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleToggleCron = async (checked: boolean) => {
    setIsTogglingCron(true);
    try {
      const res = await toggleCronActive(checked);
      if (res.success) {
        toast({ title: "Settings Updated", description: res.message });
        setStats(prev => prev ? { ...prev, isCronActive: checked } : null);
      } else {
        toast({ title: "Failed to update", description: res.message, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsTogglingCron(false);
    }
  };

  const handleRunBatch = async () => {
    setIsRunningBatch(true);
    try {
      const res = await runManualBatch();
      if (res.success) {
        toast({
          title: "Batch Complete",
          description: res.message,
        });
        fetchStats(true);
      } else {
        toast({
          title: "Batch Failed",
          description: res.message,
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsRunningBatch(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[500px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Compiling Google Indexing details...</p>
        </div>
      </div>
    );
  }

  const progressPercent = stats && stats.totalSiteUrls > 0 
    ? Math.min(100, Math.round((stats.submittedCount / stats.totalSiteUrls) * 100))
    : 0;

  return (
    <div className="flex-grow p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary animate-pulse" /> Google Indexing API Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">Manage and track real-time URL submissions directly to Google Search Index.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={isRefreshing} 
          onClick={() => fetchStats(true)} 
          className="rounded-full shadow-sm hover:bg-muted"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          Refresh Data
        </Button>
      </div>

      {/* Cards Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total URLs */}
        <Card className="shadow-sm border border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Site URLs</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{stats?.totalSiteUrls || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Unique pages compiled from DB sitemap</p>
          </CardContent>
        </Card>

        {/* Submitted */}
        <Card className="shadow-sm border border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Submitted to Google</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{stats?.submittedCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{progressPercent}% of pages submitted</p>
          </CardContent>
        </Card>

        {/* Balance Pending */}
        <Card className="shadow-sm border border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Balance Pending</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{stats?.balancePending ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting indexing submissions</p>
          </CardContent>
        </Card>

        {/* VPS Cron Switch */}
        <Card className="shadow-sm border border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">VPS Cron Active</CardTitle>
            <Switch 
              checked={stats?.isCronActive || false} 
              onCheckedChange={handleToggleCron} 
              disabled={isTogglingCron}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground capitalize">
              {stats?.isCronActive ? (
                <span className="text-emerald-500 flex items-center gap-1.5"><Activity className="h-5 w-5 animate-pulse" /> Active</span>
              ) : (
                <span className="text-slate-500">Stopped</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Bulk cron processes daily submissions</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar Section */}
      <Card className="shadow-sm border border-border/60">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center text-sm font-semibold mb-2">
            <span className="text-muted-foreground">Indexing Progress</span>
            <span className="text-primary">{progressPercent}% Complete</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3.5 overflow-hidden">
            <div 
              className="bg-primary h-full rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
        </CardContent>
      </Card>

      {/* Split Grid: Manual Execution & Instructions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Manual Execution Card */}
        <Card className="shadow-sm border border-border/60">
          <CardHeader>
            <CardTitle className="text-base font-bold">Manual Batch Execution</CardTitle>
            <CardDescription>
              Trigger a manual submission batch of <strong>{stats?.balancePending || 0} pending URLs</strong> to Google Indexing API right now.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Button 
                onClick={handleRunBatch} 
                disabled={isRunningBatch || !stats || stats.balancePending === 0}
                className="font-bold flex items-center gap-2"
              >
                {isRunningBatch ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting Batch...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    Run Batch Now
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground max-w-xs leading-normal">
                Leaves 20 requests buffer for real time admin edits (Standard API quota is 200 URL submissions/day).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card className="shadow-sm border border-border/60">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-muted-foreground" /> Dashboard Instructions
            </CardTitle>
            <CardDescription>How to manage automated Google Search indexing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              1. <strong>Instant Indexing:</strong> Whenever you approve artist applications, edit blog posts, modify categories, or customize SEO overrides, Google is notified immediately in real-time.
            </p>
            <p>
              2. <strong>Bulk Indexing:</strong> The VPS cron job processes remaining pages daily. Once <strong>Balance Pending</strong> reaches 0, the switch will automatically turn off to save quota.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Submissions Table */}
      <Card className="shadow-sm border border-border/60">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base font-bold">Recent Submissions</CardTitle>
          <CardDescription>List of the last 20 URLs processed by the Indexing API.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-bold">URL</TableHead>
                  <TableHead className="font-bold w-32">Status</TableHead>
                  <TableHead className="font-bold w-48">Processed Date</TableHead>
                  <TableHead className="font-bold">Details/Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats && stats.recentSubmissions.length > 0 ? (
                  stats.recentSubmissions.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/10">
                      <TableCell className="font-medium text-xs break-all max-w-sm sm:max-w-md md:max-w-lg">
                        <a 
                          href={log.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-primary hover:underline"
                        >
                          {log.url}
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={log.status === 'success' ? 'default' : 'destructive'}
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                            log.status === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/10' : 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/10'
                          )}
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {log.processedDate}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground leading-normal max-w-xs break-words">
                        {log.error ? (
                          <span className="text-destructive font-mono text-[10px]">{log.error}</span>
                        ) : (
                          <span className="text-slate-400 font-mono">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                      No Google Indexing submissions logged yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
