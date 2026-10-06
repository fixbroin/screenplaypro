// src/app/script-writing/page.tsx
import type { Metadata } from 'next';
import ScriptWritingDashboardClient from '@/components/script/ScriptWritingDashboardClient';
import JsonLdScript from '@/components/shared/JsonLdScript';
import { getBaseUrl } from '@/lib/config';

export const revalidate = false; // Cache permanently on the server side

export async function generateMetadata(): Promise<Metadata> {
  const appBaseUrl = getBaseUrl();
  const title = "Screenplay Writer & Script Writing Software Online | Screenplay Pro";
  const description = "Start writing your movie script, film screenplay, or theater play online. Screenplay Pro is India's premier screenplay writing tool for professional scriptwriters.";
  const keywords = [
    "screenplay writer", "script writing software", "write movie script online",
    "script format", "screenwriting tool", "screenplay editor", "write script online",
    "scriptwriting software india", "bangalore screenplay writers"
  ];

  return {
    title,
    description,
    keywords,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `${appBaseUrl}/script-writing`,
    },
    openGraph: {
      title,
      description,
      url: `/script-writing`,
      images: [{ url: `${appBaseUrl}/android-chrome-512x512.png`, width: 512, height: 512, alt: title }],
      type: 'website',
    },
  };
}

export default function Page() {
  const appBaseUrl = getBaseUrl();
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What features are included in Screenplay Pro script writing software?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Screenplay Pro provides studio-standard screenplay formatting, real-time cloud autosaving, multi-language typing support, and high-quality PDF script exports."
        }
      },
      {
        "@type": "Question",
        "name": "Can I export my script to PDF?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Absolutely! Our software exports scripts directly into industry-standard PDF formatting, preserving standard scriptwriting fonts and margins."
        }
      },
      {
        "@type": "Question",
        "name": "Who owns the copyright to my script?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You retain 100% ownership of your work. Screenplay Pro serves as a secure storage environment and holds no rights or claims to any screenplay written on the platform."
        }
      }
    ]
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Screenplay Pro Screenplay Editor",
    "url": `${appBaseUrl}/script-writing`,
    "image": `${appBaseUrl}/android-chrome-512x512.png`,
    "description": "Online script writing software and screenplay editor in industry standard formatting.",
    "applicationCategory": "MultimediaApplication",
    "operatingSystem": "All",
    "browserRequirements": "Requires HTML5 support",
  };

  return (
    <>
      <JsonLdScript data={faqSchema} idSuffix="scriptwriting-faqs" />
      <JsonLdScript data={softwareSchema} idSuffix="scriptwriting-software" />
      <ScriptWritingDashboardClient />
    </>
  );
}
