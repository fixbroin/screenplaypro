
"use client";

import React from 'react';
import JsonLdScript from './JsonLdScript';
import { getBaseUrl } from '@/lib/config';

interface BreadcrumbSchemaProps {
  items: Array<{ label: string; href?: string }>;
}

const BreadcrumbSchema: React.FC<BreadcrumbSchemaProps> = ({ items }) => {
  const appBaseUrl = getBaseUrl();
  
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.label,
      "item": item.href 
        ? (item.href.startsWith('http') ? item.href : `${appBaseUrl}${item.href}`)
        : undefined
    }))
  };

  return <JsonLdScript data={schema} idSuffix="breadcrumb" />;
};

export default BreadcrumbSchema;
