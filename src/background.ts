import type { ChromeMessage, MessageResponse } from "./types";

export class Background {
  amountErrors = 5;
  lastInfo = "-";
  lastErrors: string[] = [];
  clusterUrlsSet: Set<string> = new Set();

  init() {
    chrome.storage.local.get("clusterUrls", async items => {
      this.clusterUrlsSet = new Set(items.clusterUrls);
      if (this.clusterUrlsSet.size === 0) return;
      const war = chrome.runtime.getManifest().web_accessible_resources;
      if (
        !war ||
        !Array.isArray(war) ||
        war.every(item => typeof item === "string")
      ) {
        return;
      }

      const urls = this.setToModifiedArray();
      const scripts = await chrome.scripting.getRegisteredContentScripts();
      if (scripts.map(script => script.id).includes("solace")) return;
      await chrome.scripting.registerContentScripts([
        {
          id: "solace",
          js: war[0].resources,
          matches: urls,
        },
      ]);
    });

    chrome.storage.local.onChanged.addListener(changes => {
      if (!changes.clusterUrls) return;
      this.clusterUrlsSet = new Set(changes.clusterUrls.newValue);
      if (this.clusterUrlsSet.size === 0) return;
      const urls = this.setToModifiedArray();
      chrome.scripting.updateContentScripts([
        {
          id: "solace",
          matches: urls,
          css: [],
        },
      ]);
    });

    chrome.runtime.onMessage.addListener((tmpMsg, _sender, tmpSendResponse) => {
      const msg = tmpMsg as ChromeMessage;
      const sendResponse = tmpSendResponse as (
        response: MessageResponse
      ) => void;

      if (msg.type === "sendInfo") {
        this.lastInfo = msg.content;
      } else if (msg.type === "sendError") {
        this.lastErrors.unshift(msg.content);
        if (this.lastErrors.length > this.amountErrors) this.lastErrors.pop();
      } else if (msg.type === "getData") {
        sendResponse({
          info: this.lastInfo,
          errors: this.lastErrors,
        });
      }
    });
  }

  setToModifiedArray() {
    return this.clusterUrlsSet
      .values()
      .map(url => {
        if (url.endsWith("/*")) return url;
        return url + "/*";
      })
      .toArray();
  }
}

if (process.env.NODE_ENV !== "test") {
  const background = new Background();
  background.init();
}
