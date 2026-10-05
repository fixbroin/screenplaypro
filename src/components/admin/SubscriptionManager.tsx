"use client";

import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, Loader2, Check, X, 
  IndianRupee, Calendar, ListChecks, Sparkles, FileText, Download, ShieldCheck, RefreshCw,
  Users, Mail, Phone, Search, AlertCircle, Copy, CheckCircle2, XCircle
} from 'lucide-react';
import { 
  collection, query, getDocs, addDoc, updateDoc, 
  deleteDoc, doc, orderBy, Timestamp, setDoc, where 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SubscriptionPlan, FirestoreUser } from '@/types/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DEFAULT_SCREENPLAY_PLANS: Partial<SubscriptionPlan>[] = [
  {
    name: 'Monthly Writer Pass',
    price: 299,
    durationDays: 30,
    isActive: true,
    order: 1,
    features: [
      'Unlimited PDF Script Exports',
      'Studio-Standard Screenplay Formatting',
      'Multi-Language Script Typing',
      'Real-Time Cloud Autosave',
      'Standard Export Quality'
    ]
  },
  {
    name: 'Annual Pro Pass',
    price: 1999,
    durationDays: 365,
    isActive: true,
    order: 2,
    features: [
      'Unlimited PDF Script Exports (Save 45%)',
      'Studio-Standard Screenplay Formatting',
      'Multi-Language Script Typing & AI Translation',
      'Priority High-Speed PDF Rendering',
      'Real-Time Cloud Autosave & Backup',
      'Priority Writer Support'
    ]
  },
  {
    name: 'Lifetime Writer Pass',
    price: 4999,
    durationDays: 3650,
    isActive: true,
    order: 3,
    features: [
      'Lifetime Unlimited PDF Downloads',
      'All Future AI Script Tools Included',
      'Priority High-Speed Rendering',
      'Multi-Language Translation Engine',
      'VIP Support'
    ]
  }
];

export interface SubscriberUser extends FirestoreUser {
  id: string;
  isExpired: boolean;
  formattedStartDate: string;
  formattedExpiryDate: string;
}

export default function SubscriptionManager() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  
  // Subscribed People state
  const [subscribers, setSubscribers] = useState<SubscriberUser[]>([]);
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [sendingEmailUserId, setSendingEmailUserId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    price: 299,
    durationDays: 30,
    features: [''],
    isActive: true,
    order: 1
  });

  const { toast } = useToast();

  useEffect(() => {
    fetchPlans();
    fetchSubscribers();
  }, []);

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/db/subscription-plans');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.plans)) {
          setPlans(data.plans);
          setIsLoading(false);
          return;
        }
      }

      // Fallback to Firestore if empty
      const plansRef = collection(db, 'adminSubscriptionPlans');
      const q = query(plansRef, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      const fetchedPlans = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as SubscriptionPlan));
      setPlans(fetchedPlans);
    } catch (error) {
      console.error("Error fetching plans:", error);
      toast({ title: "Error", description: "Failed to load subscription plans.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubscribers = async () => {
    setIsLoadingSubscribers(true);
    try {
      const res = await fetch('/api/db/subscribers');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.subscribers) && data.subscribers.length > 0) {
          setSubscribers(data.subscribers);
          setIsLoadingSubscribers(false);
          return;
        }
      }

      // Fallback to Firestore
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const now = Date.now();
      const subscriberList: SubscriberUser[] = [];

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data() as FirestoreUser;
        const hasSubscription = data.subscriptionActive || data.subscriptionPlanName || data.subscriptionExpiresAt || data.lastSubscriptionAt;

        if (hasSubscription) {
          let expiresMillis = 0;
          if (data.subscriptionExpiresAt) {
            expiresMillis = typeof (data.subscriptionExpiresAt as any).toMillis === 'function'
              ? (data.subscriptionExpiresAt as any).toMillis()
              : (data.subscriptionExpiresAt as any)?._seconds 
                ? (data.subscriptionExpiresAt as any)._seconds * 1000 
                : 0;
          }

          let startMillis = 0;
          if (data.lastSubscriptionAt) {
            startMillis = typeof (data.lastSubscriptionAt as any).toMillis === 'function'
              ? (data.lastSubscriptionAt as any).toMillis()
              : (data.lastSubscriptionAt as any)?._seconds 
                ? (data.lastSubscriptionAt as any)._seconds * 1000 
                : 0;
          }

          const isExpired = !data.subscriptionActive || (expiresMillis > 0 && now > expiresMillis);

          subscriberList.push({
            ...data,
            id: docSnap.id,
            isExpired,
            formattedStartDate: startMillis ? new Date(startMillis).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A',
            formattedExpiryDate: expiresMillis ? new Date(expiresMillis).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Lifetime / Unset'
          });
        }
      });

      setSubscribers(subscriberList);
    } catch (error) {
      console.error("Error fetching subscribers:", error);
    } finally {
      setIsLoadingSubscribers(false);
    }
  };

  const handleSendExpiryEmail = async (sub: SubscriberUser) => {
    if (!sub.email) {
      toast({ title: "Missing Email", description: "This user does not have a valid email address.", variant: "destructive" });
      return;
    }

    setSendingEmailUserId(sub.id);
    try {
      const res = await fetch('/api/admin/send-expiry-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: sub.id,
          userEmail: sub.email,
          userName: sub.displayName || 'Screenwriter',
          planName: sub.subscriptionPlanName || 'Screenplay Pro Subscription',
          expiryDate: sub.formattedExpiryDate
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Expiry Email Sent! 📧",
          description: `Renewal email sent successfully to ${sub.email}.`,
        });
      } else {
        throw new Error(data.error || 'Failed to send email.');
      }
    } catch (err: any) {
      console.error("Error sending expiry email:", err);
      toast({
        title: "Email Failed",
        description: err.message || "Could not send expiry email. Check SMTP settings.",
        variant: "destructive"
      });
    } finally {
      setSendingEmailUserId(null);
    }
  };

  const handleSeedDefaults = async () => {
    setIsSaving(true);
    try {
      const plansRef = collection(db, 'adminSubscriptionPlans');
      for (const plan of DEFAULT_SCREENPLAY_PLANS) {
        await fetch('/api/db/subscription-plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(plan)
        });
        try {
          await addDoc(plansRef, { ...plan, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
        } catch (e) {}
      }
      toast({ title: "Defaults Loaded", description: "Screenplay Pro default plans initialized in MySQL successfully." });
      await fetchPlans();
    } catch (error: any) {
      console.error("Error seeding plans:", error);
      toast({ title: "Seed Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAddDialog = () => {
    setEditingPlan(null);
    setFormData({
      name: '',
      price: 299,
      durationDays: 30,
      features: ['Unlimited PDF Script Exports', 'Studio-Standard Formatting', 'Real-Time Cloud Autosave'],
      isActive: true,
      order: plans.length + 1
    });
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      price: plan.price,
      durationDays: plan.durationDays,
      features: plan.features && plan.features.length > 0 ? [...plan.features] : [''],
      isActive: plan.isActive ?? true,
      order: plan.order ?? 1
    });
    setIsDialogOpen(true);
  };

  const handleAddFeature = () => {
    setFormData({ ...formData, features: [...formData.features, ''] });
  };

  const handleRemoveFeature = (index: number) => {
    const updated = formData.features.filter((_, i) => i !== index);
    setFormData({ ...formData, features: updated });
  };

  const handleFeatureChange = (index: number, value: string) => {
    const updated = [...formData.features];
    updated[index] = value;
    setFormData({ ...formData, features: updated });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Required", description: "Please enter a plan name.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const cleanedFeatures = formData.features.map(f => f.trim()).filter(Boolean);
      
      const payload = {
        id: editingPlan?.id,
        name: formData.name.trim(),
        price: Number(formData.price),
        durationDays: Number(formData.durationDays),
        features: cleanedFeatures,
        isActive: formData.isActive,
        order: Number(formData.order)
      };

      await fetch('/api/db/subscription-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      try {
        if (editingPlan) {
          await updateDoc(doc(db, 'adminSubscriptionPlans', editingPlan.id), { ...payload, updatedAt: Timestamp.now() });
        } else {
          await addDoc(collection(db, 'adminSubscriptionPlans'), { ...payload, createdAt: Timestamp.now() });
        }
      } catch (e) {}

      toast({ title: "Success", description: editingPlan ? "Subscription plan updated in MySQL." : "New subscription plan created in MySQL." });

      setIsDialogOpen(false);
      fetchPlans();
    } catch (error: any) {
      console.error("Error saving plan:", error);
      toast({ title: "Error", description: error.message || "Failed to save plan.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subscription plan?")) return;
    try {
      await fetch(`/api/db/subscription-plans?id=${id}`, { method: 'DELETE' });
      try { await deleteDoc(doc(db, 'adminSubscriptionPlans', id)); } catch (e) {}
      toast({ title: "Deleted", description: "Plan removed from MySQL." });
      fetchPlans();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Filtered subscribers list
  const filteredSubscribers = subscribers.filter(sub => {
    const matchesSearch = 
      (sub.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.mobileNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.id || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'active') return !sub.isExpired;
    if (filterStatus === 'expired') return sub.isExpired;
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* HEADER CARD */}
      <Card className="border-primary/10 shadow-sm bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-black uppercase tracking-widest">Admin Management</span>
              </div>
              <h1 className="text-3xl font-headline font-black tracking-tight">Screenplay Pro Subscriptions</h1>
              <p className="text-muted-foreground text-sm">
                Manage writer subscription plans, pricing, features, and view subscribed members.
              </p>
            </div>

            {plans.length === 0 && !isLoading && (
              <Button onClick={handleSeedDefaults} disabled={isSaving} className="rounded-xl font-bold">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                1-Click Seed Default Plans
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="plans" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 max-w-md">
          <TabsTrigger value="plans" className="font-bold flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Subscription Plans ({plans.length})
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="font-bold flex items-center gap-2">
            <Users className="h-4 w-4" /> Subscribed People ({subscribers.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SUBSCRIPTION PLANS */}
        <TabsContent value="plans" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black tracking-tight">Active Subscription Plans</h2>
            <Button onClick={handleOpenAddDialog} className="rounded-xl font-bold shadow-md">
              <Plus className="w-4 h-4 mr-2" /> Add New Plan
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : plans.length === 0 ? (
            <Card className="border-dashed p-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-bold">No Subscription Plans Found</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6">Initialize the default Screenplay Pro pricing plans with 1-click.</p>
              <Button onClick={handleSeedDefaults} disabled={isSaving} className="rounded-xl font-bold">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Initialize Default Screenplay Plans
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <Card 
                  key={plan.id} 
                  className={`relative flex flex-col justify-between rounded-3xl border-2 transition-all duration-300 hover:shadow-xl ${
                    plan.isActive ? 'border-primary/20 bg-card' : 'border-dashed border-muted-foreground/30 opacity-70 bg-muted/20'
                  }`}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant={plan.isActive ? "default" : "secondary"} className="rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-wider">
                        {plan.isActive ? "Active" : "Disabled"}
                      </Badge>
                      <span className="text-xs font-bold text-muted-foreground">Order: #{plan.order}</span>
                    </div>
                    <CardTitle className="text-2xl font-black">{plan.name}</CardTitle>
                    <CardDescription className="text-xs font-medium">
                      {plan.durationDays === 3650 ? 'Lifetime Access' : `${plan.durationDays} Days Duration`}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6 flex-grow">
                    <div className="flex items-baseline space-x-1">
                      <span className="text-4xl font-black tracking-tight text-primary">₹{plan.price}</span>
                      <span className="text-xs font-bold text-muted-foreground">/ plan</span>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Included Features:</p>
                      <ul className="space-y-2">
                        {plan.features?.map((feat, idx) => (
                          <li key={idx} className="flex items-start text-xs font-medium">
                            <Check className="w-4 h-4 mr-2 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>

                  <div className="p-6 pt-0 flex gap-2">
                    <Button 
                      variant="outline" 
                      className="w-full rounded-xl font-bold border-primary/20 hover:bg-primary/5"
                      onClick={() => handleOpenEditDialog(plan)}
                    >
                      <Edit className="w-4 h-4 mr-2" /> Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="rounded-xl text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleDelete(plan.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: SUBSCRIBED PEOPLE */}
        <TabsContent value="subscribers" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-black tracking-tight">Subscribed People</h2>
              <p className="text-xs text-muted-foreground">
                View all screenwriters who have subscribed, track active/expired plans, and trigger renewal emails.
              </p>
            </div>

            <Button variant="outline" size="sm" onClick={fetchSubscribers} disabled={isLoadingSubscribers} className="rounded-xl font-bold">
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingSubscribers ? 'animate-spin' : ''}`} /> Refresh Subscribers
            </Button>
          </div>

          {/* CONTROLS & SEARCH */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, mobile, or profile ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-2xl border-primary/10 text-xs font-medium"
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant={filterStatus === 'all' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setFilterStatus('all')}
                className="rounded-xl text-xs font-bold flex-1 sm:flex-initial"
              >
                All ({subscribers.length})
              </Button>
              <Button 
                variant={filterStatus === 'active' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setFilterStatus('active')}
                className="rounded-xl text-xs font-bold flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Active ({subscribers.filter(s => !s.isExpired).length})
              </Button>
              <Button 
                variant={filterStatus === 'expired' ? 'destructive' : 'outline'} 
                size="sm" 
                onClick={() => setFilterStatus('expired')}
                className="rounded-xl text-xs font-bold flex-1 sm:flex-initial"
              >
                Expired ({subscribers.filter(s => s.isExpired).length})
              </Button>
            </div>
          </div>

          {/* SUBSCRIBERS TABLE / CARDS */}
          {isLoadingSubscribers ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredSubscribers.length === 0 ? (
            <Card className="border-dashed p-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-40" />
              <h3 className="text-lg font-bold">No Subscribed Users Found</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery ? "No subscribers match your search term." : "No users have activated a Screenplay Pro subscription yet."}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredSubscribers.map((sub) => (
                <Card 
                  key={sub.id} 
                  className={`overflow-hidden transition-all border-2 rounded-3xl ${
                    sub.isExpired 
                      ? 'border-destructive/40 bg-destructive/5 dark:bg-destructive/10' 
                      : 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10'
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      
                      {/* USER DETAILS */}
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-foreground">{sub.displayName || 'Screenwriter'}</h3>
                          {sub.isExpired ? (
                            <Badge variant="destructive" className="font-bold flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> EXPIRED
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> ACTIVE
                            </Badge>
                          )}
                          <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground border-primary/20">
                            ID: {sub.id}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-xs text-muted-foreground font-medium pt-1">
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="truncate">{sub.email || 'No email provided'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{sub.mobileNumber || sub.phoneNumber || 'No mobile number'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="font-bold text-foreground">{sub.subscriptionPlanName || 'Screenplay Pro'}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4 text-xs font-bold text-muted-foreground pt-1 border-t border-border/40 mt-2">
                          <span>Subscribed: <strong className="text-foreground">{sub.formattedStartDate}</strong></span>
                          <span>Expires: <strong className={sub.isExpired ? 'text-destructive' : 'text-emerald-600'}>{sub.formattedExpiryDate}</strong></span>
                        </div>
                      </div>

                      {/* ACTION BUTTON */}
                      <div className="shrink-0 self-end md:self-center">
                        <Button 
                          variant={sub.isExpired ? "destructive" : "outline"}
                          size="sm"
                          onClick={() => handleSendExpiryEmail(sub)}
                          disabled={sendingEmailUserId === sub.id}
                          className="rounded-2xl font-bold shadow-md flex items-center gap-2"
                        >
                          {sendingEmailUserId === sub.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" /> Sending Email...
                            </>
                          ) : (
                            <>
                              <Mail className="h-4 w-4" /> Send Expiry Email
                            </>
                          )}
                        </Button>
                      </div>

                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ADD/EDIT DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-hidden flex flex-col rounded-3xl p-6">
          <DialogHeader className="shrink-0 pb-3 border-b">
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {editingPlan ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-grow custom-scrollbar pr-1">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider">Plan Name</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                placeholder="e.g. Monthly Writer Pass"
                className="rounded-xl font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price" className="text-xs font-bold uppercase tracking-wider">Price (₹ INR)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="price" 
                    type="number"
                    value={formData.price} 
                    onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} 
                    className="pl-9 rounded-xl font-bold"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration" className="text-xs font-bold uppercase tracking-wider">Duration (Days)</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="duration" 
                    type="number"
                    value={formData.durationDays} 
                    onChange={(e) => setFormData({...formData, durationDays: Number(e.target.value)})} 
                    className="pl-9 rounded-xl font-bold"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground font-medium">30 = Monthly, 365 = Annual, 3650 = Lifetime</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-bold uppercase tracking-wider">Included Features</Label>
                <Button variant="ghost" size="sm" onClick={handleAddFeature} className="text-primary hover:bg-primary/10 rounded-full h-8 px-3 font-bold">
                  <Plus className="w-3 h-3 mr-1" /> Add Bullet Point
                </Button>
              </div>
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                {formData.features.map((feature, index) => (
                  <div key={index} className="flex gap-2">
                    <Input 
                      value={feature} 
                      onChange={(e) => handleFeatureChange(index, e.target.value)} 
                      placeholder="e.g. Unlimited PDF Exports..."
                      className="rounded-xl flex-grow text-xs font-medium"
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveFeature(index)} className="rounded-xl shrink-0 text-destructive hover:bg-destructive/10">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-2xl border">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold">Plan Active Status</Label>
                <p className="text-xs text-muted-foreground">Make this plan available to writers on the checkout & pricing page.</p>
              </div>
              <Switch 
                checked={formData.isActive} 
                onCheckedChange={(checked) => setFormData({...formData, isActive: checked})} 
              />
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-3 border-t gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSave} className="rounded-xl px-8 shadow-lg shadow-primary/20 font-bold" disabled={isSaving}>
              {editingPlan ? 'Update Plan' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
