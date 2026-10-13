"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Smartphone, Save, Loader2, ExternalLink, ShieldAlert, CheckCircle2, Sparkles, RefreshCw } from "lucide-react";
import { useToast } from '@/hooks/use-toast';

interface AppUpdateConfig {
  isEnabled: boolean;
  forceUpdate: boolean;
  versionName: string;
  versionCode: number;
  playStoreUrl: string;
  title: string;
  message: string;
  updatedAt?: string;
}

export default function AdminAppUpdatePage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [config, setConfig] = useState<AppUpdateConfig>({
    isEnabled: true,
    forceUpdate: true,
    versionName: '',
    versionCode: 1,
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.fixbro.newtalent',
    title: 'New Update Available!',
    message:
      'A new version of Screenplay Pro is available on Google Play Store with improved any-to-any language translation, faster performance, and bug fixes. Please update the app to continue.',
  });

  useEffect(() => {
    const fetchConfig = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/app-update', { cache: 'no-store' });
        const json = await res.json();
        if (json.success && json.data) {
          setConfig({
            isEnabled: Boolean(json.data.isEnabled ?? true),
            forceUpdate: Boolean(json.data.forceUpdate ?? true),
            versionName: String(json.data.versionName || ''),
            versionCode: Number(json.data.versionCode || 1),
            playStoreUrl: String(
              json.data.playStoreUrl ||
                'https://play.google.com/store/apps/details?id=com.fixbro.newtalent'
            ),
            title: String(json.data.title || 'New Update Available!'),
            message: String(
              json.data.message ||
                'A new version of Screenplay Pro is available on Google Play Store. Please update the app to continue.'
            ),
            updatedAt: json.data.updatedAt,
          });
        }
      } catch (err) {
        console.error('Failed to load app update settings:', err);
        toast({
          title: 'Error',
          description: 'Failed to load current app update settings.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, [toast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.versionName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'App Version Name is required (e.g. 1.0.1).',
        variant: 'destructive',
      });
      return;
    }
    if (!config.versionCode || config.versionCode < 1) {
      toast({
        title: 'Validation Error',
        description: 'App Version Code must be a valid positive number (e.g. 8).',
        variant: 'destructive',
      });
      return;
    }
    if (!config.playStoreUrl.trim().startsWith('http')) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid Play Store URL starting with https://',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/app-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (json.success) {
        setConfig(json.data);
        toast({
          title: 'App Update Settings Saved',
          description: `Active requirement set to v${json.data.versionName} (Code: ${json.data.versionCode}).`,
        });
      } else {
        throw new Error(json.error || 'Failed to save');
      }
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message || 'Could not save app update settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-sm font-bold text-muted-foreground">Loading App Update Settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2.5">
            <Smartphone className="h-6 w-6 text-primary" />
            Mobile App Version & Play Store Update
          </CardTitle>
          <CardDescription>
            Control the required Android App Version (`versionName`), Version Code (`versionCode`), and Play Store URL.
            When a user opens the mobile app, it automatically reads its built version from `pubspec.yaml` and checks against this page.
            If their installed version is older, the app shows the Update Screen and redirects them to Google Play Store.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSave}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Version & Store Configuration</CardTitle>
                <CardDescription>
                  Match these values with your `pubspec.yaml` (e.g. `version: 1.0.1+8` means Version = `1.0.1` and Version Code = `8`).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Enable Update Check */}
                <div className="flex flex-row items-center justify-between rounded-xl border p-4 shadow-sm bg-muted/20">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-base font-bold">Enable App Update Check</Label>
                    <p className="text-xs text-muted-foreground">
                      When enabled, the mobile app checks this version on startup and prompts users on older builds to update.
                    </p>
                  </div>
                  <Switch
                    checked={config.isEnabled}
                    onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, isEnabled: checked }))}
                    disabled={isSaving}
                  />
                </div>

                {/* Force Update */}
                <div className="flex flex-row items-center justify-between rounded-xl border p-4 shadow-sm bg-muted/20">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-base font-bold flex items-center gap-1.5">
                      Mandatory Force Update
                      <ShieldAlert className="h-4 w-4 text-amber-500" />
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      If ON, users with an older version must update from the Play Store before they can use the app. If OFF, they can tap &ldquo;Later&rdquo;.
                    </p>
                  </div>
                  <Switch
                    checked={config.forceUpdate}
                    onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, forceUpdate: checked }))}
                    disabled={isSaving}
                  />
                </div>

                {/* Version Name & Version Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="versionName" className="font-bold">
                      App Version (`versionName`)
                    </Label>
                    <Input
                      id="versionName"
                      placeholder="e.g. 1.0.1"
                      value={config.versionName}
                      onChange={(e) => setConfig((prev) => ({ ...prev, versionName: e.target.value }))}
                      disabled={isSaving}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      The version string before `+` in `pubspec.yaml` (e.g. `1.0.1` in `1.0.1+8`).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="versionCode" className="font-bold">
                      App Version Code (`versionCode`)
                    </Label>
                    <Input
                      id="versionCode"
                      type="number"
                      min={1}
                      placeholder="e.g. 8"
                      value={config.versionCode}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          versionCode: parseInt(e.target.value || '1', 10) || 1,
                        }))
                      }
                      disabled={isSaving}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      The integer build number after `+` in `pubspec.yaml` (e.g. `8` in `1.0.1+8`).
                    </p>
                  </div>
                </div>

                {/* Play Store URL */}
                <div className="space-y-2">
                  <Label htmlFor="playStoreUrl" className="font-bold">
                    Google Play Store URL
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="playStoreUrl"
                      placeholder="https://play.google.com/store/apps/details?id=com.fixbro.newtalent"
                      value={config.playStoreUrl}
                      onChange={(e) => setConfig((prev) => ({ ...prev, playStoreUrl: e.target.value }))}
                      disabled={isSaving}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Test Play Store Link"
                      onClick={() => window.open(config.playStoreUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    When the user taps &ldquo;Update Now&rdquo; in the app, this URL opens directly in the Google Play Store app.
                  </p>
                </div>

                {/* Update Title */}
                <div className="space-y-2">
                  <Label htmlFor="updateTitle" className="font-bold">
                    Update Screen Heading
                  </Label>
                  <Input
                    id="updateTitle"
                    placeholder="New Update Available!"
                    value={config.title}
                    onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
                    disabled={isSaving}
                  />
                </div>

                {/* Update Message / What's New */}
                <div className="space-y-2">
                  <Label htmlFor="updateMessage" className="font-bold">
                    What&apos;s New / Update Message
                  </Label>
                  <Textarea
                    id="updateMessage"
                    rows={4}
                    placeholder="Describe what is new in this update..."
                    value={config.message}
                    onChange={(e) => setConfig((prev) => ({ ...prev, message: e.target.value }))}
                    disabled={isSaving}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between border-t pt-5">
                <div className="text-xs text-muted-foreground">
                  {config.updatedAt
                    ? `Last saved: ${new Date(config.updatedAt).toLocaleString()}`
                    : 'Not saved yet'}
                </div>
                <Button type="submit" disabled={isSaving} className="gap-2 font-bold">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isSaving ? 'Saving...' : 'Save Update Settings'}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>

        {/* Live Mobile Update Screen Preview Column */}
        <div className="lg:col-span-5">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Mobile Update Screen Preview
              </CardTitle>
              <CardDescription>
                Preview of what users see when their installed APK is older than{' '}
                <span className="font-bold text-foreground">
                  v{config.versionName}+{config.versionCode}
                </span>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <div className="w-[310px] rounded-[32px] border-[6px] border-slate-900 bg-slate-50 p-5 shadow-xl text-slate-900">
                <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-slate-300" />
                <div className="flex flex-col items-center text-center space-y-4 py-3">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                    <RefreshCw className="h-8 w-8" />
                  </div>

                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-[11px] font-extrabold text-blue-700 uppercase tracking-wider">
                    v{config.versionName} (Code {config.versionCode})
                  </span>

                  <h3 className="text-lg font-extrabold text-slate-900 leading-snug">
                    {config.title || 'New Update Available!'}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed bg-white p-3.5 rounded-xl border border-slate-200 w-full text-left">
                    {config.message || 'Please update the app from Google Play Store to continue.'}
                  </p>

                  <div className="w-full space-y-2 pt-2">
                    <div className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-xs font-bold text-white shadow-md flex items-center justify-center gap-1.5">
                      Update on Play Store
                      <ExternalLink className="h-3.5 w-3.5" />
                    </div>

                    {!config.forceUpdate && (
                      <div className="w-full rounded-xl bg-slate-200/80 py-2.5 text-xs font-semibold text-slate-600">
                        Remind Me Later
                      </div>
                    )}
                  </div>

                  <div className="pt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    {config.forceUpdate ? 'Mandatory Update Active' : 'Optional Update Prompt'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
