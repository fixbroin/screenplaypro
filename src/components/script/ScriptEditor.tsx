"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { 
  updateScript, 
  getScript,
  subscribeToScript, 
  getNextElementType,
  exportToPDF,
  translateScriptApi,
  createScript,
  INDIAN_LANGUAGES,
  SUPPORTED_LANGUAGES,
  SOURCE_LANGUAGES
} from "@/lib/scriptUtils";
import { checkSubscriptionStatus } from "@/lib/subscriptionUtils";
import { ADMIN_EMAIL } from "@/lib/constants";
import { Script, ScriptElement, ScriptElementType, ScriptSettings } from "@/types/script";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  ArrowLeft, 
  Save, 
  Download, 
  Share2, 
  Settings, 
  Plus,
  Trash2,
  ChevronDown,
  ChevronLeft,
  Type,
  Palette,
  Bold,
  MoreVertical,
  Check,
  Maximize2,
  Languages,
  Sparkles,
  Copy,
  ArrowRightLeft,
  HelpCircle,
  Shield,
  Lock,
  ShieldAlert,
  LogIn
} from "lucide-react";
import { GuidedTourOverlay, GuidedTourStep } from "./GuidedTourOverlay";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { nanoid } from "nanoid";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const ELEMENT_LABELS: Record<ScriptElementType, string> = {
  'scene-heading': 'Scene Heading',
  'action': 'Action',
  'character': 'Character',
  'parenthetical': 'Parenthetical',
  'dialogue': 'Dialogue',
  'transition': 'Transition',
  'note': 'Note'
};

const FONT_OPTIONS = [
  { label: "Courier Prime", value: "courier" },
  { label: "Helvetica", value: "helvetica" },
  { label: "Times New Roman", value: "times" },
  { label: "Roboto", value: "roboto" },
  { label: "Noto Sans", value: "noto" }
];

const COLORS = [
  { name: 'Default', value: '' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Purple', value: '#a855f7' },
];

const HIGHLIGHTS = [
  { name: 'None', value: '' },
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Red', value: '#fecaca' },
  { name: 'Purple', value: '#e9d5ff' },
];

export function ScriptEditor({ id: propId, isSharedView }: { id?: string; isSharedView?: boolean }) {
  const params = useParams();
  const id = (propId || params?.id) as string;
  const router = useRouter();
  const { user, firestoreUser, isLoading: authLoading, triggerAuthRedirect } = useAuth();
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [accessDeniedReason, setAccessDeniedReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [colorPickerElementId, setColorPickerElementId] = useState<string | null>(null);
  const [fontSizePickerElementId, setFontSizePickerElementId] = useState<string | null>(null);
  const [fullscreenElementId, setFullscreenElementId] = useState<string | null>(null);
  const [viewportHeight, setViewportHeight] = useState('100vh');
  const [viewportOffsetTop, setViewportOffsetTop] = useState(0);

  const [translateDialogOpen, setTranslateDialogOpen] = useState(false);
  const [selectedSourceLang, setSelectedSourceLang] = useState('auto');
  const [selectedTargetLang, setSelectedTargetLang] = useState('te');
  const [translateMode, setTranslateMode] = useState<'replace' | 'new_copy'>('replace');
  const [isTranslating, setIsTranslating] = useState(false);
  const { toast } = useToast();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Guided Tour state & refs (Place 2: Editor Tour, Place 3: Side Script Tools Tour)
  const [isEditorTourOpen, setIsEditorTourOpen] = useState(false);
  const [isToolsTourOpen, setIsToolsTourOpen] = useState(false);

  const titleSaveRef = useRef<HTMLDivElement | null>(null);
  const translateBtnRef = useRef<HTMLButtonElement | null>(null);
  const shareBtnRef = useRef<HTMLButtonElement | null>(null);
  const pdfBtnRef = useRef<HTMLButtonElement | null>(null);
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null);
  const desktopToolsPanelRef = useRef<HTMLDivElement | null>(null);
  const mobileToolsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const addBottomElementBtnRef = useRef<HTMLButtonElement | null>(null);

  // Script Tools Tour target refs (both Desktop panel and Mobile dialog)
  const desktopAddBtnRef = useRef<HTMLButtonElement | null>(null);
  const desktopDeleteBtnRef = useRef<HTMLButtonElement | null>(null);
  const desktopTypeBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const mobileAddBtnRef = useRef<HTMLButtonElement | null>(null);
  const mobileDeleteBtnRef = useRef<HTMLButtonElement | null>(null);
  const mobileTypeBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (loading || authLoading || !script) return;
    try {
      const seen = localStorage.getItem("screenplay_seen_editor_tour_v1");
      if (seen !== "true") {
        const timer = setTimeout(() => {
          setIsEditorTourOpen(true);
        }, 650);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [loading, authLoading, script?.id]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    try {
      const seen = localStorage.getItem("screenplay_seen_tools_tour_v1");
      if (seen !== "true") {
        const timer = setTimeout(() => {
          setIsToolsTourOpen(true);
        }, 350);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [mobileMenuOpen]);

  const markEditorTourSeen = () => {
    setIsEditorTourOpen(false);
    try {
      localStorage.setItem("screenplay_seen_editor_tour_v1", "true");
    } catch {}
  };

  const markToolsTourSeen = () => {
    setIsToolsTourOpen(false);
    try {
      localStorage.setItem("screenplay_seen_tools_tour_v1", "true");
    } catch {}
  };

  const maybeStartDesktopToolsTourOnFirstUse = () => {
    try {
      const seen = localStorage.getItem("screenplay_seen_tools_tour_v1");
      if (seen !== "true" && !isEditorTourOpen && !isToolsTourOpen) {
        setIsToolsTourOpen(true);
      }
    } catch {}
  };

  const editorTourSteps: GuidedTourStep[] = [
    {
      getTarget: () => titleSaveRef.current,
      title: "Auto-Saving",
      message: "Your screenplay is automatically saved as you write. Your progress is always safe.",
      placement: "bottom",
      borderRadius: 10,
    },
    {
      getTarget: () => translateBtnRef.current,
      title: "Any-to-Any Translate",
      message: "Translate your screenplay between Telugu, Hindi, English, Kannada, Marathi, Tamil, and world languages in one tap.",
      placement: "bottom",
      borderRadius: 10,
    },
    {
      getTarget: () => shareBtnRef.current,
      title: "Share Screenplay",
      message: "Tap here to share your screenplay with other writers or production crew instantly.",
      placement: "bottom",
      borderRadius: 10,
    },
    {
      getTarget: () => pdfBtnRef.current,
      title: "Export PDF",
      message: "Export your screenplay as a clean, professionally formatted PDF file.",
      placement: "bottom",
      borderRadius: 10,
    },
    {
      getTarget: () => settingsBtnRef.current,
      title: "Global Settings",
      message: "Adjust formatting, toggle visual labels, or switch the editor font family here.",
      placement: "bottom",
      borderRadius: 16,
    },
    {
      getTarget: () => {
        if (typeof window !== "undefined" && window.innerWidth >= 1280 && desktopToolsPanelRef.current) {
          return desktopToolsPanelRef.current;
        }
        return mobileToolsTriggerRef.current || desktopToolsPanelRef.current;
      },
      title: "Script Tools Drawer",
      message: "Use Script Tools to add or delete blocks and switch between character names, scene headings, notes, transitions, and block types.",
      placement: "left",
      borderRadius: 20,
    },
    {
      getTarget: () => addBottomElementBtnRef.current,
      title: "Continue Writing",
      message: "Tap here to add a new script block (Dialogue, Action, Character, etc.) and keep writing!",
      placement: "top",
      borderRadius: 24,
      onShow: () => {
        addBottomElementBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      },
    },
  ];

  const getToolsTarget = (
    mobileEl: HTMLElement | null | undefined,
    desktopEl: HTMLElement | null | undefined
  ): HTMLElement | null => {
    if (mobileMenuOpen && mobileEl) return mobileEl;
    if (desktopEl && desktopEl.getBoundingClientRect().width > 0) return desktopEl;
    return mobileEl || desktopEl || null;
  };

  const toolsTourSteps: GuidedTourStep[] = [
    {
      getTarget: () => getToolsTarget(mobileAddBtnRef.current, desktopAddBtnRef.current),
      title: "Add Block",
      message: "Adds a new script element immediately after the currently active element.",
      placement: "auto",
      borderRadius: 16,
    },
    {
      getTarget: () => getToolsTarget(mobileDeleteBtnRef.current, desktopDeleteBtnRef.current),
      title: "Delete Block",
      message: "Deletes the currently active script element from your screenplay.",
      placement: "auto",
      borderRadius: 16,
    },
    {
      getTarget: () => getToolsTarget(mobileTypeBtnRefs.current["scene-heading"], desktopTypeBtnRefs.current["scene-heading"]),
      title: "Scene Heading",
      message: "Establishes a new scene with its location and time of day (e.g. INT. COFFEE SHOP - DAY).",
      placement: "auto",
      borderRadius: 14,
    },
    {
      getTarget: () => getToolsTarget(mobileTypeBtnRefs.current["action"], desktopTypeBtnRefs.current["action"]),
      title: "Action Description",
      message: "Describes character movements, descriptions, scene settings, and audible sound effects.",
      placement: "auto",
      borderRadius: 14,
    },
    {
      getTarget: () => getToolsTarget(mobileTypeBtnRefs.current["character"], desktopTypeBtnRefs.current["character"]),
      title: "Character Name",
      message: "Introduces the character who is speaking. Standard formatting centers and capitalizes this name block.",
      placement: "auto",
      borderRadius: 14,
    },
    {
      getTarget: () => getToolsTarget(mobileTypeBtnRefs.current["dialogue"], desktopTypeBtnRefs.current["dialogue"]),
      title: "Dialogue Block",
      message: "Displays the spoken words of the character. Positioned directly under their name block.",
      placement: "auto",
      borderRadius: 14,
    },
    {
      getTarget: () => getToolsTarget(mobileTypeBtnRefs.current["parenthetical"], desktopTypeBtnRefs.current["parenthetical"]),
      title: "Parenthetical Context",
      message: "Specifies character actions or vocal delivery (e.g., whispering, smiling) during dialogue.",
      placement: "auto",
      borderRadius: 14,
    },
    {
      getTarget: () => getToolsTarget(mobileTypeBtnRefs.current["transition"], desktopTypeBtnRefs.current["transition"]),
      title: "Transitions",
      message: "Indicates editorial cuts or visual cues (e.g. CUT TO:, FADE OUT.) placed on the right margin.",
      placement: "auto",
      borderRadius: 14,
    },
    {
      getTarget: () => getToolsTarget(mobileTypeBtnRefs.current["note"], desktopTypeBtnRefs.current["note"]),
      title: "Notes & Loglines",
      message: "Add annotations, reminders, or script loglines. Notes are ignored when compiling PDF drafts.",
      placement: "auto",
      borderRadius: 14,
    },
  ];

  const handleSwapLanguages = () => {
    if (selectedSourceLang === 'auto') {
      setSelectedSourceLang(selectedTargetLang);
      setSelectedTargetLang(selectedTargetLang === 'en' ? 'te' : 'en');
    } else {
      const prevSource = selectedSourceLang;
      setSelectedSourceLang(selectedTargetLang);
      setSelectedTargetLang(prevSource);
    }
  };

  const handleQuickPairSelect = (source: string, target: string) => {
    setSelectedSourceLang(source);
    setSelectedTargetLang(target);
  };

  const handleTranslateScript = async () => {
    if (!script || !user) return;
    setIsTranslating(true);
    try {
      const sourceLangObj = SOURCE_LANGUAGES.find(l => l.code === selectedSourceLang);
      const targetLangObj = SUPPORTED_LANGUAGES.find(l => l.code === selectedTargetLang);
      const sourceName = sourceLangObj ? sourceLangObj.name.replace(/^[âœ¨\s]+/, '') : selectedSourceLang;
      const targetName = targetLangObj ? targetLangObj.name : selectedTargetLang;

      toast({
        title: "Translating Script",
        description: `Translating screenplay from ${sourceName} into ${targetName}... Please wait.`,
      });

      const result = await translateScriptApi(script.content, selectedTargetLang, script.title, selectedSourceLang);

      if (translateMode === 'new_copy') {
        const targetCleanName = targetName.split(' ')[0];
        const newTitle = `${result.translatedTitle || script.title} (${targetCleanName})`;
        const newScriptId = await createScript(
          user.uid,
          user.email || '',
          newTitle,
          script.writtenBy,
          script.description
        );
        await updateScript(newScriptId, { content: result.translatedElements, settings: script.settings });
        
        toast({
          title: "Translation Complete!",
          description: `Created new script copy "${newTitle}". Redirecting...`,
        });
        setTranslateDialogOpen(false);
        router.push(`/script-writing/${newScriptId}`);
      } else {
        const updatedTitle = result.translatedTitle || script.title;
        const updatedContent = result.translatedElements;
        setScript(prev => prev ? { ...prev, title: updatedTitle, content: updatedContent } : null);
        await updateScript(id, { title: updatedTitle, content: updatedContent });
        
        toast({
          title: "Translation Complete!",
          description: `Script successfully translated to ${targetName}.`,
        });
        setTranslateDialogOpen(false);
      }
    } catch (error) {
      console.error("Translation error:", error);
      toast({
        title: "Translation Failed",
        description: (error as Error).message || "Failed to translate script. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const recalculateHeights = useCallback(() => {
    setTimeout(() => {
      Object.values(editorRefs.current).forEach(textarea => {
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = `${textarea.scrollHeight}px`;
        }
      });
    }, 50);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    
    const viewport = window.visualViewport;
    const updateViewport = () => {
      setViewportHeight(`${viewport.height}px`);
      setViewportOffsetTop(viewport.offsetTop);
    };

    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);
    updateViewport();

    return () => {
      viewport.removeEventListener('resize', updateViewport);
      viewport.removeEventListener('scroll', updateViewport);
    };
  }, []);

  useEffect(() => {
    if (script && !loading) {
      recalculateHeights();
    }
  }, [loading, script?.id, script?.content.length, recalculateHeights]);

  useEffect(() => {
    if (!id) return;
    if (authLoading) return; // Wait for Firebase Auth resolution

    let isSubscribed = true;
    setLoading(true);

    const loadScriptData = async () => {
      try {
        let token: string | undefined;
        if (user) {
          try {
            token = await user.getIdToken();
          } catch (e) {
            console.warn("Failed to get Firebase ID token:", e);
          }
        }

        const userOptions = {
          uid: user?.uid,
          email: user?.email,
          token
        };

        const fetchedScript = await getScript(id, userOptions);

        if (!isSubscribed) return;

        if (!fetchedScript) {
          if (!user && !isSharedView) {
            setIsAccessDenied(true);
            setAccessDeniedReason("This screenplay is private. You must sign in to view it.");
          }
          setScript(null);
          setLoading(false);
          return;
        }

        // Check Access Rights
        const isAdminUser = Boolean(
          (user?.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ||
          firestoreUser?.roles?.includes('admin')
        );
        const isOwnerUser = Boolean(
          user && (
            (fetchedScript.ownerId && user.uid === fetchedScript.ownerId) ||
            (fetchedScript.ownerEmail && user.email?.toLowerCase() === fetchedScript.ownerEmail.toLowerCase())
          )
        );
        const isCollaboratorUser = Boolean(
          user && fetchedScript.collaborators?.some(c => 
            c.userId === user.uid || 
            (c.email && user.email && c.email.toLowerCase() === user.email.toLowerCase())
          )
        );
        const isPublicAllowed = Boolean(isSharedView && fetchedScript.isPublic);

        if (!isAdminUser && !isOwnerUser && !isCollaboratorUser && !isPublicAllowed) {
          setIsAccessDenied(true);
          setAccessDeniedReason("This screenplay is strictly private and only accessible by its author.");
          setScript(null);
          setLoading(false);
          return;
        }

        setIsAccessDenied(false);
        setScript(fetchedScript);
        setLoading(false);

        const unsubscribe = subscribeToScript(id, (updatedScript) => {
          if (isSubscribed && updatedScript) {
            setScript(updatedScript);
          }
        }, userOptions);

        return () => unsubscribe();
      } catch (err) {
        console.error("Error loading script:", err);
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    loadScriptData();

    return () => { isSubscribed = false; };
  }, [id, authLoading, user?.uid, user?.email, isSharedView, firestoreUser]);

  const handleExportPDF = async () => {
    if (!script) return;

    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to your account to export your screenplay PDF.",
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
      setIsExporting(true);
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
      setIsExporting(false);
    }
  };

  const debouncedSave = useCallback((updatedContent: ScriptElement[], updatedSettings?: ScriptSettings) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    setSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const updateData: any = { content: updatedContent };
        if (updatedSettings) updateData.settings = updatedSettings;
        await updateScript(id, updateData, { uid: user?.uid, email: user?.email });
        setSaving(false);
      } catch (error) {
        console.error("Auto-save error:", error);
        setSaving(false);
      }
    }, 2000);
  }, [id, user?.uid, user?.email]);

  const scrollToElement = useCallback((elementId: string, smooth: boolean = true) => {
    if (typeof window === 'undefined') return;
    const textarea = editorRefs.current[elementId];
    if (!textarea) return;

    requestAnimationFrame(() => {
      textarea.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'center',
        inline: 'nearest'
      });
    });
  }, []);

  const handleFocusElement = (elementId: string) => {
    setActiveElementId(elementId);
    const textarea = editorRefs.current[elementId];
    if (!textarea) return;

    // Check if element is near viewport edges or out of view
    const rect = textarea.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;

    if (rect.bottom > windowHeight * 0.85 || rect.top < windowHeight * 0.15) {
      scrollToElement(elementId, true);
    }
  };

  const handleElementChange = (elementId: string, updates: Partial<ScriptElement>) => {
    if (!script) return;
    const isOwner = Boolean(user && ((script.ownerId && user.uid === script.ownerId) || (script.ownerEmail && user.email?.toLowerCase() === script.ownerEmail.toLowerCase())));
    const isAdminUser = Boolean((user?.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) || firestoreUser?.roles?.includes('admin'));
    const canEdit = isAdminUser || isOwner || (isSharedView && script.isPublic && script.publicPermission === 'edit') || script.collaborators.some(c => (c.userId === user?.uid || (c.email && user?.email && c.email.toLowerCase() === user.email.toLowerCase())) && c.permission === 'edit');
    
    if (!canEdit) return;

    const newContent = script.content.map(el => 
      el.id === elementId ? { ...el, ...updates } : el
    );
    setScript({ ...script, content: newContent });
    debouncedSave(newContent);
    setMobileMenuOpen(false);
    if (updates.fontSize) {
      recalculateHeights();
    }
  };

  const updateSettings = (updates: Partial<ScriptSettings>) => {
    if (!script) return;
    const newSettings = { ...(script.settings || { fontFamily: 'noto', showLabelsInPdf: true }), ...updates };
    setScript({ ...script, settings: newSettings });
    debouncedSave(script.content, newSettings);
  };

  const handleAddElement = () => {
    if (!script) return;
    const activeIndex = script.content.findIndex(el => el.id === activeElementId);
    const index = activeIndex !== -1 ? activeIndex : script.content.length - 1;
    
    const newElement: ScriptElement = {
      id: nanoid(),
      type: 'action',
      text: ''
    };
    const newContent = [...script.content];
    newContent.splice(index + 1, 0, newElement);
    setScript({ ...script, content: newContent });
    debouncedSave(newContent);

    setTimeout(() => {
      setActiveElementId(newElement.id);
      const el = editorRefs.current[newElement.id];
      if (el) {
        el.focus({ preventScroll: true });
        scrollToElement(newElement.id, true);
      }
    }, 60);
    setMobileMenuOpen(false);
  };

  const handleRemoveElement = () => {
    if (!script || !activeElementId || script.content.length <= 1) return;
    const activeIndex = script.content.findIndex(el => el.id === activeElementId);
    const nextToFocus = script.content[activeIndex - 1] || script.content[activeIndex + 1];
    
    const newContent = script.content.filter(el => el.id !== activeElementId);
    setScript({ ...script, content: newContent });
    debouncedSave(newContent);
    
    if (nextToFocus) {
      setTimeout(() => {
        setActiveElementId(nextToFocus.id);
        const el = editorRefs.current[nextToFocus.id];
        if (el) {
          el.focus({ preventScroll: true });
          scrollToElement(nextToFocus.id, true);
        }
      }, 60);
    }
    setMobileMenuOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, element: ScriptElement) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const nextType = getNextElementType(element.type);
      const newElement: ScriptElement = { id: nanoid(), type: nextType, text: '' };
      const newContent = [...script!.content];
      newContent.splice(index + 1, 0, newElement);
      setScript({ ...script!, content: newContent });
      debouncedSave(newContent);
      setTimeout(() => {
        setActiveElementId(newElement.id);
        const el = editorRefs.current[newElement.id];
        if (el) {
          el.focus({ preventScroll: true });
          scrollToElement(newElement.id, true);
        }
      }, 60);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const types: ScriptElementType[] = ['scene-heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition'];
      const currentIndex = types.indexOf(element.type);
      const nextIndex = e.shiftKey 
        ? (currentIndex - 1 + types.length) % types.length 
        : (currentIndex + 1) % types.length;
      handleElementChange(element.id, { type: types[nextIndex] });
    } else if (e.key === 'Backspace' && element.text === '' && script!.content.length > 1) {
      e.preventDefault();
      const prevElement = script!.content[index - 1];
      handleRemoveElement();
    }
  };

  const copyShareLink = () => {
    if (!script) return;
    const link = `${window.location.origin}/script/${script.shareId}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link Copied",
      description: "Shareable link copied to clipboard.",
    });
  };

  if (loading || authLoading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-background text-foreground space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Loading screenplay & verifying access...
        </p>
      </div>
    );
  }

  const isAdmin = Boolean(
    (user?.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ||
    firestoreUser?.roles?.includes('admin')
  );
  const isOwner = Boolean(
    user && (
      (script?.ownerId && user.uid === script.ownerId) ||
      (script?.ownerEmail && user.email?.toLowerCase() === script.ownerEmail.toLowerCase())
    )
  );
  const isCollaborator = Boolean(
    user && script?.collaborators?.some(c => 
      c.userId === user.uid || 
      (c.email && user.email && c.email.toLowerCase() === user.email.toLowerCase())
    )
  );
  const isPublicShared = Boolean(isSharedView && script?.isPublic);
  const hasAccess = isAdmin || isOwner || isCollaborator || isPublicShared;

  // Access Denied or Unauthenticated
  if (isAccessDenied || !hasAccess) {
    if (!user) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
          <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-2xl space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-500 shadow-sm">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                Private & Confidential
              </div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Private Screenplay</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This screenplay is private and confidential. You must sign in with your author account to view or edit this story.
              </p>
            </div>
            <div className="space-y-3 pt-2">
              <Button 
                onClick={() => triggerAuthRedirect(window.location.pathname)}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2 py-6 text-base rounded-xl shadow-md"
              >
                <LogIn className="w-4 h-4" /> Sign In to View Screenplay
              </Button>
              <div className="flex gap-2">
                <Link href="/script-writing" className="flex-1">
                  <Button variant="outline" className="w-full border-border text-foreground hover:bg-muted text-xs">
                    Dashboard
                  </Button>
                </Link>
                <Link href="/" className="flex-1">
                  <Button variant="outline" className="w-full border-border text-foreground hover:bg-muted text-xs">
                    Home
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-card border border-destructive/20 rounded-2xl p-8 text-center shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto text-destructive shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">
              Access Restricted
            </div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Access Denied</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You do not have permission to view or edit this screenplay. This story belongs to another writer and is strictly private.
            </p>
            <p className="text-xs text-muted-foreground/80 pt-1">
              Only the author can access this screenplay.
            </p>
          </div>
          <div className="px-3.5 py-2.5 rounded-lg bg-muted text-xs text-muted-foreground flex items-center justify-between border">
            <span className="font-medium text-foreground">Signed in as:</span>
            <span className="truncate max-w-[200px] font-mono">{user.email || user.displayName || user.uid}</span>
          </div>
          <div className="space-y-3 pt-2">
            <Link href="/script-writing" className="block w-full">
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2 py-6 text-base rounded-xl shadow-md">
                Go to My Screenplays
              </Button>
            </Link>
            <Link href="/" className="block w-full">
              <Button variant="outline" className="w-full border-border text-foreground hover:bg-muted text-xs">
                Back to Homepage
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!script) {
    return (
      <div className="container mx-auto py-20 text-center bg-background min-h-screen flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-foreground">Screenplay Not Found</h2>
        <p className="text-muted-foreground mt-2">The screenplay you are looking for does not exist or may have been deleted.</p>
        <Link href="/script-writing" className="mt-6 inline-block">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const canEdit = isAdmin || isOwner || (isPublicShared && script.publicPermission === 'edit') || Boolean(script.collaborators?.some(c => (c.userId === user?.uid || (c.email && user?.email && c.email.toLowerCase() === user.email.toLowerCase())) && c.permission === 'edit'));

  const getElementStyles = (element: ScriptElement) => {
    let baseStyles = "w-full resize-none overflow-hidden bg-transparent focus:outline-none p-1 transition-all duration-200 ";
    
    switch (element.type) {
      case 'scene-heading': baseStyles += 'font-bold uppercase mb-1 mt-8 '; break;
      case 'action': baseStyles += 'mb-1 '; break;
      case 'character': baseStyles += 'text-center w-[50%] mx-auto font-bold uppercase mt-4 '; break;
      case 'parenthetical': baseStyles += 'text-center w-[30%] mx-auto italic mb-1 '; break;
      case 'dialogue': baseStyles += 'text-center w-[60%] mx-auto mb-1 '; break;
      case 'transition': baseStyles += 'text-right uppercase mb-1 mt-4 '; break;
      case 'note': baseStyles += 'italic text-muted-foreground bg-muted p-2 rounded mb-1 text-sm '; break;
    }

    const inlineStyles: any = {};
    if (element.color) inlineStyles.color = element.color;
    if (element.highlight) inlineStyles.backgroundColor = element.highlight;
    if (element.fontWeight === 'bold') inlineStyles.fontWeight = 'bold';
    if (element.fontSize === 'small') inlineStyles.fontSize = '12px';
    if (element.fontSize === 'large') inlineStyles.fontSize = '18px';

    return { className: baseStyles, style: inlineStyles };
  };

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-300 relative">
      <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-2 sm:px-4 py-1.5 sm:py-2.5">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink">
            <Link href="/script-writing">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 sm:h-8 sm:w-8 text-foreground hover:bg-primary hover:text-primary-foreground shrink-0 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </Link>
            <div ref={titleSaveRef} className="px-0.5 sm:px-1 py-0.5 rounded-lg min-w-0 max-w-[75px] xs:max-w-[120px] sm:max-w-[200px] md:max-w-[320px]">
              <h1 className="font-bold text-[11px] sm:text-sm md:text-base truncate text-foreground leading-tight">
                {script.title}
              </h1>
              <div className="text-[9px] sm:text-[10px] text-muted-foreground flex items-center gap-1 sm:gap-1.5 mt-0.5 font-medium">
                {saving ? (
                  <>
                    <Loader2 className="h-2 w-2 sm:h-2.5 sm:w-2.5 animate-spin shrink-0" /> 
                    <span className="truncate">Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0" /> 
                    <span className="truncate">Saved</span>
                  </>
                )}
                {isAdmin && !isOwner && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-bold shrink-0">
                    <Shield className="w-2.5 h-2.5" /> Admin View
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-1">
            <Button 
              ref={translateBtnRef}
              variant="outline" 
              size="sm" 
              className="h-7 sm:h-8 px-1.5 sm:px-2.5 gap-1 border-emerald-600 bg-background text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white text-[9.5px] sm:text-xs font-bold transition-all shadow-sm" 
              onClick={() => setTranslateDialogOpen(true)}
            >
              <Languages className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
              <span>Translate</span>
            </Button>
            <Button
              ref={shareBtnRef}
              variant="outline"
              size="sm"
              className="h-7 sm:h-8 px-1.5 sm:px-2.5 gap-1 border-primary bg-background text-primary hover:bg-primary hover:text-primary-foreground text-[9.5px] sm:text-xs font-bold transition-all shadow-sm"
              onClick={() => setShareDialogOpen(true)}
            >
              <Share2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
              <span className="hidden min-[360px]:inline">Share</span>
            </Button>
            <Button 
              ref={pdfBtnRef}
              variant="default" 
              size="sm" 
              className="h-7 sm:h-8 px-1.5 sm:px-2.5 gap-1 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground text-[9.5px] sm:text-xs font-bold transition-all shadow-sm" 
              onClick={handleExportPDF}
              disabled={isExporting}
            >
              {isExporting ? <Loader2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin shrink-0" /> : <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />}
              <span>{isExporting ? '...' : 'PDF'}</span>
            </Button>
            <Button
              ref={settingsBtnRef}
              variant="ghost"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
              onClick={() => setSettingsDialogOpen(true)}
              title="Global Settings"
            >
              <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
              onClick={() => setIsEditorTourOpen(true)}
              title="Start Editor Guided Tour"
            >
              <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* DESKTOP FIXED SIDE PANEL (FAR RIGHT) */}
      {canEdit && (
        <div className="hidden xl:flex fixed right-8 top-1/2 -translate-y-1/2 flex-col gap-4 z-40 transition-all">
          <div
            ref={desktopToolsPanelRef}
            onClickCapture={maybeStartDesktopToolsTourOnFirstUse}
            className="bg-card border border-border p-5 rounded-[2.5rem] shadow-2xl flex flex-col gap-2 items-stretch min-w-[190px]"
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Script Tools</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsToolsTourOpen(true);
                }}
                className="text-muted-foreground hover:text-primary transition-colors p-1 rounded-full hover:bg-muted"
                title="Script Tools Tour"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </div>
            
            <div className="flex gap-2 mb-4 items-center">
              <Button 
                ref={desktopAddBtnRef}
                variant="default" 
                className="flex-1 h-12 rounded-2xl shadow-md gap-2 font-bold bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                onClick={handleAddElement}
              >
                <Plus className="h-5 w-5" /> Add
              </Button>
              <Button 
                ref={desktopDeleteBtnRef}
                variant="destructive" 
                size="icon" 
                className="h-12 w-12 rounded-2xl shadow-md bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground"
                onClick={handleRemoveElement}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>

            <p className="text-[9px] font-bold text-muted-foreground uppercase mb-2 px-2">Change Type</p>
            {Object.entries(ELEMENT_LABELS).map(([type, label]) => {
              const isActive = activeElementId && script.content.find(el => el.id === activeElementId)?.type === type;
              return (
                <Button 
                  key={type} 
                  ref={(el) => { desktopTypeBtnRefs.current[type] = el; }}
                  variant="ghost"
                  size="sm"
                  className={`justify-start gap-3 h-10 px-4 rounded-xl transition-all shadow-sm ${
                    isActive 
                      ? 'bg-primary text-primary-foreground font-black ring-2 ring-primary ring-offset-2 ring-offset-background hover:bg-primary hover:text-primary-foreground' 
                      : 'bg-secondary/60 text-secondary-foreground font-bold hover:bg-primary hover:text-primary-foreground'
                  }`}
                  onClick={() => activeElementId && handleElementChange(activeElementId, { type: type as ScriptElementType })}
                >
                  <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-primary-foreground' : 'bg-primary'}`}></div>
                  <span className="text-[11px] uppercase truncate">{label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* MOBILE POPUP MENU (TRIGGERED FROM SIDE) */}
      {canEdit && (
        <div className="xl:hidden fixed right-0 top-1/2 -translate-y-1/2 z-40">
          <Dialog
            open={mobileMenuOpen}
            onOpenChange={(open) => {
              if (!open && isToolsTourOpen) return;
              setMobileMenuOpen(open);
            }}
          >
            <DialogTrigger asChild>
              <Button 
                ref={mobileToolsTriggerRef}
                size="icon" 
                className="h-14 w-8 rounded-l-2xl rounded-r-none shadow-2xl bg-primary text-primary-foreground hover:w-10 transition-all flex items-center justify-center pl-1"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            </DialogTrigger>
            <DialogContent
              onPointerDownOutside={(e) => {
                if (isToolsTourOpen) e.preventDefault();
              }}
              onInteractOutside={(e) => {
                if (isToolsTourOpen) e.preventDefault();
              }}
              onEscapeKeyDown={(e) => {
                if (isToolsTourOpen) e.preventDefault();
              }}
              className="w-[92vw] max-w-[92vw] sm:max-w-md rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 border-none shadow-2xl bg-card text-card-foreground"
            >
              <DialogHeader>
                <div className="flex items-center justify-center gap-2">
                  <DialogTitle className="text-primary text-xl sm:text-2xl font-black uppercase tracking-tighter text-center">Script Menu</DialogTitle>
                  <button
                    type="button"
                    onClick={() => setIsToolsTourOpen(true)}
                    className="text-muted-foreground hover:text-primary transition-colors p-1 rounded-full hover:bg-muted"
                    title="Script Tools Tour"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </div>
                <DialogDescription className="text-center text-xs sm:text-sm">Manage your screenplay elements and actions.</DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 sm:gap-6 mt-4 sm:mt-6 min-w-0">
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    ref={mobileAddBtnRef}
                    variant="default" 
                    className="h-14 sm:h-16 rounded-2xl font-black text-sm sm:text-base shadow-lg gap-2 sm:gap-3 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                    onClick={handleAddElement}
                  >
                    <Plus className="h-5 w-5 sm:h-6 sm:w-6" /> Add
                  </Button>
                  <Button 
                    ref={mobileDeleteBtnRef}
                    variant="destructive" 
                    className="h-14 sm:h-16 rounded-2xl font-black text-sm sm:text-base shadow-lg gap-2 sm:gap-3 bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground"
                    onClick={handleRemoveElement}
                  >
                    <Trash2 className="h-5 w-5 sm:h-6 sm:w-6" /> Delete
                  </Button>
                </div>

                <div className="h-px bg-border my-1"></div>
                <p className="text-xs font-bold text-muted-foreground uppercase text-center mb-1">Change Block Type:</p>
                
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(ELEMENT_LABELS).map(([type, label]) => {
                    const isActive = activeElementId && script.content.find(el => el.id === activeElementId)?.type === type;
                    return (
                      <Button 
                        key={type} 
                        ref={(el) => { mobileTypeBtnRefs.current[type] = el; }}
                        variant="outline"
                        className={`h-11 sm:h-12 text-xs font-bold rounded-xl transition-all ${
                          isActive 
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 hover:bg-primary hover:text-primary-foreground' 
                            : 'bg-background text-foreground hover:bg-primary hover:text-primary-foreground border-border'
                        }`}
                        onClick={() => activeElementId && handleElementChange(activeElementId, { type: type as ScriptElementType })}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <main className="flex-1 overflow-y-auto bg-muted/30 py-10 px-4 flex justify-center relative">
        <div 
          className="w-full max-w-[850px] min-h-[1100px] bg-card text-card-foreground shadow-xl border p-4 sm:p-8 md:p-20 font-mono text-[14px] transition-colors duration-300"
          style={{ 
            fontFamily: 
              script.settings?.fontFamily === "courier" ? "var(--font-courier), monospace" :
              script.settings?.fontFamily === "helvetica" ? "Arial, sans-serif" :
              script.settings?.fontFamily === "times" ? "var(--font-times), serif" :
              script.settings?.fontFamily === "roboto" ? "var(--font-roboto), sans-serif" :
              "var(--font-noto), sans-serif"
          }}
        >
          <div className="mb-20 text-center">
             <h2 className="text-2xl font-bold uppercase mb-2 tracking-widest">{script.title}</h2>
             <p className="mb-4 text-muted-foreground">Written by</p>
             <p className="font-bold underline uppercase">{script.writtenBy || script.ownerEmail?.split('@')[0] || "Author"}</p>
          </div>

          <div className="space-y-4">
            {script.content.map((element, index) => {
              const styles = getElementStyles(element);
              return (
                <div key={element.id} className={`group relative rounded-md transition-all duration-200 p-2 ${activeElementId === element.id ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}>
                  
                  {/* Element Label & Styling Controls Above Text */}
                  <div className="mb-1 flex justify-between items-center text-[10px] text-muted-foreground/60">
                    <span className="uppercase tracking-tighter font-semibold">{ELEMENT_LABELS[element.type]}</span>
                    
                    {/* Styling Controls - Only visible for active element or on hover */}
                    <div className={`flex items-center gap-1.5 transition-opacity ${activeElementId === element.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <Button 
                        variant="ghost" size="icon" className="h-6 w-6 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors" 
                        onClick={() => handleElementChange(element.id, { fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })}
                        title="Bold"
                      >
                        <Bold className={`h-3 w-3 ${element.fontWeight === 'bold' ? 'text-primary' : ''}`} />
                      </Button>
                      
                      {isMobile ? (
                        <Button 
                          variant="ghost" size="icon" className="h-6 w-6 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() => setColorPickerElementId(element.id)}
                          title="Color"
                        >
                          <Palette className="h-3 w-3" />
                        </Button>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors" title="Color">
                              <Palette className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuLabel className="text-xs">Text Color</DropdownMenuLabel>
                            <div className="grid grid-cols-3 gap-1 p-2">
                              {COLORS.map(c => (
                                <button 
                                  key={c.value} 
                                  className="h-6 w-6 rounded border border-border flex items-center justify-center"
                                  style={{ backgroundColor: c.value || 'white' }}
                                  onClick={() => handleElementChange(element.id, { color: c.value })}
                                >
                                  {element.color === c.value && <Check className="h-3 w-3 text-black bg-white/50 rounded-full" />}
                                </button>
                              ))}
                            </div>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs">Highlight</DropdownMenuLabel>
                            <div className="grid grid-cols-3 gap-1 p-2">
                              {HIGHLIGHTS.map(h => (
                                <button 
                                  key={h.value} 
                                  className="h-6 w-6 rounded border border-border flex items-center justify-center"
                                  style={{ backgroundColor: h.value || 'transparent' }}
                                  onClick={() => handleElementChange(element.id, { highlight: h.value })}
                                >
                                  {element.highlight === h.value && <Check className="h-3 w-3 text-black" />}
                                </button>
                              ))}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      {isMobile ? (
                        <Button 
                          variant="ghost" size="icon" className="h-6 w-6 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() => setFontSizePickerElementId(element.id)}
                          title="Font Size"
                        >
                          <Type className="h-3 w-3" />
                        </Button>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors" title="Font Size">
                              <Type className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleElementChange(element.id, { fontSize: 'small' })}>Small</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleElementChange(element.id, { fontSize: 'medium' })}>Medium</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleElementChange(element.id, { fontSize: 'large' })}>Large</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors" 
                        onClick={() => setFullscreenElementId(element.id)}
                        title="Fullscreen Focus"
                      >
                        <Maximize2 className="h-3 w-3" />
                      </Button>

                      {script.content.length > 1 && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors" 
                          onClick={() => {
                            setActiveElementId(element.id);
                            handleRemoveElement();
                          }}
                          title="Delete Element"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <textarea
                    ref={el => { editorRefs.current[element.id] = el }}
                    value={element.text}
                    onChange={(e) => handleElementChange(element.id, { text: e.target.value })}
                    onKeyDown={(e) => handleKeyDown(e, index, element)}
                    onFocus={() => handleFocusElement(element.id)}
                    placeholder={ELEMENT_LABELS[element.type]}
                    className={styles.className}
                    style={styles.style}
                    rows={1}
                    disabled={!canEdit}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                  />
                </div>
              );
            })}
          </div>

          {canEdit && (
            <div className="mt-16 flex justify-center border-t border-dashed border-border pt-10">
               <Button 
                 ref={addBottomElementBtnRef}
                 variant="outline" 
                 className="gap-2 bg-card text-primary border-2 border-primary hover:bg-primary hover:text-primary-foreground font-bold transition-all shadow-md px-8 py-5 rounded-full" 
                 onClick={handleAddElement}
               >
                 <Plus className="h-5 w-5" /> Add New Element
               </Button>
            </div>
          )}
        </div>
      </main>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="bg-card text-card-foreground border-border">
          <DialogHeader>
            <DialogTitle>Share Script</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Anyone with the link can access this script based on your settings.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-foreground">Public Access</Label>
                <p className="text-xs text-muted-foreground">Make this script accessible via a link.</p>
              </div>
              <Switch 
                checked={script.isPublic} 
                onCheckedChange={(checked) => updateScript(script.id, { isPublic: checked })} 
              />
            </div>
            
            {script.isPublic && (
              <>
                <div className="grid gap-2">
                  <Label className="text-foreground">Public Permission</Label>
                  <Select 
                    value={script.publicPermission} 
                    onValueChange={(val: any) => updateScript(script.id, { publicPermission: val })}
                  >
                    <SelectTrigger className="bg-background border-border text-foreground">
                      <SelectValue placeholder="Select permission" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="view">View Only</SelectItem>
                      <SelectItem value="edit">Allow Editing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Input 
                    value={`${window.location.origin}/script/${script.shareId}`} 
                    readOnly 
                    className="bg-muted text-foreground border-border"
                  />
                  <Button onClick={copyShareLink} className="bg-primary text-primary-foreground">Copy</Button>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShareDialogOpen(false)} className="bg-primary text-primary-foreground">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="bg-card text-card-foreground border-border">
          <DialogHeader>
            <DialogTitle>Global Script Settings</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editor-writtenBy">Written by</Label>
              <Input 
                id="editor-writtenBy" 
                value={script.writtenBy || ""} 
                onChange={(e) => {
                  const val = e.target.value;
                  setScript({ ...script, writtenBy: val });
                  // We can use a dedicated update function or the existing updateScript
                  updateScript(script.id, { writtenBy: val });
                }}
                className="bg-background border-border text-foreground"
              />
            </div>
            <div className="grid gap-2">
              <Label>Primary Font Family</Label>
              <Select 
                value={script.settings?.fontFamily || 'courier'} 
                onValueChange={(val: any) => updateSettings({ fontFamily: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map(font => (
                    <SelectItem key={font.value} value={font.value}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground italic">Note: Custom fonts are emulated in PDF using standard families for maximum compatibility.</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Element Labels in PDF</Label>
                <p className="text-xs text-muted-foreground">Adds small labels like "ACTION" or "CHARACTER" to the PDF.</p>
              </div>
              <Switch 
                checked={script.settings?.showLabelsInPdf} 
                onCheckedChange={(checked) => updateSettings({ showLabelsInPdf: checked })} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSettingsDialogOpen(false)} className="bg-primary text-primary-foreground">Save & Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Color Picker Dialog */}
      <Dialog open={!!colorPickerElementId} onOpenChange={(open) => !open && setColorPickerElementId(null)}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-[2rem] p-6 border border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-primary text-lg font-bold uppercase tracking-wider text-center">Text Styling</DialogTitle>
          </DialogHeader>
          {colorPickerElementId && (() => {
            const el = script.content.find(e => e.id === colorPickerElementId);
            return (
              <div className="grid gap-6 mt-4">
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase text-center">Text Color</p>
                  <div className="grid grid-cols-6 gap-2 justify-items-center">
                    {COLORS.map(c => (
                      <button 
                        key={c.value} 
                        className="h-8 w-8 rounded-full border border-border flex items-center justify-center shadow-sm relative"
                        style={{ backgroundColor: c.value || 'white' }}
                        onClick={() => {
                          handleElementChange(colorPickerElementId, { color: c.value });
                          setColorPickerElementId(null);
                        }}
                      >
                        {el?.color === c.value && <Check className="h-4 w-4 text-black bg-white/50 rounded-full" />}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="h-px bg-border my-2"></div>
                
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase text-center">Highlight</p>
                  <div className="grid grid-cols-6 gap-2 justify-items-center">
                    {HIGHLIGHTS.map(h => (
                      <button 
                        key={h.value} 
                        className="h-8 w-8 rounded-full border border-border flex items-center justify-center shadow-sm relative"
                        style={{ backgroundColor: h.value || 'transparent' }}
                        onClick={() => {
                          handleElementChange(colorPickerElementId, { highlight: h.value });
                          setColorPickerElementId(null);
                        }}
                      >
                        {el?.highlight === h.value && <Check className="h-4 w-4 text-black" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Mobile Font Size Dialog */}
      <Dialog open={!!fontSizePickerElementId} onOpenChange={(open) => !open && setFontSizePickerElementId(null)}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-[2rem] p-6 border border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-primary text-lg font-bold uppercase tracking-wider text-center">Font Size</DialogTitle>
          </DialogHeader>
          {fontSizePickerElementId && (() => {
            const el = script.content.find(e => e.id === fontSizePickerElementId);
            return (
              <div className="grid gap-3 mt-4">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <Button
                    key={size}
                    variant={el?.fontSize === size ? "default" : "outline"}
                    className={`h-12 text-sm font-bold rounded-xl capitalize transition-all ${
                      el?.fontSize === size
                        ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                        : 'bg-background text-foreground hover:bg-primary hover:text-primary-foreground'
                    }`}
                    onClick={() => {
                      handleElementChange(fontSizePickerElementId, { fontSize: size });
                      setFontSizePickerElementId(null);
                    }}
                  >
                    {size}
                  </Button>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Fullscreen Editor Overlay */}
      {fullscreenElementId && (() => {
        const element = script.content.find(el => el.id === fullscreenElementId);
        if (!element) return null;
        return (
          <div 
            className="fixed left-0 right-0 bg-background z-40 flex flex-col animate-in slide-in-from-bottom duration-200"
            style={{
              height: viewportHeight,
              top: `${viewportOffsetTop}px`
            }}
          >
            <header className="border-b bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2 px-2 text-foreground hover:bg-primary hover:text-primary-foreground font-bold transition-colors"
                onClick={() => {
                  setFullscreenElementId(null);
                  recalculateHeights();
                }}
              >
                <ChevronLeft className="h-5 w-5" /> Back
              </Button>
              <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                {ELEMENT_LABELS[element.type]}
              </span>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" size="icon" className="h-8 w-8 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors" 
                  onClick={() => handleElementChange(element.id, { fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })}
                >
                  <Bold className={`h-4 w-4 ${element.fontWeight === 'bold' ? 'text-primary' : ''}`} />
                </Button>
                <Button 
                  variant="ghost" size="icon" className="h-8 w-8 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => setColorPickerElementId(element.id)}
                >
                  <Palette className={`h-4 w-4 ${element.color || element.highlight ? 'text-primary' : ''}`} />
                </Button>
                <Button 
                  variant="ghost" size="icon" className="h-8 w-8 text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => setFontSizePickerElementId(element.id)}
                >
                  <Type className={`h-4 w-4 ${element.fontSize && element.fontSize !== 'medium' ? 'text-primary' : ''}`} />
                </Button>
                {script.content.length > 1 && (
                  <Button 
                    variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    onClick={() => {
                      handleRemoveElement();
                      setFullscreenElementId(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </header>
            <main className="flex-1 p-6 bg-background flex flex-col">
              <textarea
                autoFocus
                data-no-scroll="true"
                value={element.text}
                onChange={(e) => handleElementChange(element.id, { text: e.target.value })}
                placeholder={`Enter ${ELEMENT_LABELS[element.type]} text...`}
                className="flex-1 w-full resize-none bg-transparent focus:outline-none font-mono text-[16px] leading-relaxed"
                style={{
                  color: element.color || undefined,
                  backgroundColor: element.highlight || undefined,
                  fontWeight: element.fontWeight || undefined,
                  fontSize: element.fontSize === 'small' ? '14px' : element.fontSize === 'large' ? '20px' : '16px',
                }}
              />
            </main>
          </div>
        );
      })()}
      <Dialog open={translateDialogOpen} onOpenChange={setTranslateDialogOpen}>
        <DialogContent className="w-[92vw] sm:max-w-2xl max-h-[90vh] max-h-[90dvh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl sm:rounded-3xl p-5 sm:p-8 border shadow-2xl">
          <DialogHeader className="min-w-0">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-3">
              <Languages className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-center">
              Any-to-Any Script Translator
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground text-xs sm:text-sm mt-1">
              Translate your screenplay between any languages (Telugu, Hindi, English, Kannada, Marathi, Tamil, and world languages) with formatting preserved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-3 min-w-0 w-full">
            {/* From - Swap - To Language Selector */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="w-full sm:flex-1 min-w-0">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Translate From
                </Label>
                <Select value={selectedSourceLang} onValueChange={setSelectedSourceLang}>
                  <SelectTrigger className="w-full h-11 rounded-xl font-bold">
                    <SelectValue placeholder="Source Language" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-64">
                    {SOURCE_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code} className="font-bold cursor-pointer">
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex sm:flex-col items-center justify-center pt-1 sm:pt-5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleSwapLanguages}
                  className="h-10 w-10 rounded-xl bg-background text-emerald-700 border-emerald-600/40 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-sm"
                  title="Swap languages"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </Button>
              </div>

              <div className="w-full sm:flex-1 min-w-0">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Translate To
                </Label>
                <Select value={selectedTargetLang} onValueChange={setSelectedTargetLang}>
                  <SelectTrigger className="w-full h-11 rounded-xl font-bold">
                    <SelectValue placeholder="Target Language" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-64">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code} className="font-bold cursor-pointer">
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5 pt-1 min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Popular Language Pairs:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'English â†’ Telugu', src: 'en', tgt: 'te' },
                  { label: 'Telugu â†’ English', src: 'te', tgt: 'en' },
                  { label: 'Hindi â†’ Telugu', src: 'hi', tgt: 'te' },
                  { label: 'Telugu â†’ Hindi', src: 'te', tgt: 'hi' },
                  { label: 'Kannada â†’ Hindi', src: 'kn', tgt: 'hi' },
                  { label: 'Telugu â†’ Kannada', src: 'te', tgt: 'kn' },
                  { label: 'Hindi â†’ Marathi', src: 'hi', tgt: 'mr' },
                  { label: 'Marathi â†’ Hindi', src: 'mr', tgt: 'hi' },
                  { label: 'English â†’ Marathi', src: 'en', tgt: 'mr' },
                ].map((pair, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickPairSelect(pair.src, pair.tgt)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all",
                      selectedSourceLang === pair.src && selectedTargetLang === pair.tgt
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-secondary/60 hover:bg-emerald-600 border-border text-foreground hover:text-white hover:border-emerald-600"
                    )}
                  >
                    {pair.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Translation Mode */}
            <div className="min-w-0">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                Translation Mode
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTranslateMode('replace')}
                  className={cn(
                    "p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between h-20",
                    translateMode === 'replace' 
                      ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-bold" 
                      : "border-border text-muted-foreground hover:border-muted-foreground/40"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold">Translate Current</span>
                    {translateMode === 'replace' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </div>
                  <span className="text-[10px] opacity-80 leading-tight">Overwrites text in current script</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTranslateMode('new_copy')}
                  className={cn(
                    "p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between h-20",
                    translateMode === 'new_copy' 
                      ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-bold" 
                      : "border-border text-muted-foreground hover:border-muted-foreground/40"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold">Create New Copy</span>
                    {translateMode === 'new_copy' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </div>
                  <span className="text-[10px] opacity-80 leading-tight">Saves as a new translated script</span>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 min-w-0">
            <Button
              variant="outline"
              onClick={() => setTranslateDialogOpen(false)}
              disabled={isTranslating}
              className="rounded-xl font-bold w-full sm:w-auto bg-background text-foreground border-border hover:bg-muted hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleTranslateScript}
              disabled={isTranslating}
              className="rounded-xl font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 w-full sm:w-auto"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Translating Script...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Translate Entire Script
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Place 2: Editor Screen Guided Feature Tour (Responsive Desktop & Mobile) */}
      <GuidedTourOverlay
        steps={editorTourSteps}
        isOpen={isEditorTourOpen}
        onComplete={markEditorTourSeen}
        onSkip={markEditorTourSeen}
      />

      {/* Place 3: Side Script Tools Tour (Responsive Desktop Panel & Mobile Side Popup) */}
      <GuidedTourOverlay
        steps={toolsTourSteps}
        isOpen={isToolsTourOpen}
        onComplete={markToolsTourSeen}
        onSkip={markToolsTourSeen}
      />
    </div>
  );
}