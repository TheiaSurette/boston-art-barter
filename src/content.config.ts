import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const site = defineCollection({
  loader: glob({ pattern: "site.md", base: "./src/content/config" }),
  schema: z.object({
    eventName: z.string(),
    eventDate: z.coerce.date(),
    eventEnded: z.boolean(),
    location: z.string(),
    description: z.string(),
    navLabelHome: z.string().default("Home"),
    navLabelForm: z.string().default("Sign Up"),
    navLabelParticipants: z.string().default("Participants"),
  }),
});

const home = defineCollection({
  loader: glob({ pattern: "home.md", base: "./src/content/config" }),
  schema: z.object({
    headline: z.string(),
    subheadline: z.string(),
    ctaText: z.string(),
    ctaLink: z.string(),
    ctaTextEnded: z.string().default("View Participants"),
    ctaLinkEnded: z.string().default("/participants"),
  }),
});

const form = defineCollection({
  loader: glob({ pattern: "form.md", base: "./src/content/config" }),
  schema: z
    .object({
      title: z.string(),
      description: z.string(),
      formEmbedUrl: z.string().optional(),
      formAction: z.string().optional(),
      thankYouHeadline: z.string().optional(),
      thankYouMessage: z.string().optional(),
    })
    .refine((data) => data.formEmbedUrl || data.formAction, {
      message: "Either formEmbedUrl or formAction must be provided",
    }),
});

const participants = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/participants" }),
  schema: z.object({
    name: z.string(),
    bio: z.string(),
    image: z.string(),
    website: z.string().optional(),
    instagram: z.string().optional(),
    order: z.number().optional(),
  }),
});

export const collections = { site, home, form, participants };
