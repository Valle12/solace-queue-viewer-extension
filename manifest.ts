import { defineManifest } from "bun-chrome-extension-dev";
import packageJson from "./package.json";
const { version } = packageJson;

const [major, minor, patch] = version.replace(/[^\d.-]+/g, "").split(/[.-]/);

export const manifest = defineManifest({
  name: "Solace Queue Viewer",
  version: `${major}.${minor}.${patch}`,
  description: "Enables you to see solace messages directly in the browser.",
  background: {
    service_worker: "src/background.ts",
  },
  action: {
    default_popup: "src/popup/popup.html",
  },
  permissions: ["storage", "unlimitedStorage", "scripting", "activeTab"],
  host_permissions: ["https://*/**", "http://*/**"], // Needed so that solace scripts can run on any kind of solace urls
  web_accessible_resources: [
    {
      resources: ["src/solace.ts"],
      matches: ["<all_urls>"],
    },
  ],
  icons: {
    16: "public/icons/icon16.png",
    32: "public/icons/icon32.png",
    48: "public/icons/icon48.png",
    128: "public/icons/icon128.png",
  },
});
