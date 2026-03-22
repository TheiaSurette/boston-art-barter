# CLAUDE.md

## Project Overview

This is a static event website built with Astro.

The site has 3 pages:
- Home (marketing)
- Form (signup, before event ends)
- Participants (visible after event ends)

Only 2 pages are visible at any time, controlled by a config flag.

## Core Principle

Non-technical users must be able to fully manage content using only Markdown files.

## Content System

There are TWO content types:

### 1. Config (single-instance content)

Located in:
`/src/content/config/`

Files:
- site.md → global event config
- home.md → homepage content
- form.md → form page content

These files MUST exist and MUST NOT be renamed.

### 2. Participants (repeatable content)

Located in:
`/src/content/participants/`

Each file represents one participant.

## CRITICAL RULES

- ONLY `.md` files are allowed
- DO NOT introduce MDX
- DO NOT allow JSX in content
- DO NOT allow content authors to import components

## Visibility Logic

The `eventEnded` field in `site.md` controls routing:

If `eventEnded = false`:
- Home page is visible
- Form page is visible
- Participants page must be inaccessible

If `eventEnded = true`:
- Home page is visible
- Participants page is visible
- Form page must be inaccessible

## Schema Requirements

### site.md
- eventName: string
- eventDate: date
- eventEnded: boolean
- location: string
- description: string

### home.md
- headline: string
- subheadline: string
- ctaText: string
- ctaLink: string

### form.md
- title: string
- description: string
- formEmbedUrl: string OR formAction

### participants
- name: string
- bio: string
- image: string
- website: optional string
- twitter: optional string
- instagram: optional string

## Rendering Rules

- All pages must use shared layouts
- Markdown content must be wrapped in styled prose
- No inline styles in Markdown

## Code Guidelines

- Use strict TypeScript
- Keep logic simple and readable
- Avoid unnecessary abstractions

## Performance Rules

- Zero client-side JavaScript by default
- No hydration unless absolutely required

## Styling Rules

- Use Tailwind CSS
- Use typography plugin for content
- Ensure responsive layouts

## File Structure

- `/src/content/config` → global + page config
- `/src/content/participants` → participant entries
- `/src/pages` → routes
- `/src/layouts` → layouts

## What NOT to Do

- Do NOT add MDX
- Do NOT add a CMS
- Do NOT introduce React/Vue/Svelte
- Do NOT allow dynamic runtime data fetching

## Extension Guidelines

If new features are needed:
- Prefer adding fields to frontmatter
- Keep content author experience simple
- Avoid introducing complexity

## Goal Reminder

This system must allow a non-technical user to:
- Update event details
- Modify page content
- Add participants

All without touching code.