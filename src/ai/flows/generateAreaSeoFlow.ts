
'use server';
/**
 * @fileOverview An AI flow to generate SEO content for a specific service area within a city.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateAreaSeoInputSchema = z.object({
  areaName: z.string().describe("The name of the specific area or locality, e.g., 'Whitefield'."),
  cityName: z.string().describe("The name of the parent city, e.g., 'Bangalore'."),
});
export type GenerateAreaSeoInput = z.infer<typeof GenerateAreaSeoInputSchema>;

const GenerateAreaSeoOutputSchema = z.object({
  h1_title: z.string().describe("An H1 title optimized for the area page. Format: 'Best Home Services in {{areaName}}, {{cityName}}'"),
  seo_title: z.string().describe("An SEO-optimized meta title, under 60 characters. Format: 'Top Home Services in {{areaName}} | Best Handyman Near Me'"),
  seo_description: z.string().describe("An SEO-optimized meta description, under 160 characters. Should be a compelling summary that encourages clicks, mentioning the area, parent city, and words like 'trusted experts'."),
  seo_keywords: z.string().describe("A comma-separated string of 10 highly relevant SEO keywords for the area. Must include variations like 'best home services {{areaName}}', 'professional handyman in {{areaName}}', 'home repair near me'."),
});
export type GenerateAreaSeoOutput = z.infer<typeof GenerateAreaSeoOutputSchema>;

export async function generateAreaSeo(input: GenerateAreaSeoInput): Promise<GenerateAreaSeoOutput> {
  return generateAreaSeoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAreaSeoPrompt',
  input: { schema: GenerateAreaSeoInputSchema },
  output: { schema: GenerateAreaSeoOutputSchema },
  prompt: `You are an expert Talent SEO copywriter for an artist discovery platform called "Screenplay Pro" operating in India.
Your task is to generate highly aggressive, intent-driven SEO content for a specific locality or area within a city to rank #1 on Google for hyper-local talent searches.

Area Name: {{areaName}}
City Name: {{cityName}}

Based on these details, generate the following content. Focus on high-intent keywords like "Best", "Professional", "Hire", "Connect", and "Talent".

1.  **h1_title**: An H1 title using the format: "Best Professional Artists in {{areaName}}, {{cityName}}".
2.  **seo_title**: A meta title (under 60 chars) with the format: "Hire Artists in {{areaName}} | Top Professional Talents in {{cityName}}".
3.  **seo_description**: A meta description (under 160 chars) that is compelling and mentions the specific area ({{areaName}}), the city, and connecting with local talent. Use localized phrases like "trusted local artists in {{areaName}}" or "discover verified performers near you".
4.  **seo_keywords**: A comma-separated string of 10 high-intent keywords. Include "best artists in {{areaName}}", "hire performers in {{areaName}}", "talent discovery {{areaName}} {{cityName}}", and "{{areaName}} local artist directory".

Return the entire response as a single, valid JSON object that adheres to the defined output schema.
`,
});

const generateAreaSeoFlow = ai.defineFlow(
  {
    name: 'generateAreaSeoFlow',
    inputSchema: GenerateAreaSeoInputSchema,
    outputSchema: GenerateAreaSeoOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("AI failed to generate a valid SEO response for the area.");
    }
    return output;
  }
);
