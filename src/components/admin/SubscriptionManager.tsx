"use client";

import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, Loader2, Check, X, 
  IndianRupee, Calendar, ListChecks, Sparkles, FileText, Download, ShieldCheck, RefreshCw,
  Users, Mail, Phone, Search, AlertCircle, Copy, CheckCircle2, XCircle
} from 'lucide-react';
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
    priceUsd: 4.99,
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
    priceUsd: 24.99,
    durationDays: 365,
    isActive: true,
    order: 2,
    features: [
      'Unlimited PDF Script Exports (Save 45%)',
      'Studio-Standard Screenplay Formatting',
      'Multi-Language Script Typing & Translation',
      'Priority High-Speed PDF Rendering',
      'Real-Time Cloud Autosave & Backup',
      'Priority Writer Support'
    ]
  },
  {
    name: 'Lifetime Writer Pass',
    price: 4999,
    priceUsd: 59.99,
    durationDays: 3650,
    isActive: true,
    order: 3,
    features: [
      'Lifetime Unlimited PDF Downloads',
      'All Future Script Tools Included',
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
  previousPlanName?: string;
  totalSubscriptionsCount?: number;
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
    priceUsd: 4.99,
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
        }
      }
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
        if (data.success && Array.isArray(data.subscribers)) {
          setSubscribers(data.subscribers);
        }
      }
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
      for (const plan of DEFAULT_SCREENPLAY_PLANS) {
        await fetch('/api/db/subscription-plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(plan)
        });
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
      priceUsd: 4.99,
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
      priceUsd: plan.priceUsd ?? Math.round((plan.price / 80) * 100) / 100,
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
        priceUsd: Number(formData.priceUsd),
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
                Manage writer subscription plans, INR & USD pricing, features, and view subscribed members.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {plans.length === 0 && (
                <Button variant="outline" onClick={handleSeedDefaults} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Load Default Plans
                </Button>
              )}
              <Button onClick={handleOpenAddDialog} className="font-bold">
                <Plus className="h-4 w-4 mr-2" /> Add New Plan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="plans" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="plans" className="font-bold">
            <Sparkles className="h-4 w-4 mr-2" /> Subscription Plans ({plans.length})
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="font-bold">
            <Users className="h-4 w-4 mr-2" /> Subscribed People ({subscribers.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SUBSCRIPTION PLANS */}
        <TabsContent value="plans" className="space-y-6 pt-4">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : plans.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-bold">No Subscription Plans Found</h3>
              <p className="text-sm text-muted-foreground mb-6">Initialize default plans or add a new plan for writers.</p>
              <Button onClick={handleSeedDefaults} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Load Screenplay Pro Default Plans
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <Card key={plan.id} className={`flex flex-col relative transition-all duration-300 hover:shadow-lg ${!plan.isActive ? 'opacity-60 bg-muted/20' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                        <CardDescription className="text-xs pt-1">
                          Duration: {plan.durationDays >= 3650 ? 'Lifetime' : `${plan.durationDays} Days`}
                        </CardDescription>
                      </div>
                      <Badge variant={plan.isActive ? "default" : "secondary"}>
                        {plan.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <div className="pt-3 flex items-baseline gap-2 flex-wrap">
                      <span className="text-3xl font-black">₹{plan.price}</span>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">/ ${plan.priceUsd ?? Math.round((plan.price / 80) * 100) / 100}</span>
                      <span className="text-xs text-muted-foreground font-semibold"> / {plan.durationDays} days</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-2 pt-2">
                    <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-2">Included Features:</p>
                    {plan.features?.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs font-medium">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </CardContent>
                  <div className="p-4 border-t flex gap-2 justify-end bg-secondary/5">
                    <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(plan)}>
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(plan.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: SUBSCRIBED PEOPLE */}
        <TabsContent value="subscribers" className="space-y-6 pt-4">
          <Card className="border-primary/10 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative flex-1 max-w-md w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search subscriber name, email, mobile..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-secondary/20"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={filterStatus === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus('all')}
                  >
                    All ({subscribers.length})
                  </Button>
                  <Button
                    variant={filterStatus === 'active' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus('active')}
                    className="text-emerald-600 border-emerald-300"
                  >
                    Active ({subscribers.filter(s => !s.isExpired).length})
                  </Button>
                  <Button
                    variant={filterStatus === 'expired' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus('expired')}
                    className="text-destructive border-destructive/30"
                  >
                    Expired ({subscribers.filter(s => s.isExpired).length})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingSubscribers ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
              ) : filteredSubscribers.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-base font-bold text-muted-foreground">No Subscribed Users Found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-secondary/30 text-muted-foreground border-y">
                      <tr>
                        <th className="px-4 py-3">Profile ID & User Details</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">Subscription Plan</th>
                        <th className="px-4 py-3">Subscribed Date</th>
                        <th className="px-4 py-3">Expiry Date</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredSubscribers.map((sub) => (
                        <tr key={sub.id} className={`hover:bg-secondary/10 transition-colors ${sub.isExpired ? 'bg-destructive/5' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="space-y-0.5">
                              <p className="font-bold text-foreground">{sub.displayName || 'Screenwriter'}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">ID: {sub.id}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-0.5 text-xs">
                              <p className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" /> {sub.email || 'N/A'}</p>
                              <p className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" /> {sub.mobileNumber || 'N/A'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <p className="font-bold text-foreground">
                                {sub.subscriptionPlanName || 'Standard Plan'}
                              </p>
                              {sub.previousPlanName && (
                                <p className="text-[11px] text-muted-foreground">
                                  <span className="font-bold text-amber-600 dark:text-amber-400">Previous:</span> {sub.previousPlanName}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {sub.formattedStartDate}
                          </td>
                          <td className="px-4 py-3 text-xs font-medium">
                            <span className={sub.isExpired ? 'text-destructive font-bold' : 'text-foreground'}>
                              {sub.formattedExpiryDate}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              sub.isExpired ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600'
                            }`}>
                              {sub.isExpired ? <XCircle className="h-3 w-3 mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {sub.isExpired ? 'Expired' : 'Active'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendExpiryEmail(sub)}
                              disabled={sendingEmailUserId === sub.id}
                              className={sub.isExpired ? "border-destructive/30 hover:bg-destructive/10 text-destructive text-xs font-bold" : "text-xs font-bold"}
                            >
                              {sendingEmailUserId === sub.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              ) : (
                                <Mail className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Expiry Email
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PLAN EDIT/ADD DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Plan Name</Label>
              <Input
                placeholder="e.g., Annual Pro Pass"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Price (INR ₹)</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Price (USD $)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="4.99"
                  value={formData.priceUsd}
                  onChange={(e) => setFormData({ ...formData, priceUsd: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (Days)</Label>
                <Input
                  type="number"
                  placeholder="30, 365, 3650"
                  value={formData.durationDays}
                  onChange={(e) => setFormData({ ...formData, durationDays: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex justify-between items-center">
                <span>Features List</span>
                <Button type="button" variant="ghost" size="sm" onClick={handleAddFeature}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Feature
                </Button>
              </Label>
              {formData.features.map((feat, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Feature details..."
                    value={feat}
                    onChange={(e) => handleFeatureChange(index, e.target.value)}
                  />
                  {formData.features.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveFeature(index)}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="plan-active">Active Plan Status</Label>
              <Switch
                id="plan-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingPlan ? 'Save Changes' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
