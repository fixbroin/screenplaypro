'use server';
/**
 * @fileOverview An AI flow to generate SEO content for a service category.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateCategorySeoInputSchema = z.object({
  categoryName: z.string().describe("The name of the service category, e.g., 'Carpentry' or 'Appliance Repair'."),
});
export type GenerateCategorySeoInput = z.infer<typeof GenerateCategorySeoInputSchema>;

const GenerateCategorySeoOutputSchema = z.object({
  h1_title: z.string().describe("An H1 title optimized for the category page. Format: 'Best Professional {{categoryName}} Services Near You'"),
  seo_title: z.string().describe("An SEO-optimized meta title, under 60 characters. Format: 'Best {{categoryName}} Near Me | Professional {{categoryName}} Services'"),
  seo_description: z.string().describe("An SEO-optimized meta description, under 160 characters. Should be a compelling summary that encourages clicks, mentioning top-rated experts and professional services."),
  seo_keywords: z.string().describe("A comma-separated string of 10 highly relevant local SEO keywords. Must include variations like 'best {{categoryName}} near me', 'professional {{categoryName}} services', 'book {{categoryName}} online'."),
  imageHint: z.string().describe("One or two keywords for an AI image search for the category's main image. E.g., 'carpentry tools' or 'clean appliances'. Max 50 characters."),
});
export type GenerateCategorySeoOutput = z.infer<typeof GenerateCategorySeoOutputSchema>;

export async function generateCategorySeo(input: GenerateCategorySeoInput): Promise<GenerateCategorySeoOutput> {
  return generateCategorySeoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCategorySeoPrompt',
  input: { schema: GenerateCategorySeoInputSchema },
  output: { schema: GenerateCategorySeoOutputSchema },
  prompt: `You are an expert Talent SEO copywriter for an artist discovery platform called "Screenplay Pro" operating in India.
Your task is to generate highly aggressive, intent-driven SEO content for a specific artist category page to rank #1 on Google for talent-related searches.

Category Name: {{categoryName}}

Based on this detail, generate the following content. Focus on high-intent keywords like "Best", "Professional", "Top-Rated", "Hire", and "Connect".

1.  **h1_title**: Create an H1 title with the format: "Best Professional {{categoryName}} Artists in India".
2.  **seo_title**: A meta title (under 60 chars) with the format: "Hire Best {{categoryName}} in India | Professional Artist Profiles".
3.  **seo_description**: A compelling meta description (under 160 chars) that includes the category and mentions "India" and connecting with top talent. Use words like "verified profiles", "portfolio", or "direct connection" to drive clicks.
4.  **seo_keywords**: A comma-separated string of 10 high-intent keywords. Include "best {{categoryName}} in india", "hire {{categoryName}} online", "professional {{categoryName}} profiles", and other related terms.
5.  **imageHint**: Provide one or two keywords for an AI image search for the category's main image. Max 50 characters.

Return the entire response as a single, valid JSON object that adheres to the defined output schema.
`,
});

const generateCategorySeoFlow = ai.defineFlow(
  {
    name: 'generateCategorySeoFlow',
    inputSchema: GenerateCategorySeoInputSchema,
    outputSchema: GenerateCategorySeoOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("AI failed to generate a valid SEO response for the category.");
    }
    return output;
  }
);
