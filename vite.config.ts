import { defineConfig } from "vite";
import { mergeConfig, defineConfig as defineConfigVitest } from "vitest/config";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";
import zipPack from "vite-plugin-zip-pack";

const viteConfig = defineConfig({
  plugins: [crx({ manifest }), zipPack({ outDir: "dist" })],
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
        coverage: {
          exclude: [
            "manifest.config.ts",
            "src/test/setupGlobals.js",
            "src/scripts/types.ts",
          ],
        },
      },
    })
  )
);
