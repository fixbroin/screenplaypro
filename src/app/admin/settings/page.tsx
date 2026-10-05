"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Save, Loader2, MailIcon, PlaySquare, DollarSign, CreditCard, Users } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { triggerRefresh } from '@/lib/revalidateUtils';
import type { AppSettings } from '@/types/firestore'; 
import { defaultAppSettings } from '@/config/appDefaults'; 
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from '@/components/ui/tooltip';

const APP_CONFIG_COLLECTION = "webSettings";
const APP_CONFIG_DOC_ID = "applicationConfig";

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const loadSettingsFromFirestore = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const settingsDocRef = doc(db, APP_CONFIG_COLLECTION, APP_CONFIG_DOC_ID);
      const docSnap = await getDoc(settingsDocRef);
      if (docSnap.exists()) {
        const firestoreData = docSnap.data() as Partial<AppSettings>;
        const mergedSettings = { 
          ...defaultAppSettings, 
          ...firestoreData,
        };
        setSettings(mergedSettings);
      } else {
        setSettings(defaultAppSettings);
      }
    } catch (e) {
      console.error("Failed to load settings from Firestore", e);
      toast({ title: "Error Loading Settings", description: "Could not load settings from database. Using defaults.", variant: "destructive" });
      setSettings(defaultAppSettings); 
    } finally {
      setIsLoadingSettings(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSettingsFromFirestore();
  }, [loadSettingsFromFirestore]);

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
      updatedAt: Timestamp.now(),
    };
    
    try {
      const settingsDocRef = doc(db, APP_CONFIG_COLLECTION, APP_CONFIG_DOC_ID);
      await setDoc(settingsDocRef, settingsToSave, { merge: true }); 
      await triggerRefresh('app-settings');
      await triggerRefresh('global-cache');
      await triggerRefresh('sitemap');
      
      toast({
        title: "Settings Saved",
        description: sectionName + ' settings have been saved to the database.',
      });
    } catch (e) {
      console.error("Failed to save settings to Firestore", e);
      toast({
        title: "Error Saving Settings",
        description: "Could not save settings to the database.",
        variant: "destructive",
      });
    }
    await new Promise(resolve => setTimeout(resolve, 500)); 
    setIsSaving(false);
  };

  if (isLoadingSettings) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3">Loading application settings...</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center">
              <Settings className="mr-2 h-6 w-6 text-primary" /> Application Settings
            </CardTitle>
            <CardDescription>
              Configure application settings. Changes here affect the entire application.
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs defaultValue="general" className="w-full">
          <div className="relative mb-6">
            <TabsList className="h-12 w-full justify-start gap-2 bg-transparent p-0 border-b border-border rounded-none">
              <TabsTrigger 
                value="general"
                className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none whitespace-nowrap"
              >
                <DollarSign className="mr-2 h-4 w-4" /> General
              </TabsTrigger>
              <TabsTrigger 
                value="payment"
                className="relative h-12 rounded-none border-b-2 border-transparent bg-transparent px-4 pb-3 pt-2 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none whitespace-nowrap"
              >
                <CreditCard className="mr-2 h-4 w-4" /> Payment
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" className="mt-0 focus-visible:outline-none">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Basic application-wide configurations.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4 p-4 border rounded-md shadow-sm">
                  <h3 className="text-lg font-semibold flex items-center"><Users className="mr-2 h-5 w-5 text-muted-foreground"/>User Profile Settings</h3>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="allowUsernameEdit" className="text-base">Allow Username Editing</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable or disable the ability for users to change their usernames in their profile.
                      </p>
                    </div>
                    <Switch
                      id="allowUsernameEdit"
                      name="allowUsernameEdit" 
                      checked={settings.allowUsernameEdit}
                      onCheckedChange={(checked) => handleSwitchChange('allowUsernameEdit', checked)}
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="space-y-4 p-4 border rounded-md shadow-sm">
                  <h3 className="text-lg font-semibold flex items-center"><PlaySquare className="mr-2 h-5 w-5 text-muted-foreground"/>Homepage Hero Carousel</h3>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="enableHeroCarousel" className="text-base">Enable Hero Carousel</Label>
                      <p className="text-sm text-muted-foreground">
                        Show or hide the main slideshow on the homepage.
                      </p>
                    </div>
                    <Switch
                      id="enableHeroCarousel"
                      name="enableHeroCarousel" 
                      checked={settings.enableHeroCarousel}
                      onCheckedChange={(checked) => handleSwitchChange('enableHeroCarousel', checked)}
                      disabled={isSaving}
                    />
                  </div>
                  {settings.enableHeroCarousel && (
                    <div className="space-y-4 pl-4 border-l-2 border-primary ml-2 pt-4">
                      <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <Label htmlFor="enableCarouselAutoplay" className="text-base">Enable Autoplay</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically transition between slides.
                          </p>
                        </div>
                        <Switch
                          id="enableCarouselAutoplay"
                          name="enableCarouselAutoplay"
                          checked={settings.enableCarouselAutoplay}
                          onCheckedChange={(checked) => handleSwitchChange('enableCarouselAutoplay', checked)}
                          disabled={isSaving}
                        />
                      </div>
                      {settings.enableCarouselAutoplay && (
                         <div className="space-y-2">
                          <Label htmlFor="carouselAutoplayDelay">Autoplay Delay (milliseconds)</Label>
                          <Input
                            id="carouselAutoplayDelay"
                            name="carouselAutoplayDelay"
                            type="number"
                            value={settings.carouselAutoplayDelay}
                            onChange={handleInputChange}
                            placeholder="e.g., 5000"
                            disabled={isSaving}
                            min="1000" 
                          />
                          <p className="text-xs text-muted-foreground">Time between slide transitions (e.g., 5000 for 5 seconds). Min: 1000ms.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4 p-4 border rounded-md shadow-sm">
                  <h3 className="text-lg font-semibold flex items-center"><MailIcon className="mr-2 h-5 w-5 text-muted-foreground"/>Email Configuration (SMTP)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="smtpHost">SMTP Host</Label>
                        <Input id="smtpHost" name="smtpHost" value={settings.smtpHost} onChange={handleInputChange} placeholder="e.g., smtp.gmail.com" disabled={isSaving}/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="smtpPort">SMTP Port</Label>
                        <Input id="smtpPort" name="smtpPort" type="text" value={settings.smtpPort} onChange={handleInputChange} placeholder="e.g., 587 or 465" disabled={isSaving}/>
                    </div>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="senderEmail">Sender Email Address</Label>
                      <Input id="senderEmail" name="senderEmail" type="email" value={settings.senderEmail} onChange={handleInputChange} placeholder="e.g., no-reply@screenplaypro.in" disabled={isSaving}/>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="smtpUser">SMTP Username</Label>
                        <Input id="smtpUser" name="smtpUser" value={settings.smtpUser} onChange={handleInputChange} placeholder="Your SMTP username" disabled={isSaving}/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="smtpPass">SMTP Password</Label>
                        <Input id="smtpPass" name="smtpPass" type="password" value={settings.smtpPass} onChange={handleInputChange} placeholder="Your SMTP password" disabled={isSaving}/>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Used for sending subscription confirmation emails, expiry renewal reminders, and admin notifications.</p>
                </div>

              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <Button onClick={() => handleSaveSettings("General")} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save General Settings
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="payment">
            <Card>
              <CardHeader>
                <CardTitle>Payment Gateway Settings</CardTitle>
                <CardDescription>Configure Razorpay online payment gateway credentials.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableOnlinePayment" className="text-base">Enable Online Payments (Razorpay)</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow customers to pay using online methods like UPI, Cards, Netbanking.
                    </p>
                  </div>
                  <Switch
                    id="enableOnlinePayment"
                    name="enableOnlinePayment" 
                    checked={settings.enableOnlinePayment}
                    onCheckedChange={(checked) => handleSwitchChange('enableOnlinePayment', checked)}
                    disabled={isSaving}
                  />
                </div>

                {settings.enableOnlinePayment && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary ml-2 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="razorpayKeyId">Razorpay Key ID</Label>
                      <Input
                        id="razorpayKeyId"
                        name="razorpayKeyId"
                        value={settings.razorpayKeyId}
                        onChange={handleInputChange}
                        placeholder="rzp_live_xxxxxxxxxxxxxx"
                        disabled={isSaving}
                      />
                      <p className="text-xs text-muted-foreground">If left empty, system falls back to .env RAZORPAY_KEY_ID.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="razorpayKeySecret">Razorpay Key Secret</Label>
                      <Input
                        id="razorpayKeySecret"
                        name="razorpayKeySecret"
                        type="password"
                        value={settings.razorpayKeySecret}
                        onChange={handleInputChange}
                        placeholder="••••••••••••••••••••••"
                        disabled={isSaving}
                      />
                      <p className="text-xs text-muted-foreground">If left empty, system falls back to .env RAZORPAY_KEY_SECRET.</p>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <Button onClick={() => handleSaveSettings("Payment")} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Payment Settings
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
