'use server';
/**
 * @fileOverview An AI flow to generate SEO content for a specific scriptwriting category within a city.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateCityCategorySeoInputSchema = z.object({
  cityName: z.string().describe("The name of the city, e.g., 'Bangalore'."),
  categoryName: z.string().describe("The name of the screenplay category, e.g., 'Feature Film' or 'Short Film'."),
});
export type GenerateCityCategorySeoInput = z.infer<typeof GenerateCityCategorySeoInputSchema>;

const GenerateCityCategorySeoOutputSchema = z.object({
  h1_title: z.string().describe("An H1 title optimized for the city-category page. Format: 'Best {{categoryName}} Screenplay Tools in {{cityName}}'"),
  meta_title: z.string().describe("An SEO-optimized meta title, under 60 characters. Format: '{{categoryName}} Screenplay Writing in {{cityName}} | Screenplay Pro'"),
  meta_description: z.string().describe("An SEO-optimized meta description, under 160 characters. Highlights studio-standard formatting and PDF exports for screenwriters in the city."),
  meta_keywords: z.string().describe("A comma-separated string of 10 highly relevant local SEO keywords. Include variations like '{{categoryName}} screenplay {{cityName}}', '{{categoryName}} scriptwriting {{cityName}}'."),
});
export type GenerateCityCategorySeoOutput = z.infer<typeof GenerateCityCategorySeoOutputSchema>;

export async function generateCityCategorySeo(input: GenerateCityCategorySeoInput): Promise<GenerateCityCategorySeoOutput> {
  return generateCityCategorySeoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCityCategorySeoPrompt',
  input: { schema: GenerateCityCategorySeoInputSchema },
  output: { schema: GenerateCityCategorySeoOutputSchema },
  prompt: `You are an expert Screenplay & Film SEO copywriter for Screenplay Pro (online screenplay writing software and film scriptwriting platform operating in India).
Your task is to generate intent-driven SEO content for a specific scriptwriting category within a city.

IMPORTANT RULE: Do NOT use the words 'AI', 'AI-powered', or 'AI-assisted' in any of the generated titles, descriptions, or keywords.

City Name: {{cityName}}
Category Name: {{categoryName}}

Based on these details, generate the following content:

1. **h1_title**: Create an H1 title with the format: "Best {{categoryName}} Screenplay Tools in {{cityName}}".
2. **meta_title**: A meta title (under 60 chars) with the format: "{{categoryName}} Screenplay Writing in {{cityName}} | Screenplay Pro".
3. **meta_description**: A compelling meta description (under 160 chars) that includes the city, the category, and mentions studio-standard formatting, autosave, and PDF script exports.
4. **meta_keywords**: A comma-separated string of 10 high-intent keywords. Include "{{categoryName}} screenplay {{cityName}}", "write {{categoryName}} script {{cityName}}", and "professional {{categoryName}} scriptwriting".

Return the entire response as a single, valid JSON object that adheres to the defined output schema.
`,
});

const generateCityCategorySeoFlow = ai.defineFlow(
  {
    name: 'generateCityCategorySeoFlow',
    inputSchema: GenerateCityCategorySeoInputSchema,
    outputSchema: GenerateCityCategorySeoOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("AI failed to generate a valid SEO response for the city-category.");
    }
    return output;
  }
);
