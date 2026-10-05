"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { ThemeColors } from '@/types/firestore';
import { DEFAULT_LIGHT_THEME_COLORS_HSL, DEFAULT_DARK_THEME_COLORS_HSL, generatePaletteCssVariables } from '@/lib/colorUtils';

const THEME_STYLE_TAG_ID = "screenplaypro-dynamic-theme-styles";

const ThemeInjector = () => {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  useEffect(() => {
    if (!isAdmin) return;

    const applyDynamicStyles = (themeColors?: ThemeColors) => {
      let fullCssText = ":root {\n";
      fullCssText += generatePaletteCssVariables(themeColors?.light, DEFAULT_LIGHT_THEME_COLORS_HSL);
      fullCssText += "}\n\n";

      fullCssText += ".dark {\n";
      fullCssText += generatePaletteCssVariables(themeColors?.dark, DEFAULT_DARK_THEME_COLORS_HSL);
      fullCssText += "}\n";
      
      let styleTag = document.getElementById(THEME_STYLE_TAG_ID) as HTMLStyleElement | null;
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = THEME_STYLE_TAG_ID;
        document.head.appendChild(styleTag);
      }
      styleTag.textContent = fullCssText;
    };
    
    fetch('/api/db/web-settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings) {
          applyDynamicStyles(data.settings.themeColors);
        } else {
          applyDynamicStyles({
            light: DEFAULT_LIGHT_THEME_COLORS_HSL,
            dark: DEFAULT_DARK_THEME_COLORS_HSL,
          });
        }
      })
      .catch((error) => {
        console.error("Error fetching theme settings from MySQL:", error);
        applyDynamicStyles({
          light: DEFAULT_LIGHT_THEME_COLORS_HSL,
          dark: DEFAULT_DARK_THEME_COLORS_HSL,
        });
      });
  }, [isAdmin]);

  return null;
};

export default ThemeInjector;
