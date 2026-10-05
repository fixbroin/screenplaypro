"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getScriptByShareId } from "@/lib/scriptUtils";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ScriptEditor } from "@/components/script/ScriptEditor";

export default function SharedScriptPage() {
  const { shareId } = useParams();
  const [scriptId, setScriptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchScript = async () => {
      try {
        const script = await getScriptByShareId(shareId as string);
        if (script) {
          if (script.isPublic) {
            setScriptId(script.id);
          } else {
            setError("This script is private.");
          }
        } else {
          setError("Script not found.");
        }
      } catch (err) {
        console.error(err);
        setError("An error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchScript();
  }, [shareId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-20 text-center min-h-screen bg-background text-foreground">
        <h2 className="text-3xl font-bold mb-6">{error}</h2>
        <Link href="/">
          <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
            Go to Homepage
          </Button>
        </Link>
      </div>
    );
  }

  if (scriptId) {
    return <ScriptEditor id={scriptId} />;
  }

  return null;
}
