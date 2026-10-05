// src/components/script/ScriptWritingDashboardClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getUserScripts, createScript, deleteScript } from "@/lib/scriptUtils";
import { Script } from "@/types/script";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, Download, FileText, Loader2, ArrowLeft, PenTool, Sparkles, BookOpen, Printer, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportToPDF } from "@/lib/scriptUtils";
import { checkSubscriptionStatus } from "@/lib/subscriptionUtils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function ScriptWritingDashboardClient() {
  const { user, firestoreUser, isLoading: authLoading, triggerAuthRedirect } = useAuth();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newScriptTitle, setNewScriptTitle] = useState("");
  const [newScriptDesc, setNewScriptDesc] = useState("");
  const [newScriptWrittenBy, setNewScriptWrittenBy] = useState("");
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadScripts();
      if (user.displayName) setNewScriptWrittenBy(user.displayName);
      else if (user.email) setNewScriptWrittenBy(user.email.split('@')[0]);
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const handleExportPDF = async (script: Script) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to export your screenplay PDF.",
        variant: "destructive",
      });
      triggerAuthRedirect(window.location.pathname);
      return;
    }

    const { isActive, isExpired } = checkSubscriptionStatus(firestoreUser, user.email);

    if (!isActive) {
      if (isExpired) {
        toast({
          title: "Subscription Expired",
          description: "Your Screenplay Pro subscription has expired. Please renew your plan to download PDFs.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Subscription Required",
          description: "An active Screenplay Pro subscription is required to export and download PDF scripts.",
          variant: "destructive",
        });
      }
      router.push('/subscriptions?reason=pdf_export');
      return;
    }

    try {
      setIsExporting(script.id);
      toast({
        title: "Generating PDF",
        description: "Please wait while we prepare your script for download...",
      });
      await exportToPDF(script);
      toast({
        title: "Success",
        description: "Your script has been downloaded successfully.",
      });
    } catch (error: any) {
      console.error("Export error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(null);
    }
  };

  const loadScripts = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const userScripts = await getUserScripts(user.uid);
      setScripts(userScripts);
    } catch (error) {
      console.error("Error loading scripts:", error);
      toast({
        title: "Error",
        description: "Failed to load scripts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScript = async () => {
    if (!user || !newScriptTitle.trim()) return;
    try {
      setIsCreating(true);
      const scriptId = await createScript(user.uid, user.email || "", newScriptTitle, newScriptWrittenBy, newScriptDesc);
      toast({
        title: "Success",
        description: "Script created successfully!",
      });
      router.push(`/script-writing/${scriptId}`);
    } catch (error) {
      console.error("Error creating script:", error);
      toast({
        title: "Error",
        description: "Failed to create script. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteScript = async (id: string) => {
    if (!confirm("Are you sure you want to delete this script?")) return;
    try {
      await deleteScript(id);
      setScripts(scripts.filter(s => s.id !== id));
      toast({
        title: "Deleted",
        description: "Script deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting script:", error);
      toast({
        title: "Error",
        description: "Failed to delete script.",
        variant: "destructive",
      });
    }
  };

  if (authLoading || (user && loading)) {
    return (
      <div className="flex h-[70vh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // --- RENDER VISITOR/GUEST SEO LANDING PAGE ---
  if (!user) {
    return (
      <div className="container mx-auto py-12 px-4 max-w-5xl">
        {/* Hero Section */}
        <section className="text-center space-y-6 py-12 md:py-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-full text-xs font-black uppercase tracking-widest text-primary border border-primary/10">
            <PenTool className="w-4 h-4 text-primary" /> 100% Free Screenplay Software
          </div>
          <h1 className="text-4xl md:text-7xl font-black tracking-tight leading-tight max-w-4xl mx-auto">
            Free Online Script Writing Software & Screenplay Writer
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Write your film script, theater screenplay, movie plot, or short film script online in industry-standard format. Completely free, no subscriptions required.
          </p>
          <div className="pt-6 flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/auth/login?redirect=/script-writing">
              <Button size="lg" className="rounded-full px-8 py-6 text-md font-bold shadow-lg shadow-primary/20 h-14">
                Start Writing Now (Free)
              </Button>
            </Link>
            <Link href="/">
              <Button size="lg" variant="outline" className="rounded-full px-8 py-6 text-md font-bold h-14">
                Explore Casting Calls
              </Button>
            </Link>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-16 border-t">
          <h2 className="text-2xl md:text-4xl font-black text-center mb-12">Professional Screenplay Writing Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 bg-card border rounded-3xl space-y-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Standard Screenplay Format</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Automatically formats Scene Headings, Action, Characters, Parentheticals, Dialogues, and Transitions. Type with professional tab-and-enter shortcuts.
              </p>
            </div>
            <div className="p-8 bg-card border rounded-3xl space-y-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Printer className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Perfect PDF Export</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Export your screenplays to perfectly formatted PDF files at any time with a single click. Ready for printing, casting calls, and pitching to producers.
              </p>
            </div>
            <div className="p-8 bg-card border rounded-3xl space-y-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Free Forever (No Paywalls)</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We believe in supporting creative scriptwriters. There are no page limits, subscription fees, or hidden charges. Write as many scripts as you want.
              </p>
            </div>
          </div>
        </section>

        {/* Informative Text Copy */}
        <section className="py-16 border-t max-w-4xl mx-auto space-y-8">
          <h2 className="text-2xl md:text-4xl font-black text-center">How to Write a Movie Script Online</h2>
          <div className="prose prose-slate max-w-none text-muted-foreground leading-relaxed space-y-4">
            <p>
              Writing a movie script requires adhering to the industry-standard screenplay layout. Standard formatting ensures that one page of screenplay translates roughly to one minute of screen time.
            </p>
            <p>
              Screenplay Pro's free screenplay editor makes scriptwriting simple. It supports all critical screenwriting elements:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li><strong>Scene Headings (Sluglines)</strong>: e.g., EXT. COFFEE SHOP - DAY. Identifies the location and time.</li>
              <li><strong>Action Lines</strong>: Describes what the camera sees and what characters do.</li>
              <li><strong>Character Names</strong>: Positioned in the center, identifying who speaks.</li>
              <li><strong>Parentheticals</strong>: Provides context or delivery instructions for actors.</li>
              <li><strong>Dialogues</strong>: The actual spoken lines, formatted in the center column.</li>
            </ul>
            <p>
              Simply create a free account, type your title, and start putting your film vision into words. You can easily share your portfolios with actors, assistant directors, and casting agencies on our local Bangalore film casting directory.
            </p>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-16 border-t max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-4xl font-black text-center mb-10">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="faq-1" className="border-primary/10">
              <AccordionTrigger className="font-bold text-left">Is the script writing software really free?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Yes, it is 100% free with no monthly subscriptions, page limits, or hidden fees. We want screenplay writers to write freely without financial barriers.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-2" className="border-primary/10">
              <AccordionTrigger className="font-bold text-left">Can I export my script to PDF?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Absolutely! Our software exports scripts directly into industry-standard PDF formatting, preserving standard scriptwriting fonts and margins.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="faq-3" className="border-primary/10">
              <AccordionTrigger className="font-bold text-left">Who owns the copyright to my script?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                You retain 100% ownership of your work. Screenplay Pro serves as a secure storage environment and holds no rights or claims to any screenplay written on the platform.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      </div>
    );
  }

  // --- RENDER REGISTERED WRITER DASHBOARD ---
  return (
    <div className="container mx-auto py-10 px-4 min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="mb-6">
        <Link href="/">
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all border-none"
          >
            <ArrowLeft className="h-4 w-4" /> Go to Home
          </Button>
        </Link>
      </div>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-bold text-foreground">My Scripts</h1>
          <p className="text-muted-foreground mt-2">Write and manage your movie scripts with ease.</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
              <Plus className="h-5 w-5" /> Create New Script
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card text-card-foreground border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl">Create New Script</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Give your new screenplay a title and optional description.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-6">
              <div className="grid gap-2">
                <Label htmlFor="title" className="text-foreground">Title</Label>
                <Input 
                  id="title" 
                  placeholder="e.g. The Midnight Heist" 
                  value={newScriptTitle}
                  onChange={(e) => setNewScriptTitle(e.target.value)}
                  className="bg-background border-border text-foreground focus:ring-primary"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="writtenBy" className="text-foreground">Written by</Label>
                <Input 
                  id="writtenBy" 
                  placeholder="Your Name" 
                  value={newScriptWrittenBy}
                  onChange={(e) => setNewScriptWrittenBy(e.target.value)}
                  className="bg-background border-border text-foreground focus:ring-primary"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description" className="text-foreground">Description (Optional)</Label>
                <Input 
                  id="description" 
                  placeholder="A short logline or summary..." 
                  value={newScriptDesc}
                  onChange={(e) => setNewScriptDesc(e.target.value)}
                  className="bg-background border-border text-foreground focus:ring-primary"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setNewScriptTitle("");
                  setNewScriptDesc("");
                }}
                className="border-border text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateScript} 
                disabled={!newScriptTitle.trim() || isCreating}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {scripts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-24 bg-muted/20 border-dashed border-border">
          <FileText className="h-16 w-16 text-muted-foreground/50 mb-6" />
          <h3 className="text-2xl font-semibold text-foreground">No scripts yet</h3>
          <p className="text-muted-foreground mb-8 text-center max-w-md">
            Your creative journey starts here. Create your first script and start writing your next big movie!
          </p>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-6 text-lg rounded-full shadow-lg">
                <Plus className="h-5 w-5" /> Start Your First Script
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card text-card-foreground border-border">
               <DialogHeader>
                <DialogTitle className="text-2xl">Create New Script</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Give your new screenplay a title and optional description.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-6">
                <div className="grid gap-2">
                  <Label htmlFor="title" className="text-foreground">Title</Label>
                  <Input 
                    id="title" 
                    placeholder="Untitled Script" 
                    value={newScriptTitle}
                    onChange={(e) => setNewScriptTitle(e.target.value)}
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="writtenBy" className="text-foreground">Written by</Label>
                  <Input 
                    id="writtenBy" 
                    placeholder="Your Name" 
                    value={newScriptWrittenBy}
                    onChange={(e) => setNewScriptWrittenBy(e.target.value)}
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description" className="text-foreground">Description (Optional)</Label>
                  <Input 
                    id="description" 
                    placeholder="A short logline or summary..." 
                    value={newScriptDesc}
                    onChange={(e) => setNewScriptDesc(e.target.value)}
                    className="bg-background border-border text-foreground"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateScript} disabled={!newScriptTitle.trim() || isCreating} className="bg-primary text-primary-foreground">
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {scripts.map((script) => (
            <Card key={script.id} className="group hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-xl bg-card overflow-hidden">
              <CardHeader className="bg-muted/5 group-hover:bg-primary/5 transition-colors duration-300">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate text-xl text-foreground group-hover:text-primary transition-colors">{script.title}</CardTitle>
                    <CardDescription className="truncate text-muted-foreground mt-1">
                      {script.description || "No description provided"}
                    </CardDescription>
                  </div>
                  <div className="bg-primary/10 p-3 rounded-xl transition-transform duration-300 group-hover:scale-110">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                   <div className="h-2 w-2 rounded-full bg-primary/40"></div>
                   Last updated: {script.updatedAt?.toDate ? script.updatedAt.toDate().toLocaleDateString() : 'Just now'}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t border-border pt-4 bg-muted/5 group-hover:bg-primary/5 transition-colors duration-300">
                <div className="flex gap-1">
                  <Link href={`/script-writing/${script.id}`}>
                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10" title="Edit">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10" 
                    title="Download PDF"
                    onClick={() => handleExportPDF(script)}
                    disabled={isExporting === script.id}
                  >
                    {isExporting === script.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                    title="Delete"
                    onClick={() => handleDeleteScript(script.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Link href={`/script-writing/${script.id}`}>
                  <Button size="sm" className="gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border-none">
                    Edit Script
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
