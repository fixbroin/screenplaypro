"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Edit, Trash2, CheckCircle, PackageSearch, Loader2, Send, Eye } from 'lucide-react';
import type { FirestoreContactUsInquiry, FirestorePopupInquiry, InquiryStatus } from '@/types/firestore';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/hooks/useAuth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter as AlertDialogFooterComponent, AlertDialogHeader, AlertDialogTitle as AlertDialogTitleComponent, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { sendInquiryReplyEmail, type InquiryReplyEmailInput } from '@/ai/flows/sendInquiryReplyEmailFlow';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import InquiryDetailsModal from '@/components/admin/InquiryDetailsModal';
import { getTimestampMillis } from '@/lib/utils';

type Inquiry = FirestoreContactUsInquiry | FirestorePopupInquiry;
type InquiryType = 'contact' | 'popup';

const formatTimestamp = (timestamp?: any): string => {
  const millis = getTimestampMillis(timestamp);
  if (!millis) return 'N/A';
  return new Date(millis).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function AdminInquiriesPage() {
  const [contactInquiries, setContactInquiries] = useState<FirestoreContactUsInquiry[]>([]);
  const [popupInquiries, setPopupInquiries] = useState<FirestorePopupInquiry[]>([]);
  const [isLoadingContact, setIsLoadingContact] = useState(true);
  const [isLoadingPopup, setIsLoadingPopup] = useState(true);

  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false);
  const [selectedInquiryForReply, setSelectedInquiryForReply] = useState<Inquiry | null>(null);
  const [selectedInquiryType, setSelectedInquiryType] = useState<InquiryType | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedInquiryForDetails, setSelectedInquiryForDetails] = useState<Inquiry | null>(null);

  const { toast } = useToast();
  const { user: adminUser } = useAuth();
  const { config: appConfig, isLoading: isLoadingAppSettings } = useApplicationConfig();

  const fetchInquiries = useCallback(async () => {
    setIsLoadingContact(true);
    setIsLoadingPopup(true);
    try {
      const [resContact, resPopup] = await Promise.all([
        fetch('/api/db/collections?name=contactUsSubmissions'),
        fetch('/api/db/collections?name=popupSubmissions')
      ]);
      const jsonContact = await resContact.json();
      const jsonPopup = await resPopup.json();

      if (jsonContact.success && Array.isArray(jsonContact.data)) {
        setContactInquiries(jsonContact.data);
      }
      if (jsonPopup.success && Array.isArray(jsonPopup.data)) {
        setPopupInquiries(jsonPopup.data);
      }
    } catch (error) {
      console.error("Error fetching inquiries:", error);
    } finally {
      setIsLoadingContact(false);
      setIsLoadingPopup(false);
    }
  }, []);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const handleViewDetails = (inquiry: Inquiry, type: InquiryType) => {
    setSelectedInquiryForDetails(inquiry);
    setSelectedInquiryType(type);
    setIsDetailsModalOpen(true);
  };

  const handleOpenReplyDialog = (inquiry: Inquiry, type: InquiryType) => {
    setSelectedInquiryForReply(inquiry);
    setSelectedInquiryType(type);
    setReplyMessage(inquiry.replyMessage || "");
    setIsReplyDialogOpen(true);
  };

  const handleSendReply = async () => {
    if (!selectedInquiryForReply || !selectedInquiryType || !selectedInquiryForReply.id || !selectedInquiryForReply.email) {
      toast({ title: "Error", description: "Missing inquiry data or user email for reply.", variant: "destructive" });
      return;
    }
    setIsSubmittingReply(true);
    const collectionName = selectedInquiryType === 'contact' ? "contactUsSubmissions" : "popupSubmissions";

    try {
      const updatedInquiry = {
        ...selectedInquiryForReply,
        replyMessage: replyMessage,
        repliedAt: new Date().toISOString(),
        repliedByAdminUid: adminUser?.uid || 'admin',
        status: 'replied' as InquiryStatus,
      };

      await fetch('/api/db/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionName, id: selectedInquiryForReply.id, data: updatedInquiry })
      });

      toast({ title: "Reply Saved", description: "Your reply has been saved to MySQL." });

      const originalMessageSummary = selectedInquiryType === 'contact' 
        ? (selectedInquiryForReply as FirestoreContactUsInquiry).message 
        : `Popup: ${(selectedInquiryForReply as FirestorePopupInquiry).popupName}`;

      const emailInput: InquiryReplyEmailInput = {
        inquiryId: selectedInquiryForReply.id,
        inquiryType: selectedInquiryType,
        userName: selectedInquiryForReply.name || "Valued User",
        userEmail: selectedInquiryForReply.email,
        originalMessage: originalMessageSummary,
        replyMessage: replyMessage,
        adminName: adminUser?.displayName || "Screenplay Pro Support",
        smtpHost: appConfig.smtpHost,
        smtpPort: appConfig.smtpPort,
        smtpUser: appConfig.smtpUser,
        smtpPass: appConfig.smtpPass,
        senderEmail: appConfig.senderEmail,
      };

      const emailResult = await sendInquiryReplyEmail(emailInput);
      if (emailResult.success) {
        toast({ title: "Email Sent", description: "Reply email sent to the user." });
      } else {
        toast({ title: "Email Failed", description: emailResult.message || "Could not send reply email.", variant: "destructive" });
      }

      setIsReplyDialogOpen(false);
      setReplyMessage("");
      setSelectedInquiryForReply(null);
      fetchInquiries();
    } catch (error) {
      console.error("Error sending reply:", error);
      toast({ title: "Error", description: "Could not save reply or send email.", variant: "destructive" });
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleMarkAsResolved = async (inquiryId: string, type: InquiryType) => {
    const collectionName = type === 'contact' ? "contactUsSubmissions" : "popupSubmissions";
    try {
      const targetList = type === 'contact' ? contactInquiries : popupInquiries;
      const targetItem = targetList.find(i => i.id === inquiryId);
      if (targetItem) {
        const updated = { ...targetItem, status: 'resolved' as InquiryStatus, updatedAt: new Date().toISOString() };
        await fetch('/api/db/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collectionName, id: inquiryId, data: updated })
        });
        toast({ title: "Inquiry Resolved", description: "Marked as resolved." });
        fetchInquiries();
      }
    } catch (error) {
      toast({ title: "Error", description: "Could not update status.", variant: "destructive" });
    }
  };
  
  const handleDeleteInquiry = async (inquiryId: string, type: InquiryType) => {
    const collectionName = type === 'contact' ? "contactUsSubmissions" : "popupSubmissions";
    try {
      await fetch(`/api/db/collections?name=${collectionName}&id=${inquiryId}`, { method: 'DELETE' });
      toast({ title: "Inquiry Deleted", description: "The inquiry has been removed." });
      fetchInquiries();
    } catch (error) {
      toast({ title: "Error", description: "Could not delete inquiry.", variant: "destructive" });
    }
  };

  const getStatusBadgeVariant = (status: InquiryStatus) => {
    switch (status) {
      case 'new': return 'destructive';
      case 'replied': return 'secondary';
      case 'resolved': return 'default';
      default: return 'outline';
    }
  };

  const renderInquiriesTable = (inquiries: Inquiry[], type: InquiryType, isLoadingTable: boolean) => {
    if (isLoadingTable || isLoadingAppSettings) {
      return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading inquiries...</span></div>;
    }
    if (inquiries.length === 0) {
      return <div className="text-center py-10"><PackageSearch className="h-12 w-12 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">No inquiries found in this category.</p></div>;
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User / Contact</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>Submitted At</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inquiries.map((inquiry) => (
            <TableRow key={inquiry.id}>
              <TableCell>
                <div className="font-semibold text-foreground">{inquiry.name || 'N/A'}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3" /> {inquiry.email}</div>
                {inquiry.phone && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" /> {inquiry.phone}</div>}
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {type === 'contact' 
                  ? (inquiry as FirestoreContactUsInquiry).message 
                  : `Popup: ${(inquiry as FirestorePopupInquiry).popupName}`
                }
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatTimestamp(inquiry.submittedAt)}</TableCell>
              <TableCell><Badge variant={getStatusBadgeVariant(inquiry.status)}>{inquiry.status}</Badge></TableCell>
              <TableCell className="text-right space-x-1">
                <Button variant="outline" size="sm" onClick={() => handleViewDetails(inquiry, type)} title="View Full Details"><Eye className="h-4 w-4"/></Button>
                <Button variant="outline" size="sm" onClick={() => handleOpenReplyDialog(inquiry, type)} title="Reply"><Edit className="h-4 w-4"/></Button>
                {inquiry.status !== 'resolved' && (
                  <Button variant="ghost" size="sm" onClick={() => handleMarkAsResolved(inquiry.id!, type)} title="Mark Resolved"><CheckCircle className="h-4 w-4 text-green-600"/></Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitleComponent>Delete Inquiry?</AlertDialogTitleComponent><AlertDialogDescriptionComponent>Are you sure?</AlertDialogDescriptionComponent></AlertDialogHeader>
                    <AlertDialogFooterComponent><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteInquiry(inquiry.id!, type)} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooterComponent>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-3xl font-black">Customer Inquiries</CardTitle>
          <CardDescription>Manage user submissions from contact forms and marketing popups.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="contact">
            <TabsList className="mb-4">
              <TabsTrigger value="contact">Contact Form Submissions ({contactInquiries.length})</TabsTrigger>
              <TabsTrigger value="popup">Popup Submissions ({popupInquiries.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="contact">{renderInquiriesTable(contactInquiries, 'contact', isLoadingContact)}</TabsContent>
            <TabsContent value="popup">{renderInquiriesTable(popupInquiries, 'popup', isLoadingPopup)}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Reply Dialog */}
      <Dialog open={isReplyDialogOpen} onOpenChange={setIsReplyDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to {selectedInquiryForReply?.name || selectedInquiryForReply?.email}</DialogTitle>
            <DialogDescription>Send an email reply to the customer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              placeholder="Write your response here..."
              rows={5}
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isSubmittingReply}>Cancel</Button></DialogClose>
            <Button onClick={handleSendReply} disabled={isSubmittingReply || !replyMessage.trim()}>
              {isSubmittingReply && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" /> Send Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      {selectedInquiryForDetails && isDetailsModalOpen && (
        <InquiryDetailsModal
          inquiry={selectedInquiryForDetails}
          inquiryType={selectedInquiryType!}
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
        />
      )}
    </div>
  );
}
