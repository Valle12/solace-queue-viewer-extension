import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";
import zipPack from "vite-plugin-zip-pack";
import { defineConfig as defineConfigVitest, mergeConfig } from "vitest/config";
import manifest from "./manifest.config";

const viteConfig = defineConfig({
  plugins: [crx({ manifest }), zipPack({ outDir: "dist" })],
  build: {
    emptyOutDir: true,
    sourcemap: "inline",
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
