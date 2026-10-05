"use client";

import { useState, useEffect } from 'react';
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { ShieldAlert, KeyRound, Trash2, Loader2, Edit3, User as UserIcon, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { updateProfile, sendPasswordResetEmail, updateEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { Badge } from '@/components/ui/badge';

const updateNameSchema = z.object({
  displayName: z.string().min(2, { message: "Name must be at least 2 characters." }).max(50, "Name too long."),
});
type UpdateNameFormValues = z.infer<typeof updateNameSchema>;

const updateEmailSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});
type UpdateEmailFormValues = z.infer<typeof updateEmailSchema>;

export default function ProfilePage() {
  const { user, firestoreUser, isLoading: authIsLoading } = useAuth();
  const { toast } = useToast();
  const { isLoading: isLoadingAppSettings } = useApplicationConfig();

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [isSubmittingName, setIsSubmittingName] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [deletionRequest, setDeletionRequest] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [deletionReason, setDeletionReason] = useState("");
  const [isSubmittingDeletionRequest, setIsSubmittingDeletionRequest] = useState(false);
  const [isCancelingDeletion, setIsCancelingDeletion] = useState(false);

  const [activeTab, setActiveTab] = useState<string>("account");

  const nameForm = useForm<UpdateNameFormValues>({ resolver: zodResolver(updateNameSchema) });
  const emailForm = useForm<UpdateEmailFormValues>({ resolver: zodResolver(updateEmailSchema) });

  useEffect(() => {
    if (user && firestoreUser) {
      nameForm.reset({ displayName: firestoreUser.displayName || user.displayName || "" });
      emailForm.reset({ email: firestoreUser.email || user.email || "" });
      setIsLoadingData(false);
    } else if (!authIsLoading && !user) {
      setIsLoadingData(false);
    }
  }, [user, firestoreUser, authIsLoading, nameForm, emailForm]);

  useEffect(() => {
    if (user?.uid) {
      fetch(`/api/db/collections?name=accountDeletionRequests&id=${user.uid}`)
        .then(res => res.json())
        .then(json => {
          if (json.success && json.data) {
            setDeletionRequest(json.data);
          } else {
            setDeletionRequest(null);
          }
        })
        .catch(() => setDeletionRequest(null));
    } else {
      setDeletionRequest(null);
    }
  }, [user]);

  const handleUpdateName = async (values: UpdateNameFormValues) => {
    if (!user || !auth.currentUser) return;
    setIsSubmittingName(true);
    try {
      await updateProfile(auth.currentUser, { displayName: values.displayName });
      await fetch('/api/db/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.uid, displayName: values.displayName })
      });
      toast({ title: "Success", description: "Your name has been updated." });
      setIsNameDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not update name.", variant: "destructive" });
    } finally {
      setIsSubmittingName(false);
    }
  };
  
  const handleUpdateEmail = async (values: UpdateEmailFormValues) => {
    if (!user || !auth.currentUser) return;
    setIsSubmittingEmail(true);
    try {
      await updateEmail(auth.currentUser, values.email); 
      await fetch('/api/db/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.uid, email: values.email })
      });
      toast({ title: "Email Updated", description: "A verification link has been sent to your new email address." });
      setIsEmailDialogOpen(false);
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
         toast({ title: "Action Requires Recent Login", description: "Please log out and log back in to update your email.", variant: "destructive" });
      } else {
         toast({ title: "Error", description: error.message || "Could not update email.", variant: "destructive" });
      }
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    const emailToUse = user?.email || firestoreUser?.email;
    if (!emailToUse) {
      toast({ title: "Email Required", description: "You must have an email address set to change your password.", variant: "destructive" });
      return;
    }
    setIsSendingResetEmail(true);
    try {
      await sendPasswordResetEmail(auth, emailToUse);
      toast({ title: "Password Reset Email Sent", description: "Check your inbox for a password reset link." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  const handleCancelDeletionRequest = async () => {
    if (!user) return;
    setIsCancelingDeletion(true);
    try {
      await fetch(`/api/db/collections?name=accountDeletionRequests&id=${user.uid}`, { method: 'DELETE' });
      setDeletionRequest(null);
      toast({
        title: "Deletion Request Cancelled",
        description: "Your deletion request has been cancelled successfully."
      });
    } catch (error: any) {
      toast({
        title: "Cancellation failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsCancelingDeletion(false);
    }
  };

  const handleDeleteRequestSubmit = async () => {
    if (!user) return;
    setIsSubmittingDeletionRequest(true);

    try {
      const payload = {
        userId: user.uid,
        userEmail: user.email || firestoreUser?.email || "",
        displayName: firestoreUser?.displayName || "User",
        reason: deletionReason,
        status: 'pending',
        requestedAt: new Date().toISOString()
      };
      await fetch('/api/db/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionName: 'accountDeletionRequests', id: user.uid, data: payload })
      });
      setDeletionRequest(payload);

      toast({
        title: "Deletion Request Submitted",
        description: "Your account will be deleted permanently in 3 working days."
      });
      
      setIsDeleteDialogOpen(false);
      setIsSuccessDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmittingDeletionRequest(false);
    }
  };

  if (authIsLoading || isLoadingData || isLoadingAppSettings || !user) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        
        {/* Dynamic & Premium Page Header */}
        <div className="space-y-1.5 mb-8">
          <div className="flex items-center space-x-2 text-primary">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">User Settings</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight">
            Profile Settings
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Manage your personal profile credentials and security settings.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger id="tab-trigger-account" value="account" className="flex items-center justify-center gap-1.5 relative">
              <UserIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Profile Setting</span>
              <span className="sm:hidden">Profile</span>
            </TabsTrigger>
            <TabsTrigger id="tab-trigger-security" value="security" className="flex items-center justify-center gap-1.5 relative">
              <ShieldAlert className="h-4 w-4" />
              <span>Security</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="account" className="space-y-6">
            <Card className="border-primary/10 shadow-md">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-primary" /> User Account Details
                </CardTitle>
                <CardDescription>Manage your Screenplay Pro account profile information.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-secondary/10 rounded-2xl border border-primary/5">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold">Display Name</p>
                    <p className="text-sm font-semibold">{user?.displayName || firestoreUser?.displayName || 'User'}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsNameDialogOpen(true)}>
                    <Edit3 className="h-4 w-4 mr-1" /> Edit
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-secondary/10 rounded-2xl border border-primary/5">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold">Email Address</p>
                    <p className="text-sm font-semibold">{user?.email || firestoreUser?.email || 'N/A'}</p>
                  </div>
                  {user?.emailVerified ? (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">Verified</Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">Unverified</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card className="border-primary/10 shadow-md">
              <CardHeader>
                <CardTitle className="text-xl">Account Security</CardTitle>
                <CardDescription>Manage your account password and data deletion preferences.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <Button variant="outline" onClick={handleChangePassword} disabled={isSendingResetEmail}>
                    {isSendingResetEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                    Change Password
                  </Button>

                  {!deletionRequest && (
                    <Button 
                      variant="destructive" 
                      className="sm:ml-auto" 
                      onClick={() => {
                        setDeletionReason("");
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Account
                    </Button>
                  )}
                </div>

                {deletionRequest && (
                  <div className="p-5 rounded-2xl bg-destructive/10 border border-destructive/20 text-foreground flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-destructive/20 flex items-center justify-center text-destructive shrink-0">
                      <Trash2 className="h-5 w-5" />
                    </div>
                    <div className="space-y-1 flex-1 text-left">
                      <h4 className="font-bold text-sm text-destructive leading-normal">Account Deletion Requested</h4>
                      <p className="text-xs text-muted-foreground leading-normal">
                        Your account is scheduled for deletion. It will be deleted permanently in 3 working days.
                      </p>
                      {deletionRequest.reason && (
                        <p className="text-[11px] text-muted-foreground italic leading-normal pt-1">
                          Reason: "{deletionRequest.reason}"
                        </p>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCancelDeletionRequest} 
                      disabled={isCancelingDeletion}
                      className="rounded-xl border-primary/10 hover:bg-primary/5 text-xs font-bold shrink-0 self-end sm:self-center bg-background"
                    >
                      {isCancelingDeletion && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      Cancel Request
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Name Dialog */}
      <Dialog open={isNameDialogOpen} onOpenChange={setIsNameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Your Name</DialogTitle>
            <DialogDescription>Enter your new display name.</DialogDescription>
          </DialogHeader>
          <Form {...nameForm}>
            <form onSubmit={nameForm.handleSubmit(handleUpdateName)} className="space-y-4 py-2">
              <FormField control={nameForm.control} name="displayName" render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="displayName">Full Name</FormLabel>
                  <FormControl><Input id="displayName" {...field} disabled={isSubmittingName} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingName}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmittingName}>{isSubmittingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Email</DialogTitle>
            <DialogDescription>Enter your new email address.</DialogDescription>
          </DialogHeader>
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(handleUpdateEmail)} className="space-y-4 py-2">
              <FormField control={emailForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="email">Email</FormLabel>
                  <FormControl><Input type="email" id="email" {...field} disabled={isSubmittingEmail} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingEmail}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmittingEmail}>{isSubmittingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update Email</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-[480px] p-6 rounded-3xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Account Request
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm pt-2">
              Please enter the reason for deleting your profile. Once submitted, your deletion request will be processed by administrators, and your account will be permanently deleted in <strong>3 working days</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label htmlFor="deletion-reason" className="text-xs font-black text-foreground uppercase tracking-wider block mb-2">Reason for leaving</label>
            <textarea
              id="deletion-reason"
              className="w-full min-h-[100px] p-4 rounded-2xl bg-secondary/30 border border-primary/10 focus:border-primary/30 outline-none text-sm leading-relaxed text-foreground resize-none"
              placeholder="Please tell us why you wish to delete your account..."
              value={deletionReason}
              onChange={(e) => setDeletionReason(e.target.value)}
            />
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto rounded-xl font-bold border-primary/10 text-muted-foreground" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              className="w-full sm:w-auto rounded-xl font-bold flex-1" 
              onClick={handleDeleteRequestSubmit}
              disabled={isSubmittingDeletionRequest || !deletionReason.trim()}
            >
              {isSubmittingDeletionRequest && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Delete Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deletion Request Success Confirmation Dialog */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-[440px] p-6 rounded-3xl shadow-2xl text-center flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-center text-foreground">
                Request Pending
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm text-center pt-1">
                Your deletion request has been submitted. Your account will be deleted permanently in <strong>3 working days</strong>.
              </DialogDescription>
            </DialogHeader>
          </div>
          <Button className="w-full rounded-xl font-bold bg-primary text-white hover:bg-primary/90 mt-2" onClick={() => setIsSuccessDialogOpen(false)}>
            Understood
          </Button>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}
