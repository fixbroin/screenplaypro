"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Database, 
  UploadCloud, 
  Download, 
  Loader2, 
  AlertTriangle, 
  FolderArchive, 
  CheckCircle2, 
  Layers, 
  Sparkles, 
  Image as ImageIcon,
  ShieldAlert
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DatabaseToolsPage() {
  const { toast } = useToast();

  // 1. Full System Master Backup (Database + Media ZIP)
  const [isExportingSystem, setIsExportingSystem] = useState(false);
  const [isImportingSystem, setIsImportingSystem] = useState(false);
  const [systemRestoreFile, setSystemRestoreFile] = useState<File | null>(null);
  const [systemRestoreReport, setSystemRestoreReport] = useState<any | null>(null);

  // 2. MySQL Database Only (JSON)
  const [isExportingDb, setIsExportingDb] = useState(false);
  const [isImportingDb, setIsImportingDb] = useState(false);
  const [dbImportFile, setDbImportFile] = useState<File | null>(null);
  const [dbRestoreReport, setDbRestoreReport] = useState<any | null>(null);

  // 3. Media Storage Only (ZIP)
  const [isExportingStorage, setIsExportingStorage] = useState(false);
  const [isImportingStorage, setIsImportingStorage] = useState(false);
  const [storageRestoreFile, setStorageRestoreFile] = useState<File | null>(null);

  // ----------------------------------------------------
  // Handler 1: Master Full System Backup (ZIP)
  // ----------------------------------------------------
  const handleSystemExport = async () => {
    setIsExportingSystem(true);
    toast({
      title: "Generating Complete System Backup",
      description: "Extracting all MySQL tables and packaging all media images (slides, ads, branding) into a ZIP archive..."
    });

    try {
      const res = await fetch('/api/admin/system/backup');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to create system backup archive');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `full-system-complete-backup-${timestamp}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Complete System Backup Downloaded 🎉",
        description: "Your full MySQL database snapshot and all uploaded media files have been saved."
      });
    } catch (error: any) {
      console.error("Error creating system backup:", error);
      toast({
        title: "System Backup Failed",
        description: error.message || "Could not generate full system backup.",
        variant: "destructive"
      });
    } finally {
      setIsExportingSystem(false);
    }
  };

  const handleSystemRestore = async () => {
    if (!systemRestoreFile) {
      toast({ title: "No ZIP File Selected", description: "Please select a full system backup ZIP file.", variant: "destructive" });
      return;
    }

    setIsImportingSystem(true);
    setSystemRestoreReport(null);
    toast({
      title: "Restoring Complete System",
      description: "Unpacking media images into /uploads and restoring all database tables into MySQL. Please wait..."
    });

    try {
      const formData = new FormData();
      formData.append('file', systemRestoreFile);

      const res = await fetch('/api/admin/system/restore', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to restore system backup.');
      }

      setSystemRestoreReport(data);
      toast({
        title: "Full System Restore Successful 🎉",
        description: data.message || "All images and database tables restored successfully!"
      });
      setSystemRestoreFile(null);
      const fileInput = document.getElementById('system-restore-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      console.error("Error restoring system backup:", error);
      toast({
        title: "System Restore Failed",
        description: error.message || "Could not unpack and restore system backup.",
        variant: "destructive"
      });
    } finally {
      setIsImportingSystem(false);
    }
  };

  // ----------------------------------------------------
  // Handler 2: Database Snapshot (JSON)
  // ----------------------------------------------------
  const handleDbExport = async () => {
    setIsExportingDb(true);
    toast({
      title: "Exporting Database Tables",
      description: "Querying all MySQL tables (slideshows, ads, scripts, users, settings, plans, etc.)..."
    });

    try {
      const res = await fetch('/api/admin/database/backup');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to export database snapshot');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `mysql-database-complete-backup-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Database Export Successful 🎉",
        description: "Complete MySQL database snapshot JSON downloaded successfully."
      });
    } catch (error: any) {
      console.error("Error exporting database:", error);
      toast({
        title: "Database Export Failed",
        description: error.message || "Could not export database snapshot.",
        variant: "destructive"
      });
    } finally {
      setIsExportingDb(false);
    }
  };

  const handleDbImport = async () => {
    if (!dbImportFile) {
      toast({ title: "No JSON File Selected", description: "Please select a JSON database backup file to import.", variant: "destructive" });
      return;
    }

    setIsImportingDb(true);
    setDbRestoreReport(null);
    toast({
      title: "Restoring Database Tables",
      description: "Inserting and updating records directly in MySQL tables..."
    });

    try {
      const formData = new FormData();
      formData.append('file', dbImportFile);

      const res = await fetch('/api/admin/database/restore', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to restore database records.');
      }

      setDbRestoreReport(data);
      toast({
        title: "Database Restore Successful 🎉",
        description: data.message || `Restored ${data.totalRestored || 0} records across tables.`
      });
      setDbImportFile(null);
      const fileInput = document.getElementById('db-import-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      console.error("Error restoring database:", error);
      toast({
        title: "Database Restore Failed",
        description: error.message || "Invalid JSON backup file or database error.",
        variant: "destructive"
      });
    } finally {
      setIsImportingDb(false);
    }
  };

  // ----------------------------------------------------
  // Handler 3: Media Storage Only (ZIP)
  // ----------------------------------------------------
  const handleStorageExport = async () => {
    setIsExportingStorage(true);
    toast({ title: "Creating Media Storage ZIP", description: "Compressing all files in /uploads (ads, slides, branding)..." });

    try {
      const res = await fetch('/api/admin/storage/backup');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to create storage backup');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `media-storage-backup-${timestamp}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Media Storage ZIP Downloaded 🎉", description: "All uploaded images and folder structures have been exported." });
    } catch (error: any) {
      console.error("Error backing up storage:", error);
      toast({ title: "Storage Export Failed", description: error.message || "Could not create ZIP backup.", variant: "destructive" });
    } finally {
      setIsExportingStorage(false);
    }
  };

  const handleStorageRestore = async () => {
    if (!storageRestoreFile) {
      toast({ title: "No ZIP File Selected", description: "Please select a ZIP file to restore storage images.", variant: "destructive" });
      return;
    }

    setIsImportingStorage(true);
    toast({ title: "Restoring Media Storage", description: "Unpacking media files into corresponding folder locations..." });

    try {
      const formData = new FormData();
      formData.append('file', storageRestoreFile);

      const res = await fetch('/api/admin/storage/restore', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to restore storage files.');
      }

      toast({ title: "Media Restore Successful 🎉", description: data.message || "All images restored to their original folders." });
      setStorageRestoreFile(null);
      const fileInput = document.getElementById('storage-restore-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      console.error("Error restoring storage:", error);
      toast({ title: "Storage Restore Failed", description: error.message || "Could not unpack ZIP file.", variant: "destructive" });
    } finally {
      setIsImportingStorage(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Database className="h-6 w-6" />
          <span className="text-xs font-black uppercase tracking-widest">Hostinger MySQL & Storage Maintenance</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
          Backup & Restore Center
        </h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Create complete, reliable snapshots of your entire application: all database tables (slideshows, ads, screenplays, users, settings, subscriptions) and all uploaded media files.
        </p>
      </div>

      {/* ---------------------------------------------------- */}
      {/* SECTION 1: MASTER ALL-IN-ONE BACKUP (RECOMMENDED)   */}
      {/* ---------------------------------------------------- */}
      <Card className="border-2 border-primary/30 bg-primary/[0.03] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
          <Badge className="bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-wider flex items-center gap-1 shadow-sm">
            <Sparkles className="w-3 h-3" /> Recommended
          </Badge>
        </div>

        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Complete Full System Backup (Database + All Media Images)
          </CardTitle>
          <CardDescription className="text-sm">
            Packages the entire MySQL database snapshot (all tables) <strong>AND</strong> all uploaded media images (<code className="text-primary font-mono text-xs">/uploads/ads/</code>, <code className="text-primary font-mono text-xs">/uploads/slideshows/</code>, <code className="text-primary font-mono text-xs">/uploads/web-settings/</code>) into a single master ZIP file.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Master Export */}
            <div className="p-5 rounded-2xl bg-card border border-border/80 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2 font-bold text-base text-foreground">
                  <Download className="w-5 h-5 text-primary" />
                  <span>Download Full System Backup</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Generates a single master archive containing all database tables (slideshows, ads, scripts, users, settings, plans) alongside all image assets. Ideal for full site replication or server migration.
                </p>
              </div>
              <Button 
                onClick={handleSystemExport} 
                disabled={isExportingSystem} 
                className="w-full font-bold shadow-md h-11"
              >
                {isExportingSystem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {isExportingSystem ? "Packaging Full Backup ZIP..." : "Download Complete System ZIP"}
              </Button>
            </div>

            {/* Master Restore */}
            <div className="p-5 rounded-2xl bg-card border border-border/80 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2 font-bold text-base text-foreground">
                  <UploadCloud className="w-5 h-5 text-primary" />
                  <span>Restore Full System Backup</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  Upload a previously exported complete system ZIP file to automatically unpack all images back into their exact folders and restore all MySQL database records.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="system-restore-file-input" className="text-xs font-semibold">Select Full System ZIP File</Label>
                  <Input 
                    id="system-restore-file-input" 
                    type="file" 
                    accept=".zip" 
                    onChange={(e) => setSystemRestoreFile(e.target.files?.[0] || null)} 
                    disabled={isImportingSystem} 
                    className="text-xs file:text-xs file:font-semibold"
                  />
                </div>
              </div>
              <Button 
                onClick={handleSystemRestore} 
                disabled={isImportingSystem || !systemRestoreFile} 
                variant="default"
                className="w-full font-bold h-11"
              >
                {isImportingSystem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                {isImportingSystem ? "Restoring System..." : "Restore Everything from ZIP"}
              </Button>
            </div>
          </div>

          {/* Master Restore Report Details */}
          {systemRestoreReport && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-foreground space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Full System Restore Completed Successfully</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Restored <strong>{systemRestoreReport.restoredImagesCount || 0}</strong> media files into folders and <strong>{systemRestoreReport.database?.totalRestored || 0}</strong> database records.
              </p>
              {systemRestoreReport.database?.breakdown && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {Object.entries(systemRestoreReport.database.breakdown).map(([table, count]: [string, any]) => (
                    <Badge key={table} variant="outline" className="text-[11px] bg-background font-mono">
                      {table}: {count}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------- */}
      {/* SECTION 2: COMPLETE DATABASE SNAPSHOT (JSON)        */}
      {/* ---------------------------------------------------- */}
      <Card className="border border-border/80 shadow-md">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            MySQL Database Complete Snapshot (JSON)
          </CardTitle>
          <CardDescription>
            Directly export and restore all rows across all MySQL tables: <strong>slideshows</strong>, <strong>ads & feature settings (app_settings)</strong>, <strong>screenplays (scripts)</strong>, <strong>users</strong>, <strong>web settings</strong>, <strong>subscription plans</strong>, and <strong>customer collections</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* DB Export */}
            <div className="p-5 rounded-2xl bg-secondary/15 border border-border/60 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="font-bold text-sm mb-1">Export Database Tables (JSON)</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Downloads a JSON snapshot of all active tables, including slides, ads, scripts, and users, ensuring exact primary keys and configuration data.
                </p>
              </div>
              <Button 
                onClick={handleDbExport} 
                disabled={isExportingDb} 
                variant="outline"
                className="w-full font-bold h-10 border-primary/20 hover:bg-primary/5"
              >
                {isExportingDb ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {isExportingDb ? "Exporting Database Tables..." : "Export MySQL Database JSON"}
              </Button>
            </div>

            {/* DB Import */}
            <div className="p-5 rounded-2xl bg-secondary/15 border border-border/60 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="font-bold text-sm mb-1">Restore Database Tables (JSON)</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  Upload a previously exported database JSON file. It maps records directly into their respective MySQL tables using safe upsert operations.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="db-import-file-input" className="text-xs font-semibold">Select JSON Backup File</Label>
                  <Input 
                    id="db-import-file-input" 
                    type="file" 
                    accept=".json" 
                    onChange={(e) => setDbImportFile(e.target.files?.[0] || null)} 
                    disabled={isImportingDb}
                    className="text-xs file:text-xs file:font-semibold"
                  />
                </div>
              </div>
              <Button 
                onClick={handleDbImport} 
                disabled={isImportingDb || !dbImportFile} 
                variant="outline"
                className="w-full font-bold h-10 border-primary/20 hover:bg-primary/5"
              >
                {isImportingDb ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                {isImportingDb ? "Restoring Records..." : "Import & Restore Database JSON"}
              </Button>
            </div>
          </div>

          {/* DB Restore Report Details */}
          {dbRestoreReport && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-foreground space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Database Tables Restored Successfully</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Total <strong>{dbRestoreReport.totalRestored || 0}</strong> records were updated or inserted across tables:
              </p>
              {dbRestoreReport.breakdown && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {Object.entries(dbRestoreReport.breakdown).map(([table, count]: [string, any]) => (
                    <Badge key={table} variant="outline" className="text-[11px] bg-background font-mono">
                      {table}: {count}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------- */}
      {/* SECTION 3: MEDIA STORAGE & IMAGES (ZIP)              */}
      {/* ---------------------------------------------------- */}
      <Card className="border border-border/80 shadow-md">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Media Storage & Uploaded Images (ZIP)
          </CardTitle>
          <CardDescription>
            Backup and restore only the uploaded images (<code className="text-xs font-mono">/uploads/ads/</code>, <code className="text-xs font-mono">/uploads/slideshows/</code>, <code className="text-xs font-mono">/uploads/web-settings/</code>) without altering database records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Storage Export */}
            <div className="p-5 rounded-2xl bg-secondary/15 border border-border/60 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="font-bold text-sm mb-1">Export Uploaded Images (ZIP)</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Compresses all media assets inside the local public uploads directory into a standalone ZIP file.
                </p>
              </div>
              <Button 
                onClick={handleStorageExport} 
                disabled={isExportingStorage} 
                variant="outline"
                className="w-full font-bold h-10 border-primary/20 hover:bg-primary/5"
              >
                {isExportingStorage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                {isExportingStorage ? "Zipping Images..." : "Backup All Images to ZIP"}
              </Button>
            </div>

            {/* Storage Restore */}
            <div className="p-5 rounded-2xl bg-secondary/15 border border-border/60 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="font-bold text-sm mb-1">Restore Uploaded Images (ZIP)</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  Upload a previously exported media storage ZIP to unpack and write images back into their corresponding folders.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="storage-restore-file-input" className="text-xs font-semibold">Select Media ZIP File</Label>
                  <Input 
                    id="storage-restore-file-input" 
                    type="file" 
                    accept=".zip" 
                    onChange={(e) => setStorageRestoreFile(e.target.files?.[0] || null)} 
                    disabled={isImportingStorage}
                    className="text-xs file:text-xs file:font-semibold"
                  />
                </div>
              </div>
              <Button 
                onClick={handleStorageRestore} 
                disabled={isImportingStorage || !storageRestoreFile} 
                variant="outline"
                className="w-full font-bold h-10 border-primary/20 hover:bg-primary/5"
              >
                {isImportingStorage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                {isImportingStorage ? "Unpacking Images..." : "Restore Images from ZIP"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
