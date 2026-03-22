// @ts-check
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import { remarkGoogleDriveImages } from "./src/plugins/remark-google-drive-images.ts";

// https://astro.build/config
export default defineConfig({
  output: "static",
  adapter: vercel(),
  markdown: {
    remarkPlugins: [remarkGoogleDriveImages],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
