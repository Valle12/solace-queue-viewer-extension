import { defineManifest } from "@crxjs/vite-plugin";
import packageJson from "./package.json";
const { version } = packageJson;

const [major, minor, patch] = version.replace(/[^\d.-]+/g, "").split(/[.-]/);

export default defineManifest({
  manifest_version: 3,
  name: "Solace Queue Viewer",
  version: `${major}.${minor}.${patch}`,
  description: "Enables you to see solace messages directly in the browser.",
  background: {
    service_worker: "src/scripts/background.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://*.messaging.solace.cloud:943/*"],
      js: ["src/scripts/solace.ts"],
      run_at: "document_end",
    },
    {
      matches: ["https://console.solace.cloud/*"],
      js: ["src/scripts/configExtractor.ts"],
    },
  ],
  permissions: ["storage", "tabs", "activeTab"],
  icons: {
    16: "icons/icon16.png",
    32: "icons/icon32.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png",
  },
});
