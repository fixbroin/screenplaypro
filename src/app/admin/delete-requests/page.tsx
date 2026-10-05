"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, ShieldAlert, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from 'date-fns';
import { getTimestampMillis } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeletionRequest {
  id: string; // doc ID is userId
  userId: string;
  userEmail: string;
  displayName: string;
  reason: string;
  status: string;
  requestedAt?: any;
}

export default function AdminDeleteRequestsPage() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    // Set up a real-time listener for deletion requests
    const q = query(collection(db, "accountDeletionRequests"), orderBy("requestedAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRequests = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as DeletionRequest));
      setRequests(fetchedRequests);
      setIsLoading(false);
    }, (error) => {
      console.error("Error listening to deletion requests: ", error);
      toast({
        title: "Error loading requests",
        description: error.message,
        variant: "destructive"
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const handleApproveDeletion = async (targetUserId: string) => {
    if (!user) return;
    setIsProcessing(targetUserId);

    try {
      // Fetch JWT ID Token for secure admin call
      const token = await user.getIdToken();

      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to process user deletion");
      }

      toast({
        title: "Account Deleted Successfully",
        description: "The user account and all matching records have been wiped.",
      });

    } catch (error: any) {
      console.error("Error deleting user: ", error);
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRejectRequest = async (targetUserId: string) => {
    setIsProcessing(targetUserId);
    try {
      await deleteDoc(doc(db, "accountDeletionRequests", targetUserId));
      toast({
        title: "Request Rejected",
        description: "The deletion request has been removed. The user account is safe.",
      });
    } catch (error: any) {
      console.error("Error rejecting request: ", error);
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(null);
    }
  };

  const formatRequestDate = (timestamp?: any) => {
    const millis = getTimestampMillis(timestamp);
    if (!millis) return 'N/A';
    return new Date(millis).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  };

  const formatDistance = (timestamp?: any) => {
    const millis = getTimestampMillis(timestamp);
    if (!millis) return '';
    return formatDistanceToNow(new Date(millis), { addSuffix: true });
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Trash2 className="h-8 w-8 text-destructive" />
          Delete Requests
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage user requests for permanent account and data deletion.
        </p>
      </div>

      <Card className="border-border/40 shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Pending Requests ({requests.length})
          </CardTitle>
          <CardDescription>
            Approved deletions are permanent and will completely erase user auth details and Firestore entries.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col justify-center items-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-xs uppercase font-black tracking-widest">Loading requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col justify-center items-center py-20 gap-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <div className="space-y-1">
                <p className="font-bold text-foreground">All Clean!</p>
                <p className="text-xs text-muted-foreground max-w-sm">No users have requested account deletion at this time.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">User / Artist</TableHead>
                    <TableHead className="font-bold">Date Requested</TableHead>
                    <TableHead className="font-bold">Reason for Deletion</TableHead>
                    <TableHead className="font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id} className="hover:bg-muted/30">
                      <TableCell className="align-top py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-foreground text-sm">{request.displayName}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{request.userEmail}</span>
                          <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">UID: {request.userId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-4 text-sm text-slate-600 dark:text-slate-300">
                        <div className="flex flex-col">
                          <span>{formatRequestDate(request.requestedAt)}</span>
                          <span className="text-xs text-muted-foreground font-semibold">{formatDistance(request.requestedAt)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-4 max-w-xs md:max-w-md">
                        <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {request.reason || <span className="italic opacity-60">No reason specified.</span>}
                        </div>
                      </TableCell>
                      <TableCell className="align-top py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-9 px-3 rounded-xl text-xs font-bold border-primary/10 hover:bg-destructive/10 hover:text-destructive transition-colors"
                                disabled={isProcessing !== null}
                              >
                                {isProcessing === request.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 mr-1" />
                                )}
                                Reject Request
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reject Deletion Request?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will dismiss the deletion request for <strong>{request.displayName}</strong>. Their account will remain fully active and their data untouched.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleRejectRequest(request.userId)}
                                  className="bg-primary hover:bg-primary/90"
                                >
                                  Confirm Dismissal
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                className="h-9 px-3 rounded-xl text-xs font-bold shadow-md"
                                disabled={isProcessing !== null}
                              >
                                {isProcessing === request.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                                )}
                                Delete Account
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-destructive flex items-center gap-2">
                                  <AlertTriangle className="h-5 w-5" />
                                  Permanently Delete Account?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action is <strong>irreversible</strong>. This will completely delete the user authentication record for <strong>{request.displayName} ({request.userEmail})</strong> and permanently wipe their database profile records.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleApproveDeletion(request.userId)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Yes, Permanently Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
