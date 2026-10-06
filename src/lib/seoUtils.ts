// src/lib/seoUtils.ts
import type { FirestoreSEOSettings } from '@/types/firestore';

// Define default SEO values for Screenplay Pro
export const defaultSeoValues: FirestoreSEOSettings = {
  siteName: 'Screenplay Pro – Industry-Standard Screenplay Writing Software & Script Editor',
  defaultMetaTitleSuffix: ' | Screenplay Pro',
  defaultMetaDescription: 'Screenplay Pro is India\'s premier online screenplay writing software and script editor. Write movie scripts, film screenplays, theater plays, and short film plots online with studio formatting, multi-language typing, and instant PDF exports.',
  defaultMetaKeywords: 'screenplay writer, online script writing software, write movie script online, screenplay editor, script formatting software, fountain script format, movie plot writer, short film screenplay, studio screenplay format, write script online, screenwriting software india, screenwriters bangalore, screenwriters mumbai, film script format, screenplay PDF export, screenplay auto save',
  homepageMetaTitle: 'Screenplay Pro – Online Screenplay Writing Software & Script Editor',
  homepageMetaDescription: 'Write, format, and manage your film screenplays online with Screenplay Pro. Studio-standard script formatting, real-time cloud backup, multi-language typing, and PDF exports.',
  homepageMetaKeywords: 'screenplay writer, online script writing software, write movie script online, screenplay editor, script formatting software, fountain script format, movie plot writer, short film screenplay, studio screenplay format, write script online, screenwriting software india, screenwriters bangalore, screenwriters mumbai, film script format, screenplay PDF export, screenplay auto save',
  homepageH1: 'Industry-Standard Online Screenplay Writing Software',
  categoryPageTitlePattern: 'Best {{categoryName}} Scriptwriting Tools & Screenplays | Screenplay Pro',
  categoryPageDescriptionPattern: 'Write, format, and edit {{categoryName}} screenplays online with Screenplay Pro. Explore studio-standard scriptwriting tools, real-time autosaving, and PDF script exports.',
  categoryPageKeywordsPattern: '{{categoryName}} scriptwriting, {{categoryName}} screenplay, write {{categoryName}} script, script editor, screenplay format, screenplay pro',
  categoryPageH1Pattern: 'Professional {{categoryName}} Scriptwriting Tools',
  cityCategoryPageTitlePattern: 'Screenplay Writers & Script Writing in {{cityName}} | Screenplay Pro',
  cityCategoryPageDescriptionPattern: 'Connect with screenplay writers and write film scripts in {{cityName}} using Screenplay Pro. Write movie plots, short film scripts, and theater screenplays in studio-standard format.',
  cityCategoryPageKeywordsPattern: 'screenplay writers {{cityName}}, script writing {{cityName}}, write script in {{cityName}}, screenwriting software {{cityName}}, film writers {{cityName}}',
  cityCategoryPageH1Pattern: 'Screenplay Writing & Scriptwriters in {{cityName}}',
  areaCategoryPageTitlePattern: 'Screenplay Writers & Script Writing in {{areaName}}, {{cityName}} | Screenplay Pro',
  areaCategoryPageDescriptionPattern: 'Discover screenplay writing tools and scriptwriting community in {{areaName}}, {{cityName}}. Write film scripts, movie screenplays, and short plots in studio-standard format.',
  areaCategoryPageKeywordsPattern: 'screenplay writers {{areaName}}, script writing {{areaName}}, screenwriters {{areaName}} {{cityName}}, write script online',
  areaCategoryPageH1Pattern: 'Screenplay Writing in {{areaName}}, {{cityName}}',
  servicePageTitlePattern: '{{serviceName}} - Scriptwriting & Screenplay Tool in {{cityName}} | Screenplay Pro',
  servicePageDescriptionPattern: 'Use {{serviceName}} screenplay tools on Screenplay Pro. Write movie scripts, short film screenplays, and theater plots in {{cityName}}, India.',
  servicePageKeywordsPattern: '{{serviceName}} scriptwriting, {{serviceName}} screenplay, write script {{cityName}}, screenplay editor',
  servicePageH1Pattern: 'Professional {{serviceName}} Screenplay Tool',
  areaPageTitlePattern: 'Screenplay Writing & Film Writers in {{areaName}}, {{cityName}} | Screenplay Pro',
  areaPageDescriptionPattern: 'Write film scripts, screenplays, and movie plots in {{areaName}}, {{cityName}} with Screenplay Pro. Studio-standard screenplay formatting and cloud backup.',
  areaPageKeywordsPattern: 'screenplay writing {{areaName}}, film scriptwriter {{areaName}}, screenwriters {{areaName}} {{cityName}}, script editor',
  areaPageH1Pattern: 'Screenplay Writing & Scriptwriters in {{areaName}}, {{cityName}}',
  cityPageTitlePattern: 'Screenplay Writing & Film Scriptwriters in {{cityName}} | Screenplay Pro',
  cityPageDescriptionPattern: 'Screenplay Pro is the premier screenplay writing software for film scriptwriters in {{cityName}}. Write movie scripts, short films, and theater plays in studio-standard format.',
  cityPageKeywordsPattern: 'screenplay writers {{cityName}}, script writing software {{cityName}}, write movie script {{cityName}}, screenwriting software, film writers {{cityName}}',
  cityPageH1Pattern: 'Screenplay Writing & Scriptwriters in {{cityName}}',
  structuredDataType: 'Organization',
  structuredDataName: 'Screenplay Pro',
  structuredDataStreetAddress: '#44, G S Palya Road, Konappana Agrahara, Electronic City Phase 2',
  structuredDataLocality: 'Bangalore',
  structuredDataRegion: 'Karnataka',
  structuredDataPostalCode: '560100',
  structuredDataCountry: 'IN',
  structuredDataTelephone: '+91-7353113455',
  structuredDataImage: 'https://screenplaypro.in/android-chrome-512x512.png',
  socialProfileUrls: {
    facebook: 'https://www.facebook.com/screenplaypro.in',
    twitter: 'https://x.com/screenplaypro_in',
    instagram: 'https://www.instagram.com/screenplaypro.in/',
    linkedin: 'https://www.linkedin.com/company/screenplaypro-in',
    youtube: 'https://www.youtube.com/@screenplaypro-in',
  },
};

/**
 * Utility to replace placeholders in a string.
 * @param template The string with placeholders like {{name}}
 * @param data An object containing values for the placeholders
 * @returns The string with placeholders replaced
 */
export function replacePlaceholders(
  template: string | undefined | null,
  data: Record<string, string | number | undefined | null>
): string {
  if (!template) return '';
  
  let result = template;
  try {
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const placeholderValue = data[key];
        if (placeholderValue !== undefined && placeholderValue !== null) {
           result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(placeholderValue));
        } else {
           result = result.replace(new RegExp(`{{${key}}}`, 'g'), '');
        }
      }
    }
  } catch (e) {
    return template;
  }
  return result.trim();
}
