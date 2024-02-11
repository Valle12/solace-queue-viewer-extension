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

export type MessageElement = {
  messageId: number;
  message: string;
  topic: string;
};

export class Solace {
  solaceConfig!: SolaceConfig;
  configLoaded = false;
  buttonsInserted = false;
  session!: solace.Session;
  messages: MessageElement[] = [];
  queueBrowser!: solace.QueueBrowser;

  constructor() {
    this.addListeners();
  }

  addListeners() {
    document.body.addEventListener("click", () => this.loadConfig());

    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
      let messageTyped = message as ChromeMessage;
      if (messageTyped.to !== ChromeMessageType.SOLACE) return;
      if (messageTyped.message == MessageConstant.MESSAGES_QUEUED_URL_CHECK) {
        this.insertPlayButton();
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

  async insertPlayButton() {
    if (!this.buttonsInserted) {
      setTimeout(() => {
        let startReceiving = document.createElement("button");
        this.insertButton(startReceiving, "play_arrow");
        startReceiving.addEventListener("click", () => {
          let icon = startReceiving.firstElementChild as HTMLElement | null;
          if (icon == null) return;
          if (icon.innerText == "play_arrow") {
            icon.innerText = "stop";
            this.establishConnection();
          } else if (icon.innerText == "stop") {
            icon.innerText = "play_arrow";
            this.disconnect();
          }
        });
        let actionPanel = document.querySelector<HTMLUListElement>(
          "ul.au-target.table-action-panel.nav.flex-nowrap"
        );
        if (actionPanel == null) return;
        actionPanel.appendChild(startReceiving);
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
    this.messages = [];

    let queueName = this.readQueueName();
    if (queueName === "") return;
    this.queueBrowser = this.session.createQueueBrowser({
      queueDescriptor: {
        name: queueName.split(" | ")[1],
        type: solace.QueueType.QUEUE,
      },
    });

    this.queueBrowser.on(solace.QueueBrowserEventName.UP, () => {
      console.log("connected to queue browser");
    });

    this.queueBrowser.on(solace.QueueBrowserEventName.MESSAGE, (message) => {
      this.extractTableRow();
      let binaryAttachment = message.getBinaryAttachment();
      if (binaryAttachment == null) return;
      let binaryAttachmentString = binaryAttachment.toString();
      let decodedString = binaryAttachmentString.substring(
        binaryAttachmentString.indexOf("{")
      );
      let destination = message.getDestination();
      if (destination == null) return;
      let replicationGroupMessageId = message.getReplicationGroupMessageId();
      if (replicationGroupMessageId == null) return;
      let id = replicationGroupMessageId.toString();
      let messageId = parseInt(id.substring(id.lastIndexOf("-") + 1), 16);
      this.messages.push({
        messageId: messageId,
        message: decodedString,
        topic: destination.getName(),
      });
    });

    this.queueBrowser.connect();
  }

  readQueueName(): string {
    let queueName = document.querySelector<HTMLSpanElement>(
      "span.title.title-content.detail-title-width.ellipsis-data"
    );
    if (queueName == null) return "";
    return queueName.innerText;
  }

  extractTableRow() {
    let rows = document.querySelectorAll<HTMLTableElement>(
      "table.table.table-sm.table-hover.table-striped.border-separate tbody"
    );
    rows.forEach((row) => {
      if (row.firstElementChild?.getAttribute("click-listener") !== "true") {
        row.firstElementChild?.setAttribute("click-listener", "true");
        row.firstElementChild?.addEventListener("click", () =>
          this.insertMessageIntoTable(row)
        );
      }
    });
  }

  insertMessageIntoTable(tbody: HTMLTableElement) {
    let row = tbody.lastElementChild;
    if (row == null) return;
    let td = row.lastElementChild;
    if (td == null) return;
    if (row.classList.contains("hideInput")) {
      let messageIdSpan = tbody.querySelector<HTMLSpanElement>("span");
      if (messageIdSpan == null) return;
      let messageId = parseInt(messageIdSpan.innerText.trim());
      let messagesFiltered = this.messages.filter(
        (message) => message.messageId === messageId
      );
      if (messagesFiltered.length !== 1) return;
      let message = messagesFiltered[0];
      let textMessage = document.createElement("div");
      textMessage.id = "messageDiv";
      textMessage.innerText = `Topic:\n${message.topic}\nMessage:\n${message.message}`;
      td.appendChild(textMessage);
    } else if (row.classList.contains("showInput")) {
      td.querySelector<HTMLDivElement>("#messageDiv")?.remove();
    }
  }

  disconnect() {
    this.queueBrowser.disconnect();
    this.session.disconnect();
  }
}

new Solace();
