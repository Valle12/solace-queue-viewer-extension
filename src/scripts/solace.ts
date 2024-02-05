import solace from "solclientjs";
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
  session!: solace.Session;

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
        startReceiving.addEventListener("click", () =>
          this.establishConnection()
        );
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

  establishConnection() {
    let factoryProps = new solace.SolclientFactoryProperties();
    factoryProps.profile = solace.SolclientFactoryProfiles.version10_5;
    solace.SolclientFactory.init(factoryProps);
    this.session = solace.SolclientFactory.createSession({
      url: this.solaceConfig.host,
      vpnName: this.solaceConfig.vpn,
      userName: this.solaceConfig.username,
      password: this.solaceConfig.password,
    });
    this.session.connect();

    this.session.on(solace.SessionEventCode.UP_NOTICE, () =>
      this.startMessageBrowser()
    );
  }

  startMessageBrowser() {
    let queueName = this.readQueueName();
    if (queueName === "") return;
    let queueBrowser = this.session.createQueueBrowser({
      queueDescriptor: {
        name: queueName.split(" | ")[1],
        type: solace.QueueType.QUEUE,
      },
    });

    queueBrowser.on(solace.QueueBrowserEventName.UP, () => {
      console.log("connected to queue browser");
    });

    queueBrowser.on(solace.QueueBrowserEventName.MESSAGE, (message) => {
      let binaryAttachment = message.getBinaryAttachment();
      if (binaryAttachment == null) return;
      let binaryAttachmentString = binaryAttachment.toString();
      let decodedString = binaryAttachmentString.substring(
        binaryAttachmentString.indexOf("{")
      );
      console.log(decodedString, message.getDestination()?.getName());
      let replicationGroupMessageId = message.getReplicationGroupMessageId();
      if (replicationGroupMessageId == null) return;
      let id = replicationGroupMessageId.toString();
      let messageId = parseInt(id.substring(id.lastIndexOf("-") + 1), 16);
      console.log(messageId);
    });

    queueBrowser.connect();
  }

  readQueueName(): string {
    let queueName = document.querySelector<HTMLSpanElement>(
      "span.title.title-content.detail-title-width.ellipsis-data"
    );
    if (queueName == null) return "";
    return queueName.innerText;
  }
}

new Solace();
