import { ChromeMessage, ChromeMessageType, MessageConstant } from "./types";
import "/node_modules/material-design-lite/material.min.css";
import "/node_modules/material-design-lite/material.min.js";

export type SolaceConfig = {
  host: string;
  password: string;
  vpn: string;
  username: string;
};

export class Solace {
  solaceConfig!: SolaceConfig;
  configLoaded = false;
  buttonsInserted = false;

  constructor() {
    this.addListeners();
  }

  addListeners() {
    document.body.addEventListener("click", () => this.loadConfig());

    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
      let messageTyped = message as ChromeMessage;
      if (messageTyped.to !== ChromeMessageType.SOLACE) return;
      if (messageTyped.message == MessageConstant.MESSAGES_QUEUED_URL_CHECK) {
        this.insertButtons();
      } else if (
        messageTyped.message == MessageConstant.MESSAGES_QUEUED_URL_CHECK_FALSE
      ) {
        this.buttonsInserted = false;
      }
    });
  }

  async loadConfig() {
    if (!this.configLoaded) {
      let extensionPrefix = "solaceQueueViewerExtension.";
      let clusterDiv =
        document.querySelector<HTMLDivElement>("div.data.title div");
      if (clusterDiv == null) return;
      let clusterPrefix = clusterDiv.innerText;
      let prefix = extensionPrefix + clusterPrefix;
      let values = await chrome.storage.local.get();
      this.solaceConfig = {
        host: values[`${prefix}.host`],
        password: values[`${prefix}.password`],
        vpn: values[`${prefix}.vpn`],
        username: values[`${prefix}.username`],
      };
      this.configLoaded = true;
    }
  }

  async insertButtons() {
    if (!this.buttonsInserted) {
      setTimeout(() => {
        let font = new FontFace(
          "MaterialIcons",
          "url(https://fonts.googleapis.com/icon?family=Material+Icons)"
        );
        document.fonts.add(font);
        let startReceiving = document.createElement("button");
        this.insertButton(startReceiving, "play_arrow");
        let stopReceiving = document.createElement("button");
        this.insertButton(stopReceiving, "stop");
        let actionPanel = document.querySelector<HTMLUListElement>(
          "ul.au-target.table-action-panel.nav.flex-nowrap"
        );
        if (actionPanel == null) return;
        actionPanel.appendChild(startReceiving);
        actionPanel.appendChild(stopReceiving);
        this.buttonsInserted = true;
      }, 1000);
    }
  }

  insertButton(button: HTMLButtonElement, icon: string) {
    button.classList.add("mdl-button", "mdl-js-button", "mdl-button--icon");
    button.style.margin = "0 5px 1px 5px";
    button.style.minWidth = "0";
    button.style.minHeight = "0";
    button.style.width = "30px";
    button.style.height = "30px";
    button.style.color = "#00C895";
    let buttonIcon = document.createElement("i");
    buttonIcon.classList.add("material-icons");
    buttonIcon.innerText = icon;
    button.appendChild(buttonIcon);
  }
}

new Solace();
