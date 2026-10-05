
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { PlusCircle, Edit, Trash2, Loader2, Megaphone, CheckCircle, XCircle, Eye } from "lucide-react";
import type { FirestorePopup } from '@/types/firestore';
import PopupForm from '@/components/admin/PopupForm';
import { deleteLocalImage } from '@/lib/fileUploadUtils';
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';

const isFirebaseStorageUrl = (url: string | null | undefined): boolean => !!url && typeof url === 'string' && url.includes("firebasestorage.googleapis.com");

export default function AdminNewsletterPopupsPage() {
  const [popups, setPopups] = useState<FirestorePopup[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPopup, setEditingPopup] = useState<FirestorePopup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchPopups = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/db/collections?name=adminPopups');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setPopups(json.data as FirestorePopup[]);
      }
    } catch (error) {
      console.error("Error fetching popups from MySQL: ", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPopups();
  }, []);

  const handleAddPopup = () => {
    setEditingPopup(null);
    setIsFormOpen(true);
  };

  const handleEditPopup = (popup: FirestorePopup) => {
    setEditingPopup(popup);
    setIsFormOpen(true);
  };

  const handleDeletePopup = async (popupId: string) => {
    setIsSubmitting(true);
    try {
      const target = popups.find(p => p.id === popupId);
      if (target?.imageUrl) {
        await deleteLocalImage(target.imageUrl);
      }
      await fetch(`/api/db/collections?name=adminPopups&id=${popupId}`, { method: 'DELETE' });
      setPopups(popups.filter(p => p.id !== popupId));
      toast({ title: "Success", description: "Popup deleted from MySQL successfully." });
    } catch (error: any) {
      console.error("Error deleting popup: ", error);
      toast({ title: "Error", description: "Could not delete popup. " + (error.message || ""), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleToggleActive = async (popup: FirestorePopup) => {
    setIsSubmitting(true);
    try {
      const updated = { ...popup, isActive: !popup.isActive, updatedAt: new Date().toISOString() };
      await fetch('/api/db/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionName: 'adminPopups', id: popup.id, data: updated })
      });
      await fetchPopups();
      toast({ title: "Status Updated", description: `Popup "${popup.name}" ${!popup.isActive ? "activated" : "deactivated"}.`});
    } catch (error: any) {
      console.error("Error toggling popup status:", error);
      toast({ title: "Error", description: "Could not update popup status.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (data: Omit<FirestorePopup, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    setIsSubmitting(true);
    const docId = data.id || `pop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const fullData = {
      ...data,
      id: docId,
      updatedAt: new Date().toISOString(),
      ...(data.id ? {} : { createdAt: new Date().toISOString() })
    };

    try {
      await fetch('/api/db/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionName: 'adminPopups', id: docId, data: fullData })
      });

      toast({ title: "Success", description: data.id ? "Popup updated in MySQL." : "Popup created in MySQL." });
      setIsFormOpen(false);
      setEditingPopup(null);
      fetchPopups();
    } catch (error: any) {
      console.error("Error saving popup: ", error);
      toast({ title: "Error", description: (error.message || "Could not save popup."), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-2xl flex items-center"><Megaphone className="mr-2 h-6 w-6 text-primary" />Newsletter & Marketing Popups</CardTitle>
            <CardDescription>Manage various popups for your website to engage users and promote offers.</CardDescription>
          </div>
          <Button onClick={handleAddPopup} disabled={isSubmitting || isLoading} className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Popup
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading popups...</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name (Internal)</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {popups.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No popups configured yet.</TableCell></TableRow>
                ) : (
                  popups.map((popup) => (
                    <TableRow key={popup.id}>
                      <TableCell className="font-medium">{popup.name}</TableCell>
                      <TableCell><Badge variant="secondary">{popup.popupType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Badge></TableCell>
                      <TableCell className="max-w-xs truncate" title={popup.title}>{popup.title || "N/A"}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={popup.isActive} onCheckedChange={() => handleToggleActive(popup)} disabled={isSubmitting} aria-label={`Toggle active status for ${popup.name}`} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-2 sm:justify-end">
                          <Button variant="outline" size="icon" onClick={() => handleEditPopup(popup)} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="destructive" size="icon" disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the popup "{popup.name}".</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeletePopup(popup.id)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!isSubmitting) { setIsFormOpen(open); if (!open) setEditingPopup(null); } }}>
        <DialogContent className="w-[90vw] max-w-lg md:max-w-2xl lg:max-w-3xl max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="p-2 pb-4 border-b sticky top-0 bg-background z-10">
            <DialogTitle>{editingPopup ? 'Edit Popup' : 'Add New Popup'}</DialogTitle>
            <DialogDescription>{editingPopup ? 'Update configuration for this popup.' : 'Fill in details to create a new website popup.'}</DialogDescription>
          </DialogHeader>
          <PopupForm 
            key={editingPopup?.id || 'new-popup'}
            onSubmit={handleFormSubmit} 
            initialData={editingPopup} 
            onCancel={() => { setIsFormOpen(false); setEditingPopup(null); }} 
            isSubmitting={isSubmitting} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
