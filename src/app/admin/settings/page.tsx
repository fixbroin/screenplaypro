"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Save, Loader2, MailIcon, PlaySquare, DollarSign, CreditCard, Users, Copy, Check, Globe, ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { triggerRefresh } from '@/lib/revalidateUtils';
import type { AppSettings } from '@/types/firestore'; 
import { defaultAppSettings } from '@/config/appDefaults'; 
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from '@/components/ui/tooltip';

import { getBaseUrl } from '@/lib/config';

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [originUrl, setOriginUrl] = useState('');
  const [copiedRazorpay, setCopiedRazorpay] = useState(false);
  const [copiedPaypal, setCopiedPaypal] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOriginUrl(window.location.origin);
    }
  }, []);

  const handleCopyUrl = (url: string, type: 'razorpay' | 'paypal') => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    if (type === 'razorpay') {
      setCopiedRazorpay(true);
      setTimeout(() => setCopiedRazorpay(false), 2000);
    } else {
      setCopiedPaypal(true);
      setTimeout(() => setCopiedPaypal(false), 2000);
    }
    toast({ title: "Webhook URL Copied 📋", description: `${url} copied to clipboard.` });
  };

  const loadSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const res = await fetch('/api/db/settings?key=applicationConfig');
      const json = await res.json();
      if (json.success && json.data) {
        setSettings({ ...defaultAppSettings, ...json.data });
      } else {
        setSettings(defaultAppSettings);
      }
    } catch (e) {
      console.error("Failed to load settings from MySQL", e);
      toast({ title: "Error Loading Settings", description: "Could not load settings from database. Using defaults.", variant: "destructive" });
      setSettings(defaultAppSettings); 
    } finally {
      setIsLoadingSettings(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => {
      const newSettings = JSON.parse(JSON.stringify(prev)); 
      if (['carouselAutoplayDelay'].includes(name)) {
        newSettings[name as keyof AppSettings] = parseFloat(value) || 0;
      } else {
        (newSettings as any)[name] = value;
      }
      return newSettings;
    });
  };
  
  const handleSwitchChange = (name: keyof AppSettings | string, checked: boolean) => {
    setSettings(prev => ({ ...prev, [name as keyof AppSettings]: checked }));
  };

  const handleSaveSettings = async (sectionName: string) => {
    setIsSaving(true);
    
    const settingsToSave: AppSettings = {
      ...defaultAppSettings, 
      ...settings, 
      updatedAt: new Date().toISOString() as any,
    };
    
    try {
      await fetch('/api/db/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'applicationConfig', data: settingsToSave })
      });

      await triggerRefresh('app-settings');
      await triggerRefresh('global-cache');
      await triggerRefresh('sitemap');
      
      toast({
        title: "Settings Saved",
        description: sectionName + ' settings have been saved to MySQL.',
      });
    } catch (e) {
      console.error("Failed to save settings to MySQL", e);
      toast({
        title: "Error Saving Settings",
        description: "Could not save settings to the database.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingSettings) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <Settings className="h-8 w-8 text-primary" /> General Settings
            </h1>
            <p className="text-sm text-muted-foreground">Manage app authentication, email, and platform configuration.</p>
          </div>
        </div>

        <Tabs defaultValue="auth" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="auth" className="font-bold flex items-center gap-1.5"><Users className="h-4 w-4" /> Auth</TabsTrigger>
            <TabsTrigger value="email" className="font-bold flex items-center gap-1.5"><MailIcon className="h-4 w-4" /> SMTP Email</TabsTrigger>
            <TabsTrigger value="hero" className="font-bold flex items-center gap-1.5"><PlaySquare className="h-4 w-4" /> Hero</TabsTrigger>
            <TabsTrigger value="payment" className="font-bold flex items-center gap-1.5"><CreditCard className="h-4 w-4" /> Gateway</TabsTrigger>
          </TabsList>

          {/* AUTH SETTINGS */}
          <TabsContent value="auth" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Authentication Methods</CardTitle>
                <CardDescription>Enable or disable login options for your users.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-bold">Email & Password Login</Label>
                    <p className="text-xs text-muted-foreground">Allow users to log in with email and password.</p>
                  </div>
                  <Switch
                    checked={settings.enableEmailPasswordLogin ?? true}
                    onCheckedChange={(c) => handleSwitchChange('enableEmailPasswordLogin', c)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-bold">Mobile Phone OTP Login</Label>
                    <p className="text-xs text-muted-foreground">Allow users to sign in via SMS OTP verification.</p>
                  </div>
                  <Switch
                    checked={settings.enableOtpLogin ?? true}
                    onCheckedChange={(c) => handleSwitchChange('enableOtpLogin', c)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-bold">Google One-Tap / Popup Login</Label>
                    <p className="text-xs text-muted-foreground">Allow users to sign in with Google account.</p>
                  </div>
                  <Switch
                    checked={settings.enableGoogleLogin ?? true}
                    onCheckedChange={(c) => handleSwitchChange('enableGoogleLogin', c)}
                  />
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button onClick={() => handleSaveSettings('Authentication')} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" /> Save Auth Settings
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* EMAIL SETTINGS */}
          <TabsContent value="email" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>SMTP Email Configuration</CardTitle>
                <CardDescription>Configure Hostinger or custom SMTP settings for welcome and expiry emails.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SMTP Host</Label>
                  <Input name="smtpHost" value={settings.smtpHost || ''} onChange={handleInputChange} placeholder="smtp.hostinger.com" />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Port</Label>
                  <Input name="smtpPort" type="number" value={settings.smtpPort || 465} onChange={handleInputChange} placeholder="465" />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Username / Email</Label>
                  <Input name="smtpUser" value={settings.smtpUser || ''} onChange={handleInputChange} placeholder="support@screenplaypro.in" />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Password</Label>
                  <Input name="smtpPass" type="password" value={settings.smtpPass || ''} onChange={handleInputChange} placeholder="••••••••" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Sender Email Address</Label>
                  <Input name="senderEmail" value={settings.senderEmail || ''} onChange={handleInputChange} placeholder="no-reply@screenplaypro.in" />
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button onClick={() => handleSaveSettings('SMTP Email')} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" /> Save Email Settings
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* HERO SETTINGS */}
          <TabsContent value="hero" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Hero Section Settings</CardTitle>
                <CardDescription>Configure homepage headline and banner carousel delay.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Homepage Main Title</Label>
                  <Input name="heroTitle" value={settings.heroTitle || ''} onChange={handleInputChange} placeholder="Write Your Masterpiece Screenplay" />
                </div>
                <div className="space-y-2">
                  <Label>Homepage Subtitle</Label>
                  <Input name="heroSubtitle" value={settings.heroSubtitle || ''} onChange={handleInputChange} placeholder="The ultimate AI-assisted screenplay editor" />
                </div>
                <div className="space-y-2">
                  <Label>Carousel Autoplay Delay (seconds)</Label>
                  <Input name="carouselAutoplayDelay" type="number" value={settings.carouselAutoplayDelay || 5} onChange={handleInputChange} />
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button onClick={() => handleSaveSettings('Hero Section')} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" /> Save Hero Settings
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* PAYMENT SETTINGS */}
          <TabsContent value="payment" className="space-y-6 pt-4">
            {/* RAZORPAY CARD */}
            <Card className="border-primary/20 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center text-xl">
                      <CreditCard className="mr-2 h-5 w-5 text-primary" /> Razorpay Payment Gateway
                    </CardTitle>
                    <CardDescription>Configure credentials and webhook endpoint for Razorpay online payments.</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="enableOnlinePayment" className="text-sm font-semibold">Enable Razorpay</Label>
                    <Switch
                      id="enableOnlinePayment"
                      checked={settings.enableOnlinePayment ?? true}
                      onCheckedChange={(checked) => {
                        const currentPaypal = settings.enablePaypal ?? false;
                        if (!checked && !currentPaypal) {
                          toast({
                            title: "Payment Gateway Compulsory 💳",
                            description: "At least one payment gateway must remain active. PayPal has been automatically enabled.",
                          });
                          setSettings(prev => ({ ...prev, enableOnlinePayment: false, enablePaypal: true }));
                        } else {
                          setSettings(prev => ({ ...prev, enableOnlinePayment: checked }));
                        }
                      }}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-semibold">Razorpay Key ID</Label>
                    <Input name="razorpayKeyId" value={settings.razorpayKeyId || ''} onChange={handleInputChange} placeholder="rzp_live_..." />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold">Razorpay Key Secret</Label>
                    <Input name="razorpayKeySecret" type="password" value={settings.razorpayKeySecret || ''} onChange={handleInputChange} placeholder="••••••••" />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label className="font-semibold">Razorpay Webhook Secret (Optional)</Label>
                  <Input name="razorpayWebhookSecret" type="password" value={settings.razorpayWebhookSecret || ''} onChange={handleInputChange} placeholder="Secret defined in Razorpay Webhooks dashboard" />
                </div>

                {/* DYNAMIC RAZORPAY WEBHOOK URL DISPLAY (ENV DOMAIN) */}
                <div className="p-4 rounded-xl bg-muted/60 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-primary" /> Razorpay Webhook URL
                    </Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleCopyUrl(`${getBaseUrl().replace(/\/$/, '')}/api/webhooks/razorpay`, 'razorpay')}
                      className="h-8 text-xs font-semibold"
                    >
                      {copiedRazorpay ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                      {copiedRazorpay ? "Copied" : "Copy Webhook URL"}
                    </Button>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground bg-background p-2.5 rounded-lg border border-border break-all">
                    {`${getBaseUrl().replace(/\/$/, '')}/api/webhooks/razorpay`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Add this webhook URL in your Razorpay Dashboard under Settings &gt; Webhooks for events: <code>payment.captured</code>, <code>order.paid</code>, <code>subscription.charged</code>.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button onClick={() => handleSaveSettings('Razorpay Payment Gateway')} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" /> Save Razorpay Settings
                </Button>
              </CardFooter>
            </Card>

            {/* PAYPAL CARD */}
            <Card className="border-blue-500/20 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center text-xl text-blue-600 dark:text-blue-400">
                      <DollarSign className="mr-2 h-5 w-5" /> PayPal Payment Gateway
                    </CardTitle>
                    <CardDescription>Accept international payments and subscriptions via PayPal.</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="enablePaypal" className="text-sm font-semibold">Enable PayPal</Label>
                    <Switch
                      id="enablePaypal"
                      checked={settings.enablePaypal ?? false}
                      onCheckedChange={(checked) => {
                        const currentRazorpay = settings.enableOnlinePayment ?? true;
                        if (!checked && !currentRazorpay) {
                          toast({
                            title: "Payment Gateway Compulsory 💳",
                            description: "At least one payment gateway must remain active. Razorpay has been automatically enabled.",
                          });
                          setSettings(prev => ({ ...prev, enablePaypal: false, enableOnlinePayment: true }));
                        } else {
                          setSettings(prev => ({ ...prev, enablePaypal: checked }));
                        }
                      }}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-semibold">PayPal Environment Mode</Label>
                  <Select 
                    value={settings.paypalMode || 'sandbox'} 
                    onValueChange={(val) => setSettings(prev => ({ ...prev, paypalMode: val as 'sandbox' | 'live' }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox (Testing / Developer Mode)</SelectItem>
                      <SelectItem value="live">Live (Production Payments)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-semibold">PayPal Client ID</Label>
                    <Input name="paypalClientId" value={settings.paypalClientId || ''} onChange={handleInputChange} placeholder="Client ID from PayPal Developer Portal" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold">PayPal Client Secret</Label>
                    <Input name="paypalClientSecret" type="password" value={settings.paypalClientSecret || ''} onChange={handleInputChange} placeholder="••••••••" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold">PayPal Webhook Secret / ID (Optional)</Label>
                  <Input name="paypalWebhookId" type="password" value={settings.paypalWebhookId || ''} onChange={handleInputChange} placeholder="Webhook ID defined in PayPal Developer Webhook Settings" />
                </div>

                {/* DYNAMIC PAYPAL WEBHOOK URL DISPLAY (ENV DOMAIN) */}
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-blue-500" /> PayPal Webhook URL
                    </Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleCopyUrl(`${getBaseUrl().replace(/\/$/, '')}/api/webhooks/paypal`, 'paypal')}
                      className="h-8 text-xs font-semibold"
                    >
                      {copiedPaypal ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                      {copiedPaypal ? "Copied" : "Copy Webhook URL"}
                    </Button>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground bg-background p-2.5 rounded-lg border border-border break-all">
                    {`${getBaseUrl().replace(/\/$/, '')}/api/webhooks/paypal`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Add this webhook URL in your PayPal Developer Portal under App &gt; Webhooks for events: <code>PAYMENT.CAPTURE.COMPLETED</code>, <code>CHECKOUT.ORDER.APPROVED</code>.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button onClick={() => handleSaveSettings('PayPal Payment Gateway')} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" /> Save PayPal Settings
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
