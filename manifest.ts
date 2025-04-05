import { defineManifest } from "bun-chrome-extension-dev";
import packageJson from "./package.json";
const { version } = packageJson;

const [major, minor, patch] = version.replace(/[^\d.-]+/g, "").split(/[.-]/);

export const manifest = defineManifest({
  name: "solace-queue-viewer-extension",
  version: `${major}.${minor}.${patch}`,
  background: {
    service_worker: "src/background.ts",
  },
  action: {
    default_popup: "src/popup/popup.html",
  },
  permissions: [
    "storage",
    "webNavigation",
    "unlimitedStorage",
    "tabs",
    "scripting",
    "activeTab",
  ],
  host_permissions: ["https://*/**", "http://*/**"], // Needed so that solace scripts can run on any kind of solace urls
  web_accessible_resources: [
    {
      resources: ["src/solace.ts"],
      matches: ["<all_urls>"],
    },
  ],
});
