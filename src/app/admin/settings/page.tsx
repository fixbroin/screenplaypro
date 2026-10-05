"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Save, Loader2, MailIcon, PlaySquare, DollarSign, CreditCard, Users } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { triggerRefresh } from '@/lib/revalidateUtils';
import type { AppSettings } from '@/types/firestore'; 
import { defaultAppSettings } from '@/config/appDefaults'; 
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from '@/components/ui/tooltip';

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

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
          <TabsContent value="payment" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Razorpay Payment Gateway</CardTitle>
                <CardDescription>Configure credentials for accepting payments on subscription plans.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Razorpay Key ID</Label>
                  <Input name="razorpayKeyId" value={settings.razorpayKeyId || ''} onChange={handleInputChange} placeholder="rzp_live_..." />
                </div>
                <div className="space-y-2">
                  <Label>Razorpay Key Secret</Label>
                  <Input name="razorpayKeySecret" type="password" value={settings.razorpayKeySecret || ''} onChange={handleInputChange} placeholder="••••••••" />
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button onClick={() => handleSaveSettings('Payment Gateway')} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" /> Save Payment Settings
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
