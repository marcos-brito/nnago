import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
    markdown: {
        syntaxHighlight: "prism",
    },

    site: "https://marcos-brito.github.io/nnago",
    base: "/nnago",
    integrations: [sitemap()],
});
