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
  }),
});

const home = defineCollection({
  loader: glob({ pattern: "home.md", base: "./src/content/config" }),
  schema: z.object({
    headline: z.string(),
    subheadline: z.string(),
    ctaText: z.string(),
    ctaLink: z.string(),
  }),
});

const form = defineCollection({
  loader: glob({ pattern: "form.md", base: "./src/content/config" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    formEmbedUrl: z.string().optional(),
    formAction: z.string().optional(),
  }),
});

const participants = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/participants" }),
  schema: z.object({
    name: z.string(),
    bio: z.string(),
    image: z.string(),
    website: z.string().optional(),
    twitter: z.string().optional(),
    instagram: z.string().optional(),
  }),
});

export const collections = { site, home, form, participants };
