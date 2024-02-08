import { defineConfig } from "vite";
import { mergeConfig, defineConfig as defineConfigVitest } from "vitest/config";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

const viteConfig = defineConfig({
  plugins: [crx({ manifest })],
  build: {
    emptyOutDir: true,
    sourcemap: true,
  },
  clearScreen: true,
});

export default defineConfigVitest(
  mergeConfig(
    viteConfig,
    defineConfigVitest({
      test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["/src/test/setupGlobals.js"],
      },
    })
  )
);
