"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Database, UploadCloud, Download, Loader2, AlertTriangle, FolderArchive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Define the list of collections/tables to be exported.
const COLLECTIONS_TO_EXPORT = [
  "users",
  "scripts",
  "userSubscriptions",
  "webSettings",
  "adminSubscriptionPlans",
  "adminFAQs",
  "adminPopups",
  "adminPromoCodes",
  "adminReviews",
  "adminSlideshows",
  "contactUsSubmissions",
  "popupSubmissions",
  "accountDeletionRequests",
  "seoOverrides",
  "userNotifications",
  "userActivities"
];


export default function DatabaseToolsPage() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    toast({ title: "Starting Export", description: "Fetching database records from Hostinger MySQL. This may take a moment..." });

    const exportData: Record<string, any[]> = {};
    try {
      for (const collectionName of COLLECTIONS_TO_EXPORT) {
        const res = await fetch(`/api/db/collections?name=${collectionName}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          exportData[collectionName] = json.data;
        } else {
          exportData[collectionName] = [];
        }
      }

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `mysql-database-backup-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Export Successful 🎉", description: `Hostinger MySQL database snapshot downloaded successfully.` });
    } catch (error) {
      console.error("Error exporting database:", error);
      toast({ title: "Export Failed", description: (error as Error).message || "Could not export MySQL database.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setImportFile(event.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast({ title: "No File Selected", description: "Please select a JSON file to import.", variant: "destructive" });
      return;
    }

    setIsImporting(true);
    toast({ title: "Starting Import", description: "Importing data into Hostinger MySQL. Please do not close this window..." });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const fileContent = event.target?.result as string;
        const importData = JSON.parse(fileContent);

        let totalOperations = 0;
        
        for (const collectionName in importData) {
          if (Object.prototype.hasOwnProperty.call(importData, collectionName)) {
            const documents = importData[collectionName];
            if (Array.isArray(documents)) {
              for (const docData of documents) {
                const docId = docData.id || docData._id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                await fetch('/api/db/collections', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ collectionName, id: docId, data: docData })
                });
                totalOperations++;
              }
            }
          }
        }

        toast({ title: "Import Successful 🎉", description: `Successfully restored ${totalOperations} records into Hostinger MySQL.` });
      } catch (error) {
        console.error("Error importing database:", error);
        toast({ title: "Import Failed", description: (error as Error).message || "Invalid JSON backup file.", variant: "destructive" });
      } finally {
        setIsImporting(false);
        setImportFile(null);
        const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    };
    reader.onerror = () => {
        toast({ title: "File Read Error", description: "Could not read the selected file.", variant: "destructive" });
        setIsImporting(false);
    };
    reader.readAsText(importFile);
  };

  const [isExportingStorage, setIsExportingStorage] = useState(false);
  const [isImportingStorage, setIsImportingStorage] = useState(false);
  const [storageRestoreFile, setStorageRestoreFile] = useState<File | null>(null);

  const handleStorageExport = async () => {
    setIsExportingStorage(true);
    toast({ title: "Creating Storage Backup Zip", description: "Packaging all uploaded images and folder structures into a ZIP file..." });

    try {
      const res = await fetch('/api/admin/storage/backup');
      if (!res.ok) {
        const errJson = await res.json();
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

      toast({ title: "Storage Backup Downloaded 🎉", description: "All images and folder structures have been exported as a ZIP archive." });
    } catch (error) {
      console.error("Error backing up storage:", error);
      toast({ title: "Storage Export Failed", description: (error as Error).message || "Could not create zip backup.", variant: "destructive" });
    } finally {
      setIsExportingStorage(false);
    }
  };

  const handleStorageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setStorageRestoreFile(e.target.files[0]);
    }
  };

  const handleStorageRestore = async () => {
    if (!storageRestoreFile) {
      toast({ title: "No ZIP File Selected", description: "Please select a ZIP file to restore storage images.", variant: "destructive" });
      return;
    }

    setIsImportingStorage(true);
    toast({ title: "Restoring Storage Backup", description: "Unpacking media files into corresponding folder locations..." });

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

      toast({ title: "Storage Restore Successful 🎉", description: data.message || "All images restored to their original folders." });
      setStorageRestoreFile(null);
      const fileInput = document.getElementById('storage-restore-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error("Error restoring storage:", error);
      toast({ title: "Storage Restore Failed", description: (error as Error).message || "Could not unpack ZIP file.", variant: "destructive" });
    } finally {
      setIsImportingStorage(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Database className="mr-2 h-6 w-6 text-primary" /> Database & Storage Maintenance Tools
          </CardTitle>
          <CardDescription>
            Backup and restore your Hostinger MySQL database snapshot and local media storage folders (uploaded images).
          </CardDescription>
        </CardHeader>
      </Card>

      {/* STORAGE & MEDIA BACKUP CARD */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            <FolderArchive className="mr-2 h-5 w-5 text-primary" /> Media Storage & Images Backup (ZIP)
          </CardTitle>
          <CardDescription>
            Package all uploaded images, branding logos, blog covers, and assets with their folder structures into a single downloadable ZIP file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Image Storage Backup</AlertTitle>
            <AlertDescription>
              Clicking backup will compress all files inside <code>/uploads</code> (e.g. <code>/uploads/web-settings/</code>, <code>/uploads/blog/</code>) preserving exact directory structures.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button onClick={handleStorageExport} disabled={isExportingStorage} className="font-semibold">
            {isExportingStorage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isExportingStorage ? "Zipping Images..." : "Backup All Images to ZIP"}
          </Button>
        </CardFooter>
      </Card>

      {/* STORAGE & MEDIA RESTORE CARD */}
      <Card className="border-primary/20 bg-card">
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            <FolderArchive className="mr-2 h-5 w-5 text-primary" /> Restore Media Storage & Images (ZIP)
          </CardTitle>
          <CardDescription>
            Select a previously exported ZIP backup to unpack and restore images back into their exact relative folder locations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Restore Directory Confirmation</AlertTitle>
            <AlertDescription>
              Restoring from a ZIP file will write all contained images directly back into their matching target folders inside <code>public/uploads</code>. Existing images with matching filenames will be updated.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="storage-restore-file-input">Select ZIP Storage Backup File</Label>
            <Input id="storage-restore-file-input" type="file" accept=".zip" onChange={handleStorageFileChange} disabled={isImportingStorage} />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleStorageRestore} disabled={isImportingStorage || !storageRestoreFile} variant="default" className="font-semibold">
            {isImportingStorage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            {isImportingStorage ? "Unpacking Images..." : "Restore Images from ZIP"}
          </Button>
        </CardFooter>
      </Card>

      {/* MYSQL DATABASE EXPORT CARD */}
      <Card>
        <CardHeader>
          <CardTitle>Export MySQL Database</CardTitle>
          <CardDescription>
            Download a complete snapshot of all specified database tables and collections as a single JSON file for backups or data migration.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Important Note on Exporting</AlertTitle>
              <AlertDescription>
                This tool exports all application data from Hostinger MySQL (users, scripts, settings, subscriptions, reviews, popups, and inquiries) into a single downloadable JSON backup snapshot.
              </AlertDescription>
            </Alert>
        </CardContent>
        <CardFooter>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isExporting ? "Exporting MySQL..." : "Export MySQL Database to JSON"}
          </Button>
        </CardFooter>
      </Card>

      {/* MYSQL DATABASE IMPORT CARD */}
      <Card>
        <CardHeader>
          <CardTitle>Import MySQL Database</CardTitle>
          <CardDescription>
            Restore data into Hostinger MySQL from a JSON file previously exported using this tool.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning: This Action Updates Existing Records</AlertTitle>
              <AlertDescription>
                Importing will <span className="font-bold">overwrite or update</span> existing MySQL database records with matching IDs in your target collections. It is highly recommended to perform an export backup first.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
                <Label htmlFor="import-file-input">Select JSON Backup File</Label>
                <Input id="import-file-input" type="file" accept=".json" onChange={handleFileChange} disabled={isImporting} />
            </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleImport} disabled={isImporting || !importFile}>
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            {isImporting ? "Restoring Data..." : "Import & Restore MySQL Data"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

