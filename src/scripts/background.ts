import { ChromeMessage, ChromeMessageType, MessageConstant } from "./types";

export class Background {
  solaceRegex = new RegExp(
    "https://.*.messaging.solace.cloud:943/.*/endpoints/queues/.*/messages?",
    "gm"
  );
  configExtractorRegex = new RegExp(
    "https://console.solace.cloud/services/.*",
    "gm"
  );
  errors: string[] = [];

  constructor() {
    this.addListeners();
  }

  addListeners() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      let messageTyped = message as ChromeMessage;
      if (messageTyped.to !== ChromeMessageType.BACKGROUND) return;
      if (
        messageTyped.message ==
        MessageConstant.CONFIG_EXTRACTOR_WEB_PAGE_NOT_LOADED
      ) {
        this.errors.push("Web page was not fully loaded yet");
      } else if (messageTyped.message == MessageConstant.POPUP_GET_ERRORS) {
        sendResponse(this.errors);
      }
    });

    chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, _tab) => {
      if (changeInfo.status !== "complete") return;
      let [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      if (tab.url == undefined || tab.id == undefined) return;
      if (this.solaceRegex.test(tab.url)) {
        this.sendMessage(
          tab.id,
          ChromeMessageType.SOLACE,
          MessageConstant.MESSAGES_QUEUED_URL_CHECK
        );
      } else if (this.configExtractorRegex.test(tab.url)) {
        this.sendMessage(
          tab.id,
          ChromeMessageType.SOLACE,
          MessageConstant.CONFIG_EXTRACTOR_URL_CHECK
        );
      } else {
        this.sendMessage(
          tab.id,
          ChromeMessageType.SOLACE,
          MessageConstant.MESSAGES_QUEUED_URL_CHECK_FALSE
        );
      }
    });
  }

  async sendMessage(
    id: number,
    to: ChromeMessageType,
    message: MessageConstant
  ) {
    chrome.tabs
      .sendMessage(id, {
        from: ChromeMessageType.BACKGROUND,
        to,
        message,
      } as ChromeMessage)
      .catch(() => {});
  }
}

new Background();
