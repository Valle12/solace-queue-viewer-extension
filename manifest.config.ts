import { defineManifest } from "@crxjs/vite-plugin";
import packageJson from "./package.json";
const { version } = packageJson;

const [major, minor, patch] = version.replace(/[^\d.-]+/g, "").split(/[.-]/);

export default defineManifest({
  manifest_version: 3,
  name: "Solace Queue Viewer",
  version: `${major}.${minor}.${patch}`,
  description: "Enables you to see solace messages directly in the browser.",
  action: {
    default_popup: "src/res/views/popup.html",
  },
  background: {
    service_worker: "src/scripts/background.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://*.messaging.solace.cloud:943/*"],
      js: ["src/scripts/solace.ts"],
    },
  ],
});
