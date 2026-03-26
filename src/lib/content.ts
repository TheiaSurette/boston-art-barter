import { getEntry, getCollection, render } from "astro:content";

export async function getSiteConfig() {
  const entry = await getEntry("site", "site");
  if (!entry) throw new Error("Missing site config (src/content/config/site.md)");
  return entry.data;
}

export async function getHomeContent() {
  const entry = await getEntry("home", "home");
  if (!entry) throw new Error("Missing home config (src/content/config/home.md)");
  const { Content } = await render(entry);
  return { data: entry.data, Content };
}

export async function getFormConfig() {
  const entry = await getEntry("form", "form");
  if (!entry) throw new Error("Missing form config (src/content/config/form.md)");
  return entry.data;
}

export async function getParticipants() {
  return getCollection("participants");
}
