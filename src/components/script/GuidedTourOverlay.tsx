"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

export type TooltipPlacement = "top" | "bottom" | "left" | "right" | "auto";

export interface GuidedTourStep {
  /** Returns the DOM element to spotlight for this step */
  getTarget: () => HTMLElement | null;
  title: string;
  message: string;
  placement?: TooltipPlacement;
  borderRadius?: number;
  onShow?: () => void;
}

interface GuidedTourOverlayProps {
  steps: GuidedTourStep[];
  isOpen: boolean;
  onComplete: () => void;
  onSkip?: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function GuidedTourOverlay({
  steps,
  isOpen,
  onComplete,
  onSkip,
}: GuidedTourOverlayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [bubbleSize, setBubbleSize] = useState<{ width: number; height: number }>({
    width: 280,
    height: 165,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen]);

  const updateMeasurement = useCallback(() => {
    if (!isOpen || steps.length === 0) return;
    const step = steps[currentIndex];
    if (!step) return;
    const el = step.getTarget();
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      } else {
        setTargetRect(null);
      }
    } else {
      setTargetRect(null);
    }

    if (bubbleRef.current) {
      const bRect = bubbleRef.current.getBoundingClientRect();
      if (bRect.width > 0 && bRect.height > 0) {
        setBubbleSize({ width: bRect.width, height: bRect.height });
      }
    }
  }, [isOpen, steps, currentIndex]);

  useEffect(() => {
    if (!isOpen || steps.length === 0) return;
    const step = steps[currentIndex];
    if (!step) return;

    step.onShow?.();

    const el = step.getTarget();
    if (el) {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.top < 60 || rect.bottom > vh - 60) {
        try {
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        } catch {
          // Ignore scrollIntoView errors
        }
      }
    }

    // Measure immediately and after scroll/layout settles
    updateMeasurement();
    const t1 = setTimeout(updateMeasurement, 120);
    const t2 = setTimeout(updateMeasurement, 320);
    const t3 = setTimeout(updateMeasurement, 500);

    window.addEventListener("resize", updateMeasurement);
    window.addEventListener("scroll", updateMeasurement, true);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("resize", updateMeasurement);
      window.removeEventListener("scroll", updateMeasurement, true);
    };
  }, [isOpen, currentIndex, steps, updateMeasurement]);

  if (!mounted || !isOpen || steps.length === 0) return null;

  const step = steps[currentIndex];
  if (!step) return null;

  const isLastStep = currentIndex === steps.length - 1;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;

  const pad = 6;
  const radius = step.borderRadius ?? 12;
  const spacing = 14;

  // Responsive bubble width
  const desiredBubbleWidth = Math.min(290, vw - 24);
  const bWidth = bubbleSize.width || desiredBubbleWidth;
  const bHeight = bubbleSize.height || 165;

  let bubbleLeft = (vw - desiredBubbleWidth) / 2;
  let bubbleTop = (vh - bHeight) / 2;

  if (targetRect) {
    const spotTop = targetRect.top - pad;
    const spotLeft = targetRect.left - pad;
    const spotWidth = targetRect.width + pad * 2;
    const spotHeight = targetRect.height + pad * 2;
    const spotBottom = spotTop + spotHeight;
    const spotRight = spotLeft + spotWidth;
    const spotCenterX = spotLeft + spotWidth / 2;
    const spotCenterY = spotTop + spotHeight / 2;

    let placement: TooltipPlacement = step.placement || "auto";

    if (placement === "auto") {
      if (vh - spotBottom >= bHeight + spacing + 16) {
        placement = "bottom";
      } else if (spotTop >= bHeight + spacing + 16) {
        placement = "top";
      } else if (spotLeft >= desiredBubbleWidth + spacing + 16) {
        placement = "left";
      } else if (vw - spotRight >= desiredBubbleWidth + spacing + 16) {
        placement = "right";
      } else {
        placement = "bottom";
      }
    }

    // If preferred left/right doesn't fit on narrow screens, fallback to top/bottom
    if (
      placement === "left" &&
      spotLeft < desiredBubbleWidth + spacing + 12
    ) {
      placement = spotTop > vh / 2 ? "top" : "bottom";
    }
    if (
      placement === "right" &&
      vw - spotRight < desiredBubbleWidth + spacing + 12
    ) {
      placement = spotTop > vh / 2 ? "top" : "bottom";
    }

    // Flip top/bottom if there is not enough room on the chosen side
    if (
      placement === "bottom" &&
      spotBottom + spacing + bHeight > vh - 12 &&
      spotTop - spacing - bHeight >= 12
    ) {
      placement = "top";
    } else if (
      placement === "top" &&
      spotTop - spacing - bHeight < 12 &&
      spotBottom + spacing + bHeight <= vh - 12
    ) {
      placement = "bottom";
    }

    switch (placement) {
      case "bottom":
        bubbleLeft = spotCenterX - desiredBubbleWidth / 2;
        bubbleTop = spotBottom + spacing;
        break;
      case "top":
        bubbleLeft = spotCenterX - desiredBubbleWidth / 2;
        bubbleTop = spotTop - bHeight - spacing;
        break;
      case "left":
        bubbleLeft = spotLeft - desiredBubbleWidth - spacing;
        bubbleTop = spotCenterY - bHeight / 2;
        break;
      case "right":
        bubbleLeft = spotRight + spacing;
        bubbleTop = spotCenterY - bHeight / 2;
        break;
    }

    // Clamp strictly inside viewport bounds
    bubbleLeft = Math.max(12, Math.min(bubbleLeft, vw - desiredBubbleWidth - 12));
    bubbleTop = Math.max(12, Math.min(bubbleTop, vh - bHeight - 12));

    // If clamping caused the bubble to overlap the target itself (e.g. inside a compact grid),
    // place the bubble cleanly above or below the target if possible
    const overlapsTargetVertically =
      bubbleTop < spotBottom - 4 && bubbleTop + bHeight > spotTop + 4;
    const overlapsTargetHorizontally =
      bubbleLeft < spotRight - 4 && bubbleLeft + desiredBubbleWidth > spotLeft + 4;

    if (overlapsTargetVertically && overlapsTargetHorizontally) {
      if (spotTop >= bHeight + 16) {
        bubbleTop = Math.max(12, spotTop - bHeight - 10);
      } else if (vh - spotBottom >= bHeight + 16) {
        bubbleTop = Math.min(vh - bHeight - 12, spotBottom + 10);
      }
    }
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < steps.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] select-none"
      style={{ pointerEvents: "auto" }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Spotlight Mask */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="screenplay-tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={Math.max(0, targetRect.left - pad)}
                y={Math.max(0, targetRect.top - pad)}
                width={targetRect.width + pad * 2}
                height={targetRect.height + pad * 2}
                rx={radius}
                ry={radius}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.62)"
          mask="url(#screenplay-tour-spotlight-mask)"
        />
      </svg>

      {/* Subtle Highlight Ring around the spotlighted target */}
      {targetRect && (
        <div
          className="fixed pointer-events-none transition-all duration-200 ring-2 ring-blue-500/80 shadow-[0_0_20px_rgba(59,130,246,0.45)]"
          style={{
            top: Math.max(0, targetRect.top - pad),
            left: Math.max(0, targetRect.left - pad),
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
            borderRadius: radius,
          }}
        />
      )}

      {/* Dark Slate Tooltip Bubble (Matches Flutter App Design) */}
      <div
        ref={bubbleRef}
        style={{
          top: bubbleTop,
          left: bubbleLeft,
          width: desiredBubbleWidth,
        }}
        className="fixed bg-[#0F172A] text-white rounded-2xl p-4 sm:p-5 shadow-[0_12px_30px_rgba(0,0,0,0.45)] border border-slate-800 transition-all duration-200 animate-in fade-in zoom-in-95"
      >
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <h4 className="font-bold text-[14px] sm:text-[15px] text-white leading-snug">
            {step.title}
          </h4>
          <span className="text-[11px] sm:text-[12px] font-bold text-[#94A3B8] shrink-0">
            {currentIndex + 1}/{steps.length}
          </span>
        </div>

        <p className="text-[12.5px] sm:text-[13.5px] text-[#E2E8F0] leading-relaxed mb-4">
          {step.message}
        </p>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleSkip}
            className="text-[#94A3B8] hover:text-white font-bold text-[13px] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="bg-[#3B82F6] hover:bg-[#2563EB] active:scale-95 text-white font-bold text-[13px] px-4 py-2 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            {isLastStep ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
