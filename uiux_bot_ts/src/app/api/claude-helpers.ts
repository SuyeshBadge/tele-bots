/**
 * Claude API helper functions.
 * 
 * This file contains utility functions for processing Claude API responses.
 */

/**
 * Interface for lesson data
 */
export interface LessonData {
  title: string;
  theme: string;
  content_points: string[];  // Array of bullet points
  quiz_question: string;
  quiz_options: string[];
  correct_option_index: number;
  explanation: string;
  option_explanations?: string[];
  vocabulary_terms?: {term: string, definition: string, example: string}[];
  example_link?: {url: string, description: string};
  video_query?: string[];
}

/**
 * Extract JSON from Claude's response
 */
export function extractJsonFromResponse(content: string): string {
  let processed = content.trim();
  
  // Remove markdown code blocks if present
  if (processed.includes("```")) {
    processed = processed.replace(/```(?:json)?([\s\S]*?)```/g, '$1').trim();
  }
  
  // Extract JSON object using regular expression
  const jsonMatch = processed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  
  // If no match found, return the original content for repair
  return processed;
}

/**
 * Validate and fix the lesson data against the expected schema
 */
export function validateAndFixLessonData(data: any): LessonData {
  // Create a base object with default values for all required fields
  const validated: LessonData = {
    theme: data.theme || "UI/UX Design Principles",
    title: data.title || "Understanding UI/UX Design",
    content_points: Array.isArray(data.content_points) ? data.content_points : [],
    quiz_question: data.quiz_question || "What is a key principle of UI/UX design?",
    quiz_options: Array.isArray(data.quiz_options) ? data.quiz_options : [
      "Visual aesthetics only",
      "User-centered design",
      "Complex interfaces",
      "Technical implementation"
    ],
    correct_option_index: typeof data.correct_option_index === 'number' ? data.correct_option_index : 1,
    explanation: data.explanation || "User-centered design is the core principle of effective UI/UX design.",
    option_explanations: Array.isArray(data.option_explanations) ? data.option_explanations : [],
    vocabulary_terms: Array.isArray(data.vocabulary_terms) ? data.vocabulary_terms : [],
    example_link: data.example_link || undefined,
    video_query: Array.isArray(data.video_query) ? data.video_query : ["UI UX design principles"]
  };
  
  // Ensure content_points has at least some content
  if (validated.content_points.length < 3) {
    validated.content_points = [
      "🎨 Good UI/UX design focuses on user needs and expectations",
      "🔄 Iterative testing helps identify and fix usability issues",
      "📱 Responsive design ensures consistent experience across devices",
      "🔍 User research provides valuable insights for design decisions"
    ];
  }
  
  // Ensure the correct option index is valid
  if (validated.correct_option_index >= validated.quiz_options.length) {
    validated.correct_option_index = 0;
  }
  
  // Ensure vocabulary_terms is properly initialized and has at least one item
  if (!validated.vocabulary_terms || validated.vocabulary_terms.length === 0) {
    validated.vocabulary_terms = [
      {
        term: "User-Centered Design",
        definition: "A design approach that prioritizes user needs throughout the process",
        example: "Conducting user interviews before creating wireframes"
      }
    ];
  }
  
  return validated;
} 