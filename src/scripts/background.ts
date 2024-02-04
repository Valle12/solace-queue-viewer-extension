import { ChromeMessage, ChromeMessageType, MessageConstant } from "./types";

export class Background {
  regex: RegExp;

  constructor() {
    this.regex = new RegExp(
      "https://.*.messaging.solace.cloud:943/.*/endpoints/queues/.*/messages?",
      "gm"
    );

    this.addListeners();
  }

  addListeners() {
    chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, _tab) => {
      if (changeInfo.status !== "complete") return;
      let [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      if (tab.url == undefined || tab.id == undefined) return;
      if (!this.regex.test(tab.url)) {
        await chrome.tabs.sendMessage(tab.id, {
          from: ChromeMessageType.BACKGROUND,
          to: ChromeMessageType.SOLACE,
          message: MessageConstant.MESSAGES_QUEUED_URL_CHECK_FALSE,
        } as ChromeMessage);
        return;
      }

      await chrome.tabs.sendMessage(tab.id, {
        from: ChromeMessageType.BACKGROUND,
        to: ChromeMessageType.SOLACE,
        message: MessageConstant.MESSAGES_QUEUED_URL_CHECK,
      } as ChromeMessage);
    });
  }
}

new Background();
