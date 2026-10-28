"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  FileText, 
  Search, 
  Download, 
  Trash2, 
  ExternalLink, 
  Loader2, 
  RefreshCw, 
  User, 
  Clock, 
  ShieldCheck,
  Film
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAllScriptsAdmin, deleteScript, exportToPDF } from "@/lib/scriptUtils";
import { Script } from "@/types/script";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

export default function AdminScriptsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const loadScripts = async () => {
    if (!user) return;
    try {
      setLoading(true);
      let token: string | undefined;
      try {
        token = await user.getIdToken();
      } catch (e) {}

      const all = await getAllScriptsAdmin({
        uid: user.uid,
        email: user.email,
        token
      });
      setScripts(all);
    } catch (error) {
      console.error("Error loading all screenplays for admin:", error);
      toast({
        title: "Error",
        description: "Failed to load screenplays from database.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadScripts();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const filteredScripts = useMemo(() => {
    if (!searchTerm.trim()) return scripts;
    const term = searchTerm.toLowerCase();
    return scripts.filter(s => 
      s.title?.toLowerCase().includes(term) ||
      s.description?.toLowerCase().includes(term) ||
      s.writtenBy?.toLowerCase().includes(term) ||
      s.ownerEmail?.toLowerCase().includes(term) ||
      s.id?.toLowerCase().includes(term)
    );
  }, [scripts, searchTerm]);

  const handleExportPDF = async (script: Script) => {
    try {
      setIsExporting(script.id);
      toast({
        title: "Generating PDF",
        description: "Preparing screenplay PDF download...",
      });
      await exportToPDF(script);
      toast({
        title: "Success",
        description: `Exported "${script.title}" successfully.`,
      });
    } catch (error: any) {
      console.error("PDF Export error:", error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to generate screenplay PDF.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(null);
    }
  };

  const handleDelete = async (script: Script) => {
    if (!confirm(`Are you sure you want to permanently delete "${script.title}" by ${script.writtenBy || script.ownerEmail || 'author'}?`)) {
      return;
    }

    try {
      let token: string | undefined;
      try {
        token = await user?.getIdToken();
      } catch (e) {}

      await deleteScript(script.id, {
        uid: user?.uid,
        email: user?.email,
        token
      });

      setScripts(prev => prev.filter(s => s.id !== script.id));
      toast({
        title: "Deleted",
        description: `Screenplay "${script.title}" has been deleted.`,
      });
    } catch (error: any) {
      console.error("Error deleting script:", error);
      toast({
        title: "Delete Failed",
        description: error.message || "Could not delete screenplay.",
        variant: "destructive",
      });
    }
  };

  const totalAuthors = useMemo(() => {
    const authorSet = new Set(scripts.map(s => s.ownerEmail || s.ownerId).filter(Boolean));
    return authorSet.size;
  }, [scripts]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Film className="h-7 w-7 text-primary" /> Screenplay Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse, inspect, and manage screenplays created by registered platform writers.
          </p>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadScripts} 
          disabled={loading}
          className="gap-2 border-border"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">Total Screenplays</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-foreground">{scripts.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">Unique Writers</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-foreground">{totalAuthors}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider">Admin Security Status</CardDescription>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm mt-1">
              <ShieldCheck className="h-5 w-5" />
              <span>Private Access Active</span>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg">All Screenplays ({filteredScripts.length})</CardTitle>
              <CardDescription>
                Direct access to writer stories and drafts.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search title, writer, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background border-border"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading screenplays...</p>
            </div>
          ) : filteredScripts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-base font-semibold">No screenplays found</p>
              <p className="text-xs mt-1">
                {searchTerm ? "No screenplay matched your search criteria." : "There are no screenplays created in the database yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-bold">Title & Description</TableHead>
                    <TableHead className="font-bold">Author</TableHead>
                    <TableHead className="font-bold">Blocks</TableHead>
                    <TableHead className="font-bold">Last Updated</TableHead>
                    <TableHead className="font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScripts.map((script) => (
                    <TableRow key={script.id} className="border-border hover:bg-muted/40 transition-colors">
                      <TableCell className="max-w-[280px]">
                        <div className="font-semibold text-foreground truncate">{script.title || "Untitled Script"}</div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {script.description || "No description"}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground/70 truncate mt-0.5">
                          ID: {script.id}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-foreground truncate">{script.writtenBy || "Anonymous"}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{script.ownerEmail || script.ownerId}</div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted border border-border">
                          {Array.isArray(script.content) ? script.content.length : 0} blocks
                        </span>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
                          <span>
                            {script.updatedAt?.toDate ? script.updatedAt.toDate().toLocaleDateString('en-IN') : (script.updatedAt ? new Date(script.updatedAt).toLocaleDateString('en-IN') : 'N/A')}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/script-writing/${script.id}`} target="_blank" rel="noopener noreferrer">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 px-2.5 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span>Open Story</span>
                            </Button>
                          </Link>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            title="Download PDF"
                            onClick={() => handleExportPDF(script)}
                            disabled={isExporting === script.id}
                          >
                            {isExporting === script.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete Screenplay"
                            onClick={() => handleDelete(script)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
