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
  content_scripts: [
    {
      ts: ["src/solace.ts"],
      matches: ["<all_urls>"], // TODO only on messages page
    },
  ],
  action: {
    default_popup: "src/popup/popup.html",
  },
  permissions: ["storage", "webNavigation", "unlimitedStorage"],
});
