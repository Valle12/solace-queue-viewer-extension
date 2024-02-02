export class Background {
  tabURL!: string;
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
      if (tab.url == undefined) return;
      this.tabURL = tab.url;
    });

    chrome.runtime.onMessage.addListener(
      (_message: string, _sender, sendResponse) => {
        sendResponse(this.regex.test(this.tabURL));
      }
    );
  }
}

new Background();
