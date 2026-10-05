'use server';

/**
 * @fileOverview An AI flow to generate a batch of realistic screenplay/script reviews for Screenplay Pro.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { queryDb } from '@/lib/mysql';

// Input schema for generating reviews
const GenerateBulkReviewsInputSchema = z.object({
  topic: z.string().optional().describe("Optional focus area/genre for the script reviews (e.g. Feature Film, Short Film, Dialogue, Formatting)."),
  numberOfReviews: z.coerce.number().int().min(1).max(20).default(5).describe("The number of reviews to generate (1-20)."),
  serviceId: z.string().optional(),
  serviceName: z.string().optional(),
  categoryName: z.string().optional(),
  subCategoryName: z.string().optional(),
});
export type GenerateBulkReviewsInput = z.infer<typeof GenerateBulkReviewsInputSchema>;

// Schema for a single generated review
const GeneratedReviewSchema = z.object({
  userName: z.string().describe("A realistic, authentic person's full name (e.g., Rajesh Khanna, Anita Sharma, Alex Turner, Kavya Nair)."),
  serviceName: z.string().describe("A realistic screenplay/script title or project focus (e.g. 'Feature Film Script - The Last Stand', 'Sci-Fi Web Series Draft', 'Short Film Screenplay', 'Character Dialogue Polish')."),
  rating: z.number().min(3).max(5).describe("A rating between 3 and 5."),
  comment: z.string().describe("A realistic, insightful review comment (15-60 words) praising screenplay formatting, scene structure, character development, or dialogue writing on Screenplay Pro."),
});

// Output schema for the flow
const GenerateBulkReviewsOutputSchema = z.object({
  reviews: z.array(GeneratedReviewSchema).describe("An array of generated reviews."),
});
export type GenerateBulkReviewsOutput = z.infer<typeof GenerateBulkReviewsOutputSchema>;

// Realistic fallback review generator
const sampleNames = [
  "Rajesh Khanna", "Anita Sharma", "Alex Turner", "Kavya Nair", "Siddharth Rao",
  "Priya Patel", "David Miller", "Meera Sen", "Vikramaditya Verma", "Rohan Gupta",
  "Sophia Chen", "Arjun Deshmukh", "Nisha Roy", "Carlos Mendoza", "Deepak Joshi",
  "Preeti Singhania", "Marcus Vance", "Sonia Kapoor", "Aakash Mehta", "Emily Zhang"
];

const sampleScriptTitles = [
  "Feature Film Script - The Shadow Agent",
  "Sci-Fi Web Series Draft",
  "Short Film Screenplay - Lost Echoes",
  "Crime Thriller Outline",
  "Romantic Comedy Screenplay",
  "Action Drama Scene Structure",
  "Character Dialogue Polish",
  "Indie Drama Screenplay",
  "Historical Series Pilot",
  "Mystery Thriller Script"
];

const sampleComments = [
  "Screenplay Pro made scene formatting and dialogue pacing so effortless. High quality tool!",
  "Fantastic platform for script writers. Scene outlines and character arc features saved me weeks of work.",
  "The scene layout and formatting export features are top-notch. Highly recommended for filmmakers!",
  "Incredible screenplay writing tool. Clean interface and easy script outline tools.",
  "Best scriptwriting software I have used this year. Great formatting and structure tools.",
  "Intuitive layout for structuring scenes and writing punchy dialogue. Impressed with the feature set.",
  "Smooth export options and seamless story arc management. Essential for any serious screenwriter.",
  "Extremely helpful for drafting multi-character dialogues and managing plot outlines."
];

function generateFallbackReviews(count: number, topic?: string): GenerateBulkReviewsOutput {
  const reviews: z.infer<typeof GeneratedReviewSchema>[] = [];
  const shuffledNames = [...sampleNames].sort(() => 0.5 - Math.random());
  
  for (let i = 0; i < count; i++) {
    const name = shuffledNames[i % shuffledNames.length];
    const scriptTitle = topic?.trim() 
      ? `${topic} - Screenplay Draft #${i + 1}` 
      : sampleScriptTitles[i % sampleScriptTitles.length];
    const comment = sampleComments[i % sampleComments.length];
    const rating = Math.random() > 0.3 ? 5 : 4;

    reviews.push({
      userName: name,
      serviceName: scriptTitle,
      rating,
      comment
    });
  }

  return { reviews };
}

// The main function to be called from the frontend
export async function generateBulkReviews(input: GenerateBulkReviewsInput): Promise<GenerateBulkReviewsOutput> {
  return generateBulkReviewsFlow(input);
}

const generateReviewsPrompt = ai.definePrompt({
  name: 'generateBulkReviewsPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: { 
    schema: GenerateBulkReviewsInputSchema.extend({
      existingNames: z.array(z.string()).optional()
    }) 
  },
  output: { schema: GenerateBulkReviewsOutputSchema },
  prompt: `You are an expert content generator for "Screenplay Pro", a premier screenplay and script writing platform.
Your task is to generate a batch of realistic user reviews from screenwriters, directors, and authors.

Topic / Focus: {{#if topic}}{{topic}}{{else}}Screenplay & Script Writing Platform{{/if}}

{{#if existingNames}}
Avoid using these exact reviewer names:
{{#each existingNames}}
- {{this}}
{{/each}}
{{/if}}

Generate exactly {{numberOfReviews}} unique reviews.

For each review, provide:
1. **userName**: A plausible, realistic full name of a screenwriter or creator.
2. **serviceName**: A realistic script title or project focus (e.g. "Feature Film Draft", "Sci-Fi Pilot Screenplay", "Short Film Script", "Crime Drama Screenplay").
3. **rating**: An integer rating between 4 and 5 (mostly 5s and 4s).
4. **comment**: A short, natural review (15-60 words) evaluating screenplay formatting, scene structure, character development, dialogue, or writing speed on Screenplay Pro.

Return the response as JSON adhering to the output schema.
`,
});

const generateBulkReviewsFlow = ai.defineFlow(
  {
    name: 'generateBulkReviewsFlow',
    inputSchema: GenerateBulkReviewsInputSchema,
    outputSchema: GenerateBulkReviewsOutputSchema,
  },
  async (input) => {
    let existingNames: string[] = [];
    try {
      const rows = await queryDb<any[]>(
        'SELECT data FROM generic_collections WHERE collection_name = ? LIMIT 100',
        ['adminReviews']
      );
      existingNames = rows.map(r => {
        try { return JSON.parse(r.data)?.userName || ''; } catch { return ''; }
      }).filter(Boolean);
    } catch (error) {
      console.error("Error fetching existing names for review generation:", error);
    }

    try {
      const { output } = await generateReviewsPrompt({
        ...input,
        existingNames
      });

      if (output && output.reviews && output.reviews.length > 0) {
        return output;
      }
    } catch (aiErr) {
      console.warn("Google AI generation encountered an error, using fallback review generator:", aiErr);
    }

    return generateFallbackReviews(input.numberOfReviews || 5, input.topic);
  }
);
