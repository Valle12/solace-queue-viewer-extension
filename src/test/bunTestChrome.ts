import type { ChromeMessage } from "../scripts/types";

export const chrome = {
  runtime: {
    onMessage: {
      listeners: [] as Function[],
      addListener(callback: Function) {
        this.listeners.push(callback);
      },
      callListeners(message: ChromeMessage, sender: any, sendResponse: any) {
        this.listeners.forEach((listener) =>
          listener(message, sender, sendResponse)
        );
      },
      clearListeners() {
        this.listeners = [];
      },
    },
    sendMessage(_message: ChromeMessage) {
      return Promise.resolve();
    },
  },
  tabs: {
    query(_queryInfo: chrome.tabs.QueryInfo) {
      const tab = {} as chrome.tabs.Tab;
      return Promise.resolve([tab]);
    },
    onUpdated: {
      listeners: [] as Function[],
      addListener(callback: Function) {
        this.listeners.push(callback);
      },
      callListeners(
        tabId: number,
        changeInfo: chrome.tabs.TabChangeInfo,
        tab: chrome.tabs.Tab
      ) {
        this.listeners.forEach((listener) => listener(tabId, changeInfo, tab));
      },
      clearListeners() {
        this.listeners = [];
      },
    },
    sendMessage(_tabId: number, _message: ChromeMessage) {
      return Promise.resolve();
    },
  },
  storage: {
    local: {
      set: async (data: any) => data,
      get: async () => {
        return {};
      },
    },
  },
  webNavigation: {
    onCommitted: {
      listeners: [] as Function[],
      addListener(callback: Function) {
        this.listeners.push(callback);
      },
    },
  },
};
