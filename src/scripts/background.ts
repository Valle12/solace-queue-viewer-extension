import {
  type ChromeMessage,
  ChromeMessageType,
  MessageConstant,
} from "./types";

export class Background {
  solaceRegex = new RegExp(
    "https://.*.messaging.solace.cloud:943/.*/endpoints/queues/.*/messages?",
    "gm"
  );
  configExtractorRegex = new RegExp(
    "https://console.solace.cloud/mc/services/.*",
    "gm"
  );
  configExtractorAltRegex = new RegExp(
    "https://console.solace.cloud/services/.*",
    "gm"
  );
  configExtractorConnectPageRegex = new RegExp(
    "https://console.solace.cloud/mc/services/.*/connect",
    "gm"
  );
  errors: string[] = [];
  webpageNotFullyLoaded = false;

  constructor() {
    this.addListeners();
  }

  addListeners() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      let messageTyped = message as ChromeMessage;
      if (messageTyped.to !== ChromeMessageType.BACKGROUND) return;
      if (
        messageTyped.message ==
          MessageConstant.CONFIG_EXTRACTOR_WEB_PAGE_NOT_LOADED &&
        !this.webpageNotFullyLoaded
      ) {
        this.webpageNotFullyLoaded = true;
        this.errors.push("Web page was not fully loaded yet");
      } else if (messageTyped.message == MessageConstant.POPUP_GET_ERRORS) {
        sendResponse(this.errors);
      } else if (
        messageTyped.message === MessageConstant.SOLACE_CONNECTION_FAILED
      ) {
        this.errors.push(
          "Failed to establish connection to Solace. Might be due to badly extracted configuration"
        );
      } else if (
        messageTyped.message === MessageConstant.QUEUE_BROWSER_CONNECION_FAILED
      ) {
        this.errors.push("Failed to establish connection to queue browser");
      } else if (
        messageTyped.message === MessageConstant.CLUSTER_NOT_EXTRACTED
      ) {
        this.errors.push("Failed to extract cluster name");
      } else if (messageTyped.message === MessageConstant.HOST_NOT_EXTRACTED) {
        this.errors.push("Failed to extract host name");
      } else if (messageTyped.message === MessageConstant.VPN_NOT_EXTRACTED) {
        this.errors.push("Failed to extract VPN name");
      } else if (
        messageTyped.message === MessageConstant.USERNAME_NOT_EXTRACTED
      ) {
        this.errors.push("Failed to extract username");
      } else if (
        messageTyped.message === MessageConstant.PASSWORD_NOT_EXTRACTED
      ) {
        this.errors.push("Failed to extract password");
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
      } else if (
        this.configExtractorRegex.test(tab.url) ||
        this.configExtractorAltRegex.test(tab.url)
      ) {
        this.sendMessage(
          tab.id,
          ChromeMessageType.CONFIG_EXTRACTOR,
          MessageConstant.CONFIG_EXTRACTOR_URL_CHECK
        );
      } else if (this.configExtractorConnectPageRegex.test(tab.url)) {
        this.sendMessage(
          tab.id,
          ChromeMessageType.CONFIG_EXTRACTOR,
          MessageConstant.CONFIG_EXTRACTOR_CONNECT_PAGE_LOADED
        );
      } else {
        this.sendMessage(
          tab.id,
          ChromeMessageType.SOLACE,
          MessageConstant.MESSAGES_QUEUED_URL_CHECK_FALSE
        );
      }
    });

    chrome.webNavigation.onCommitted.addListener(async (details) => {
      if (
        details.transitionType === "reload" &&
        this.solaceRegex.test(details.url)
      ) {
        this.sendMessage(
          details.tabId,
          ChromeMessageType.SOLACE,
          MessageConstant.MESSAGES_QUEUED_URL_CHECK_FALSE
        );
        setTimeout(() => {
          this.sendMessage(
            details.tabId,
            ChromeMessageType.SOLACE,
            MessageConstant.MESSAGES_QUEUED_URL_CHECK
          );
        }, 2000);
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
