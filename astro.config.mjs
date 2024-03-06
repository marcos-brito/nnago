import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  markdown: {
    syntaxHighlight: "prism",
  },
  site: "https://marcos-brito.github.io",
  base: "/nnago",
});
