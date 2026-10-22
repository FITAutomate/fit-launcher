import { z } from "zod";

export const feedbackTypes = [
  "Problem",
  "Idea",
  "Question",
  "Worked well",
] as const;
export const feedbackAreas = [
  "Setup",
  "Launch",
  "Discovered",
  "Ports",
  "Settings",
  "Other",
] as const;
export const feedbackImpacts = [
  "blocking",
  "can continue",
  "minor",
  "just a thought",
] as const;
export const FeedbackSchema = z
  .object({
    type: z.enum(feedbackTypes),
    where: z.enum(feedbackAreas),
    impact: z.enum(feedbackImpacts),
    what: z
      .string()
      .trim()
      .min(1, "Describe what happened or what you would like.")
      .max(6000, "Use a shorter summary; you can add more details on GitHub."),
  })
  .strict();
export type FeedbackInput = z.infer<typeof FeedbackSchema>;
