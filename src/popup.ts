import "material-design-lite/material.min.css";
import "material-design-lite/material.min.js";
import {
  type ChromeMessage,
  ChromeMessageType,
  MessageConstant,
} from "./scripts/types";

export class Popup {
  defaultErrorMessage = "No errors recorded";
  errors: string[] = [];

  constructor() {
    if (this.errors.length == 0) {
      let errorPanel = document.querySelector("#error-panel") as HTMLDivElement;
      errorPanel.innerText = this.defaultErrorMessage;
    }

    this.addListeners();
  }

  async addListeners() {
    this.errors = await this.sendMessage<string[]>(
      ChromeMessageType.BACKGROUND,
      MessageConstant.POPUP_GET_ERRORS
    );
    if (this.errors.length == 0) return;
    console.log(this.errors);
    let errorPanel = document.querySelector("#error-panel") as HTMLDivElement;
    errorPanel.innerText = "";

    let ul: HTMLUListElement = document.createElement("ul");
    ul.classList.add("mdl-list");

    for (let error of this.errors) {
      let li: HTMLLIElement = document.createElement("li");
      li.classList.add("mdl-list__item");

      let span: HTMLSpanElement = document.createElement("span");
      span.classList.add("mdl-list__item-primary-content");
      span.innerText = error;

      li.appendChild(span);
      ul.appendChild(li);
    }

    errorPanel.appendChild(ul);
  }

  async sendMessage<T>(
    to: ChromeMessageType,
    message: MessageConstant
  ): Promise<T> {
    let messageTyped: ChromeMessage = {
      from: ChromeMessageType.POPUP,
      to,
      message,
    };
    return chrome.runtime.sendMessage<ChromeMessage, T>(messageTyped);
  }
}

new Popup();
