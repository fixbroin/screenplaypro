"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Database, UploadCloud, Download, Loader2, AlertTriangle } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Database className="mr-2 h-6 w-6 text-primary" /> Hostinger MySQL Database Tools
          </CardTitle>
          <CardDescription>
            Export your entire Hostinger MySQL database snapshot to a JSON backup file or import a previously exported database snapshot.
          </CardDescription>
        </CardHeader>
      </Card>

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

