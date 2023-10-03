import { Message } from "./solace";

export class Background {
  lastInfo!: string;
  lastErrors: string[] = [];

  constructor() {
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === "solace") {
        port.onMessage.addListener((message: Message, _port) => {
          if (message.type === "info") {
            this.lastInfo = message.message;
          } else if (message.type === "error") {
            this.addErrorToLimitedSizeQueue(message.message);
          }
        });
      } else if (port.name === "popup") {
      }
    });
  }

  addErrorToLimitedSizeQueue(error: string) {
    if (this.lastErrors.unshift(error) > 10) {
      this.lastErrors.pop();
    }
  }
}

new Background();
