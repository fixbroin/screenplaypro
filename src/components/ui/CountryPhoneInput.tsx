"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, ChevronDown, Check, X, Phone } from "lucide-react";
import {
  Country,
  ALL_COUNTRIES,
  DEFAULT_COUNTRY,
  cleanPhoneDigits,
  detectUserCountry,
} from "@/lib/countryPhoneData";
import { cn } from "@/lib/utils";

export interface CountryPhoneInputProps {
  value: string; // The national number digits (without country code)
  onChange: (nationalNumber: string, fullNumberWithCode: string, country: Country) => void;
  selectedCountry?: Country;
  onCountryChange?: (country: Country) => void;
  disabled?: boolean;
  autoDetectCountry?: boolean;
  id?: string;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  error?: string;
  showDigitCounter?: boolean;
}

export default function CountryPhoneInput({
  value = "",
  onChange,
  selectedCountry: controlledCountry,
  onCountryChange,
  disabled = false,
  autoDetectCountry = true,
  id = "mobileNumber",
  className,
  inputClassName,
  placeholder,
  error,
  showDigitCounter = true,
}: CountryPhoneInputProps) {
  const [internalCountry, setInternalCountry] = useState<Country>(controlledCountry || DEFAULT_COUNTRY);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const activeCountry = controlledCountry || internalCountry;

  // Auto-detect country based on IP/timezone on mount if not controlled
  useEffect(() => {
    if (!autoDetectCountry) return;

    let isMounted = true;
    detectUserCountry().then((detected) => {
      if (!isMounted) return;
      if (!controlledCountry) {
        setInternalCountry(detected);
        if (onCountryChange) onCountryChange(detected);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [autoDetectCountry, controlledCountry, onCountryChange]);

  // Sync controlled country if changed from outside
  useEffect(() => {
    if (controlledCountry) {
      setInternalCountry(controlledCountry);
    }
  }, [controlledCountry]);

  const handleSelectCountry = useCallback((country: Country) => {
    setInternalCountry(country);
    if (onCountryChange) onCountryChange(country);

    // Truncate current value if exceeds new country's maxLength
    const truncated = cleanPhoneDigits(value, country.maxLength);
    onChange(truncated, `${country.calling_code}${truncated}`, country);

    setIsDialogOpen(false);
    setSearchQuery("");

    // Re-focus phone input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [value, onChange, onCountryChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = cleanPhoneDigits(raw, activeCountry.maxLength);
    const fullNumber = `${activeCountry.calling_code}${digits}`;
    onChange(digits, fullNumber, activeCountry);
  };

  // Filter countries by search query
  const filteredCountries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return ALL_COUNTRIES;

    return ALL_COUNTRIES.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(query);
      const codeMatch = c.country_code.toLowerCase().includes(query);
      const callingMatch = c.calling_code.replace(/\+/g, '').includes(query.replace(/\+/g, ''));
      return nameMatch || codeMatch || callingMatch;
    });
  }, [searchQuery]);

  const popularCountries = useMemo(() => {
    if (searchQuery.trim()) return [];
    return ALL_COUNTRIES.filter((c) => c.isPopular);
  }, [searchQuery]);

  const defaultPlaceholder = activeCountry.minLength === activeCountry.maxLength
    ? `${activeCountry.maxLength}-digit mobile number`
    : `${activeCountry.minLength} to ${activeCountry.maxLength} digits`;

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      <div className="flex items-center">
        {/* Country Selector Button */}
        <button
          type="button"
          onClick={() => {
            if (!disabled) setIsDialogOpen(true);
          }}
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 h-10 rounded-l-md border border-r-0 border-input bg-muted/70 hover:bg-muted text-foreground transition-colors shrink-0 select-none focus:outline-none focus:ring-1 focus:ring-primary focus:z-10",
            disabled && "opacity-60 cursor-not-allowed hover:bg-muted/70"
          )}
          title={`Country: ${activeCountry.name} (${activeCountry.calling_code})`}
          aria-label={`Select country code, currently ${activeCountry.name} ${activeCountry.calling_code}`}
        >
          <img
            src={`/${activeCountry.flag}`}
            alt={activeCountry.name}
            className="w-5 h-3.5 object-cover rounded-xs border border-border/40 shadow-2xs shrink-0"
            onError={(e) => {
              // Hide image if flag fails to load
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <span className="font-semibold text-xs sm:text-sm font-mono tracking-tight">
            {activeCountry.calling_code}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground opacity-70 shrink-0" />
        </button>

        {/* Mobile Number Input with dynamic restriction */}
        <Input
          ref={inputRef}
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={activeCountry.maxLength}
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder || defaultPlaceholder}
          disabled={disabled}
          className={cn(
            "rounded-l-none font-medium text-foreground tracking-wide",
            error && "border-destructive focus-visible:ring-destructive",
            inputClassName
          )}
        />
      </div>

      {/* Helpful info / digit counter */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
        <span>
          {activeCountry.name} · {activeCountry.minLength === activeCountry.maxLength
            ? `${activeCountry.maxLength} digits required`
            : `${activeCountry.minLength}-${activeCountry.maxLength} digits required`}
        </span>
        {showDigitCounter && (
          <span className={cn(
            "font-mono font-medium",
            value.length === activeCountry.maxLength && "text-emerald-600 dark:text-emerald-400 font-bold",
            value.length > 0 && value.length < activeCountry.minLength && "text-amber-600 dark:text-amber-400"
          )}>
            {value.length}/{activeCountry.maxLength}
          </span>
        )}
      </div>

      {/* Country Selection Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent 
          className="max-w-[92vw] sm:max-w-md w-full max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden rounded-2xl"
          onInteractOutside={() => setIsDialogOpen(false)}
        >
          <DialogHeader className="p-4 pb-2 border-b border-border/40 text-left">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" /> Select Country Code
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Search by country name or dial code
            </DialogDescription>
          </DialogHeader>

          {/* Search Bar */}
          <div className="p-3 border-b border-border/40 bg-muted/20">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                autoFocus
                placeholder="Search country (e.g. India, +91, US)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-sm rounded-xl bg-background border-border/70 focus-visible:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Country List (scrollable) */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/20 max-h-[55vh] py-1">
            {/* Popular Countries (when not searching) */}
            {popularCountries.length > 0 && (
              <div className="pb-2">
                <div className="px-4 py-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/40">
                  Popular Countries
                </div>
                {popularCountries.map((c) => {
                  const isSelected = c.country_code === activeCountry.country_code;
                  return (
                    <button
                      key={`popular-${c.country_code}`}
                      type="button"
                      onClick={() => handleSelectCountry(c)}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-secondary/20 active:bg-secondary/40",
                        isSelected && "bg-primary/10 font-semibold"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={`/${c.flag}`}
                          alt={c.name}
                          className="w-5 h-3.5 object-cover rounded-xs border border-border/40 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <span className="text-sm truncate text-foreground">{c.name}</span>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          ({c.minLength === c.maxLength ? `${c.maxLength} digits` : `${c.minLength}-${c.maxLength}`})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-semibold text-primary">{c.calling_code}</span>
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* All / Filtered Countries */}
            <div>
              {popularCountries.length > 0 && (
                <div className="px-4 py-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/40">
                  All Countries
                </div>
              )}
              {filteredCountries.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No country found matching <span className="font-semibold text-foreground">"{searchQuery}"</span>
                </div>
              ) : (
                filteredCountries.map((c) => {
                  const isSelected = c.country_code === activeCountry.country_code;
                  return (
                    <button
                      key={c.country_code}
                      type="button"
                      onClick={() => handleSelectCountry(c)}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-secondary/20 active:bg-secondary/40",
                        isSelected && "bg-primary/10 font-semibold"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={`/${c.flag}`}
                          alt={c.name}
                          className="w-5 h-3.5 object-cover rounded-xs border border-border/40 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <span className="text-sm truncate text-foreground">{c.name}</span>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          ({c.minLength === c.maxLength ? `${c.maxLength} digits` : `${c.minLength}-${c.maxLength}`})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-semibold text-primary">{c.calling_code}</span>
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
