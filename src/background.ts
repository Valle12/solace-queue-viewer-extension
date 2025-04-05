import type { ChromeMessage, MessageResponse } from "./types";

const amountErrors = 5;

let lastInfo = "-";
let lastErrors: string[] = [];
let clusterUrlsSet: Set<string>;

function setToModifiedArray(set: Set<string>) {
  return set
    .values()
    .map(url => {
      if (url.endsWith("/*")) return url;
      return url + "/*";
    })
    .toArray();
}

chrome.storage.local.get("clusterUrls", async items => {
  clusterUrlsSet = new Set(items.clusterUrls);
  if (clusterUrlsSet.size === 0) return;
  const war = chrome.runtime.getManifest().web_accessible_resources;
  if (
    !war ||
    !Array.isArray(war) ||
    war.every(item => typeof item === "string")
  ) {
    return;
  }

  const urls = setToModifiedArray(clusterUrlsSet);
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

chrome.runtime.onMessage.addListener((tmpMsg, _sender, tmpSendResponse) => {
  const msg = tmpMsg as ChromeMessage;
  const sendResponse = tmpSendResponse as (response: MessageResponse) => void;

  if (msg.type === "sendInfo") {
    lastInfo = msg.content;
  } else if (msg.type === "sendError") {
    lastErrors.unshift(msg.content);
    if (lastErrors.length > amountErrors) lastErrors.pop();
  } else if (msg.type === "getData") {
    sendResponse({
      info: lastInfo,
      errors: lastErrors,
    });
  }
});

chrome.storage.local.onChanged.addListener(changes => {
  if (!changes.clusterUrls) return;
  clusterUrlsSet = new Set(changes.clusterUrls.newValue);
  if (clusterUrlsSet.size === 0) return;
  const urls = setToModifiedArray(clusterUrlsSet);
  chrome.scripting.updateContentScripts([
    {
      id: "solace",
      matches: urls,
    },
  ]);
});
