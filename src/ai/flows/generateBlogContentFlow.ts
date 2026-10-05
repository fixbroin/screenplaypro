'use server';
/**
 * @fileOverview An AI flow to generate comprehensive blog content and SEO metadata for home services in HTML format.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateBlogContentInputSchema = z.object({
  title: z.string().describe("The title of the blog post to generate content for."),
  categoryName: z.string().optional().describe("The optional category name for more specific SEO generation (e.g., Carpentry, Plumber, Electrician)."),
  currentYear: z.string().optional().describe("The current year for dynamic content generation."),
});
export type GenerateBlogContentInput = z.infer<typeof GenerateBlogContentInputSchema>;

const GenerateBlogContentOutputSchema = z.object({
  content: z.string().describe("The full blog post content, formatted in HTML with <h2>, <p>, <br>, and <ul> tags. Should be engaging, professional, and at least 400 words, aimed at homeowners. Include 5-7 sections with headers, benefits, service lists, tips, pricing estimates, and a footer with keywords."),
  excerpt: z.string().describe("A short, catchy summary of the blog post (max 150 characters) to be used on the blog list card."),
  tags: z.string().describe("A comma-separated string of 3-5 relevant tags for the post (e.g., 'Maintenance, DIY, Plumbing')."),
  readingTime: z.string().describe("Estimated reading time, e.g., '5 min' or '8 min'."),
  h1_title: z.string().describe("An H1 title with the exact format: '{Title Name} Service Near You | Screenplay Pro'"),
  meta_title: z.string().describe("A meta title with the format: '{Title Name} Near Me {Category Name} Near Me' or '{Title Name} | Home Services Near Me' if no category is provided."),
  meta_description: z.string().describe("An SEO-optimized meta description, under 160 characters, including relevant service keywords (e.g., Carpentry, Plumber, Electrician, Home Cleaning)."),
  meta_keywords: z.string().describe("A comma-separated string of SEO keywords, including the title, Bangalore, and service keywords like Carpentry near me, Plumber near me, etc."),
  imageHint: z.string().describe("One or two keywords for an AI image search for the blog's cover image. E.g., 'professional electrician' or 'home cleaning'. Max 50 characters."),
});
export type GenerateBlogContentOutput = z.infer<typeof GenerateBlogContentOutputSchema>;

export async function generateBlogContent(input: Omit<GenerateBlogContentInput, 'currentYear'>): Promise<GenerateBlogContentOutput> {
  const currentYear = new Date().getFullYear().toString();
  return generateBlogContentFlow({ ...input, currentYear });
}

const prompt = ai.definePrompt({
  name: 'generateArtistBlogPrompt',
  input: { schema: GenerateBlogContentInputSchema },
  output: { schema: GenerateBlogContentOutputSchema },
  prompt: `You are an expert Talent SEO copywriter for an artist discovery platform called "Screenplay Pro" based in India. Your goal is to write a blog post that ranks #1 on Google for talent hiring and artist discovery in India.

The content must be formatted in HTML using <h2> for headers, <p> for paragraphs, <br> for line breaks, and <ul> with <li> for lists. Do not use markdown symbols.

**Input Details:**
- Blog Post Title: {{title}}
- Category (optional): {{categoryName}}
- Current Year: {{currentYear}}

**Instructions:**
Generate highly aggressive, intent-driven content based on the following:

1. **content**: Write a masterpiece of at least 600 words. Use an authoritative yet helpful tone.
   - Use aggressive keywords like "Best", "Professional", "Top-Rated", "Hire", and "Connect" naturally throughout.
   - Mention the importance of verified profiles and high-quality portfolios.
   - Structure:
     - <h2><strong>Introduction</strong>: Why Screenplay Pro is the best platform for {{title}} in India.
     - <h2><strong>Finding Professional {{categoryName}} Artists</strong>: Focus on talent quality and portfolio verification.
     - <h2><strong>Talent Categories on Screenplay Pro</strong>: Use <ul> with <li>.
     - <h2><strong>Why Hire Through Screenplay Pro?</strong>: Highlight direct connection and secure platform.
     - <h2><strong>Industry Trends ({{currentYear}})</strong>: Provide insights into the artist and talent landscape in India.
     - <h2><strong>Tips for Artists and Hirers</strong>: Practical value for the community.
     - <h2><strong>Conclusion</strong>: Call to action to join Screenplay Pro and discover {{categoryName}} talent.
   - **Keywords Footer**: An <h2> header 'Search Keywords' with a single <p> containing: "{{title}}, hire artists India, best {{categoryName}} profiles, discover talent online, professional performers India, Screenplay Pro platform".

2. **excerpt**: A high-CTR summary (under 150 chars) starting with "Looking for the best...".

3. **tags**: 3-5 tags including "Artists, Talent, India".

4. **readingTime**: An estimate of how long it takes to read (e.g., "5 min").

5. **h1_title**: Format: "Best Professional {{title}} in India | Screenplay Pro".

6. **meta_title**: Format: "Hire {{title}} | Top-Rated {{categoryName}} Artists | Screenplay Pro".

7. **meta_description**: A compelling meta description (under 160 chars) starting with "Discover and hire the best professional artists for {{title}} in India...".

8. **meta_keywords**: Comma-separated: "{{title}}, India, hire artists, best {{categoryName}}, talent discovery".

9. **imageHint**: Provide "{{title}} professional artist talent" Max 50 characters.

Return the entire response as a single, valid JSON object.
`,
});

const generateBlogContentFlow = ai.defineFlow(
  {
    name: 'generateArtistBlogFlow',
    inputSchema: GenerateBlogContentInputSchema,
    outputSchema: GenerateBlogContentOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("AI failed to generate a valid blog post response.");
    }
    return output;
  }
);