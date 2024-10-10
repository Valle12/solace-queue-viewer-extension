import { defineManifest } from "bun-chrome-extension-dev";
import packageJson from "./package.json";
const { version } = packageJson;

const [major, minor, patch] = version.replace(/[^\d.-]+/g, "").split(/[.-]/);

export default defineManifest({
  name: "Solace Queue Viewer",
  version: `${major}.${minor}.${patch}`,
  description: "Enables you to see solace messages directly in the browser.",
  background: {
    service_worker: "src/scripts/background.ts",
    type: "module",
  },
  action: {
    default_popup: "src/popup.html",
  },
  content_scripts: [
    {
      matches: ["https://*.messaging.solace.cloud:943/*"],
      ts: ["src/scripts/solace.ts"],
      run_at: "document_end",
    },
    {
      matches: ["https://console.solace.cloud/*"],
      ts: ["src/scripts/configExtractor.ts"],
    },
  ],
  permissions: ["storage", "tabs", "activeTab", "webNavigation"],
  icons: {
    16: "icons/icon16.png",
    32: "icons/icon32.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png",
  },
});
