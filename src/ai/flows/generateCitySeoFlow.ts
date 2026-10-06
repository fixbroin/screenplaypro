'use server';
/**
 * @fileOverview An AI flow to generate SEO content for a city page for Screenplay Pro.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateCitySeoInputSchema = z.object({
  cityName: z.string().describe("The name of the city, e.g., 'Bangalore' or 'Mumbai'."),
});
export type GenerateCitySeoInput = z.infer<typeof GenerateCitySeoInputSchema>;

const GenerateCitySeoOutputSchema = z.object({
  h1_title: z.string().describe("An H1 title optimized for the city page. Format: 'Screenplay Writing & Film Scriptwriters in {{cityName}}'"),
  seo_title: z.string().describe("An SEO-optimized meta title, under 60 characters. Format: 'Screenplay Writing & Scriptwriters in {{cityName}} | Screenplay Pro'"),
  seo_description: z.string().describe("An SEO-optimized meta description, under 160 characters. Highlights studio-standard formatting, autosave, and PDF exports for film writers in the city."),
  seo_keywords: z.string().describe("A comma-separated string of 10 relevant SEO keywords for the city. Include variations like 'screenplay writers {{cityName}}', 'script writing software {{cityName}}', 'write movie script {{cityName}}'."),
});
export type GenerateCitySeoOutput = z.infer<typeof GenerateCitySeoOutputSchema>;

export async function generateCitySeo(input: GenerateCitySeoInput): Promise<GenerateCitySeoOutput> {
  return generateCitySeoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCitySeoPrompt',
  input: { schema: GenerateCitySeoInputSchema },
  output: { schema: GenerateCitySeoOutputSchema },
  prompt: `You are an expert Screenplay & Film SEO copywriter for Screenplay Pro (online screenplay writing software and film scriptwriters platform operating in India).
Your task is to generate intent-driven SEO content for a city landing page to rank #1 on Google for scriptwriting and screenplay searches in that city.

IMPORTANT RULE: Do NOT use the words 'AI', 'AI-powered', or 'AI-assisted' in any of the generated titles, descriptions, or keywords.

City Name: {{cityName}}

Based on the city name, generate the following content:

1. **h1_title**: An H1 title using the format: "Screenplay Writing & Film Scriptwriters in {{cityName}}".
2. **seo_title**: A meta title (under 60 chars) with the format: "Screenplay Writing in {{cityName}} | Screenplay Pro".
3. **seo_description**: A meta description (under 160 chars) that is compelling and includes the city name, mentioning screenplay formatting, autosave, and PDF exports for screenwriters.
4. **seo_keywords**: A comma-separated string of 10 high-intent keywords. Include "screenplay writers {{cityName}}", "script writing software {{cityName}}", "write movie script {{cityName}}", and "film scriptwriter {{cityName}}".

Return the entire response as a single, valid JSON object that adheres to the defined output schema.
`,
});

const generateCitySeoFlow = ai.defineFlow(
  {
    name: 'generateCitySeoFlow',
    inputSchema: GenerateCitySeoInputSchema,
    outputSchema: GenerateCitySeoOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("AI failed to generate a valid SEO response for the city.");
    }
    return output;
  }
);
