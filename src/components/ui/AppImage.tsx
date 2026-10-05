"use client"

import Image from "next/image"
import { useState, useEffect, useRef, useLayoutEffect } from "react"
import { cn } from "@/lib/utils"

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Helper to manage session cache safely
const getSessionSeenImages = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const cached = sessionStorage.getItem('seen_images_cache');
    return new Set(cached ? JSON.parse(cached) : []);
  } catch (e) {
    return new Set();
  }
};

const saveSessionSeenImages = (set: Set<string>) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem('seen_images_cache', JSON.stringify(Array.from(set)));
  } catch (e) {}
};

// Global session-level cache to track URLs that have been successfully loaded
const globalSeenImages = typeof window !== 'undefined' ? getSessionSeenImages() : new Set<string>();

interface AppImageProps {
  src?: string | null
  alt: string
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  priority?: boolean
  className?: string
  objectPosition?: "top" | "center" | "bottom" | "left" | "right" | string
  "data-ai-hint"?: string
  aiHint?: string
  fallbackSrc?: string
  loading?: "eager" | "lazy"
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement, Event>) => void
  onError?: (event: React.SyntheticEvent<HTMLImageElement, Event>) => void
  unoptimized?: boolean
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down"
}

export default function AppImage({
  src,
  alt,
  fill,
  width,
  height,
  sizes,
  priority = false,
  className,
  objectPosition = "center",
  "data-ai-hint": aiHintData,
  aiHint,
  fallbackSrc,
  loading,
  onLoad,
  onError,
  unoptimized,
  objectFit
}: AppImageProps) {

  const imgRef = useRef<HTMLImageElement>(null)
  
  // Initialize states to match server rendering.
  // This prevents hydration mismatch because both Server and Client start with identical values.
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [isPriorityActive, setIsPriorityActive] = useState(priority)

  const isDefaultImage = !src || error
  const imageSrc = isDefaultImage ? (fallbackSrc || "/default-image.png") : src

  // Check if seen client-side and sync state synchronously before paint.
  useIsomorphicLayoutEffect(() => {
    if (src && globalSeenImages.has(src)) {
      setLoaded(true);
      setIsPriorityActive(true);
    }
  }, [src]);

  // Success Handler
  const handleLoad = (e?: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (src) {
      globalSeenImages.add(src);
      saveSessionSeenImages(globalSeenImages);
    }
    setLoaded(true);
    if (onLoad && e) onLoad(e);
  };

  const handleOnError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setError(true);
    if (onError) onError(e);
  };

  // Sync state with src changes (important for carousel/lists)
  useEffect(() => {
    const seenBefore = !!src && globalSeenImages.has(src);
    if (!seenBefore) {
      setLoaded(false);
      setIsPriorityActive(priority);
    }
    setError(false);
  }, [src, priority]);

  // Synchronous Cache Check: If browser has it, show it INSTANTLY before paint.
  useIsomorphicLayoutEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
        handleLoad();
    }
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden", fill ? "w-full h-full" : "inline-block", className)}>

      {/* 
          SMOOTH PLACEHOLDER (Logo + Pulse):
          Only pulses if NEVER seen before (represented by loaded state). 
          If seen before, it gets hidden immediately before the browser paints.
      */}
      <div 
        className={cn(
            "absolute inset-0 z-10 flex items-center justify-center bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-[2px] transition-opacity duration-300",
            loaded ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
          <img
            src="/default-image.png"
            alt="loading..."
            className={cn(
                "w-full h-full object-contain p-4",
                !loaded && "animate-pulse"
            )}
          />
      </div>

      {/* ACTUAL IMAGE (Next.js Powered) */}
      <Image
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        fill={fill}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        sizes={
          sizes ||
          (fill
            ? "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            : undefined)
        }
        priority={isPriorityActive}
        loading={isPriorityActive ? undefined : (loading || "lazy")}
        onLoad={handleLoad}
        onError={handleOnError}
        data-ai-hint={aiHint || aiHintData}
        unoptimized={unoptimized}
        className={cn(
          "transition-opacity duration-300 ease-in-out",
          isDefaultImage 
            ? "object-contain bg-muted" 
            : (objectFit === 'contain' ? "object-contain" : "object-cover"),
          loaded ? "opacity-100" : "opacity-0"
        )}
        style={{ 
          objectPosition,
          zIndex: loaded ? 20 : 0 
        }}
      />
    </div>
  )
}
