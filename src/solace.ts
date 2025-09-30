import {
  ErrorSubcode,
  LogLevel,
  OperationError,
  QueueBrowser,
  QueueBrowserEventName,
  QueueDescriptor,
  QueueType,
  Session,
  SessionEventCode,
  SolclientFactory,
  SolclientFactoryProfiles,
  SolclientFactoryProperties,
} from "solclientjs";
import type { ChromeMessage, SolaceButton, SolaceMessage } from "./types";

export class Solace {
  password = "";
  url = "";
  userName = "";
  vpnName = "";
  session: Session | undefined = undefined;
  queueBrowser: QueueBrowser | undefined = undefined;
  currentIcon: SolaceButton = "play_arrow";
  table: HTMLTableElement | undefined | null = undefined;
  messages: Map<string, SolaceMessage> = new Map();
  tableAbort = new AbortController();

  init() {
    this.addListeners();
    this.initSolaceProperties();
  }

  addListeners() {
    // Call when the page is loaded the first time
    window.addEventListener("load", () => {
      const url = window.location.href;
      const clusterName = url.substring(0, url.indexOf("/", 8));
      this.loadCredentials(clusterName);
      this.detectButton(url);
    });

    // Call when the page navigates
    window.addEventListener("popstate", () => {
      const url = window.location.href;
      this.detectButton(url);
    });
  }

  initSolaceProperties() {
    const properties = new SolclientFactoryProperties();
    properties.profile = SolclientFactoryProfiles.version10_5;
    properties.logLevel = LogLevel.WARN;
    SolclientFactory.init(properties);
  }

  detectButton(url: string) {
    if (!(url.includes("queues/") && url.includes("/messages"))) return;
    const selector =
      "li.au-target.nav-item.dropdown.action-menu.list-action.showInput";
    let ele = document.querySelector<HTMLLIElement>(selector);
    if (ele) {
      this.insertButton(ele, url);
    } else {
      const observer = new MutationObserver((_mutations, observer) => {
        ele = document.querySelector<HTMLLIElement>(selector);
        if (!ele) return;
        observer.disconnect();
        this.insertButton(ele, url);
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  insertButton(ele: HTMLLIElement, url: string) {
    // insert table listener
    this.addClickListenerForTable();

    // insert style tag
    let button = ele.querySelector("button.material-button");
    if (!button) {
      ele.style.display = "flex";
      ele.style.flexDirection = "row";

      const style = document.createElement("style");
      style.textContent = `
      button:focus:not(.disabled) {
        box-shadow: none;
      }

      .material-button {
        display: inline-flex;
        align-items: center;
        font-size: 24px;
        color: #00c895;
        background-color: transparent;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        box-shadow: none;
      }

      .material-button .icon {
        width: 24px;
        height: 24px;
        fill: currentColor;
      }
      `;
      document.head.appendChild(style);
    }

    // insert action button
    if (button) button.remove();
    button = document.createElement("button");
    button.classList.add("material-button");

    if (this.currentIcon === "play_arrow") {
      button.innerHTML = `<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="300 -780 480 600"><path d="M320-200v-560l440 280-440 280Z"/></svg>`;
    } else if (this.currentIcon === "stop") {
      button.innerHTML = `<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="300 -780 480 600"><path d="M240-240v-480h480v480H240Z"/></svg>`;
    }

    button.addEventListener(
      "click",
      () => {
        if (this.currentIcon === "play_arrow") {
          this.currentIcon = "stop";
          const queueName = this.extractQueueName();
          if (!queueName) return;
          this.createQueueBrowser(queueName);
        } else {
          this.currentIcon = "play_arrow";
          this.disconnect();
        }

        this.detectButton(url);
      },
      {
        once: true,
      }
    );

    ele.prepend(button);
  }

  extractQueueName() {
    const queueElement = document.querySelector(
      "span.title.title-content.detail-title-width.ellipsis-data"
    );

    if (!queueElement) {
      this.sendMessage({
        type: "sendError",
        content: `[${new Date().toLocaleTimeString()}] Could not extract queue element`,
      });
      return;
    }

    const queue = queueElement.textContent;

    if (!queue) {
      this.sendMessage({
        type: "sendError",
        content: `[${new Date().toLocaleTimeString()}] Could not extract queue name`,
      });
      return;
    }

    return queue.substring(queue.indexOf("|") + 1).trim();
  }

  async loadCredentials(clusterName: string) {
    const result = await chrome.storage.local.get([
      `${clusterName}.password`,
      `${clusterName}.url`,
      `${clusterName}.userName`,
      `${clusterName}.vpn`,
    ]);

    this.password = result[`${clusterName}.password`];
    this.url = result[`${clusterName}.url`];
    this.userName = result[`${clusterName}.userName`];
    this.vpnName = result[`${clusterName}.vpn`];

    if (!this.url) {
      this.sendMessage({
        type: "sendError",
        content: `[${new Date().toLocaleTimeString()}] Connection URL not set`,
      });

      return;
    }

    this.createSession();
  }

  createSession() {
    try {
      this.session = SolclientFactory.createSession({
        password: this.password,
        url: this.url,
        userName: this.userName,
        vpnName: this.vpnName,
      });

      this.session.on(SessionEventCode.UP_NOTICE, () => {
        this.sendMessage({
          type: "sendInfo",
          content: "Successfully connected to session",
        });
      });

      this.session.on(SessionEventCode.DISCONNECTED, () => {
        this.sendMessage({
          type: "sendInfo",
          content: "Successfully disconnected from session",
        });
      });

      this.session.connect();
    } catch (error) {
      if (!(error instanceof OperationError)) return;
      if (error.subcode === ErrorSubcode.PARAMETER_INVALID_TYPE) {
        this.sendMessage({
          type: "sendError",
          content: `[${new Date().toLocaleTimeString()}] Invalid connection parameter types: ${
            error.message
          }`,
        });
      } else if (error.subcode === ErrorSubcode.INVALID_OPERATION) {
        this.sendMessage({
          type: "sendError",
          content: `[${new Date().toLocaleTimeString()}] Session is disposed, already connected or connecting: ${
            error.message
          }`,
        });
      } else if (error.subcode === ErrorSubcode.CONNECTION_ERROR) {
        this.sendMessage({
          type: "sendError",
          content: `[${new Date().toLocaleTimeString()}] Connection could not be established: ${
            error.message
          }`,
        });
      }
    }
  }

  createQueueBrowser(queueName: string) {
    try {
      if (!this.session) {
        this.sendMessage({
          type: "sendError",
          content: `[${new Date().toLocaleTimeString()}] Session not created yet (should not have happened)`,
        });
        return;
      }

      const queueDescriptor = new QueueDescriptor({
        type: QueueType.QUEUE,
        name: queueName,
      });

      this.queueBrowser = this.session.createQueueBrowser({
        queueDescriptor,
      });

      this.queueBrowser.on(QueueBrowserEventName.UP, () => {
        this.addClickListenerForTable();
        this.sendMessage({
          type: "sendInfo",
          content: "Successfully connected to queue",
        });
      });

      this.queueBrowser.on(QueueBrowserEventName.DOWN, () => {
        this.sendMessage({
          type: "sendInfo",
          content: "Successfully disconnected from queue",
        });
      });

      this.queueBrowser.on(QueueBrowserEventName.MESSAGE, message => {
        const replicationId = message.getReplicationGroupMessageId();

        if (!replicationId) {
          this.sendMessage({
            type: "sendError",
            content: `[${new Date().toLocaleTimeString()}] Message ID not set`,
          });
          return;
        }

        const id = replicationId.toString();
        this.messages.set(id, {
          topic: message.getDestination()?.getName(),
          message: new TextDecoder().decode(
            message.getBinaryAttachment() as Uint8Array
          ),
        });
      });

      this.queueBrowser.connect();
    } catch (error) {
      if (!(error instanceof OperationError)) return;
      if (error.subcode === ErrorSubcode.INVALID_OPERATION) {
        this.sendMessage({
          type: "sendError",
          content: `[${new Date().toLocaleTimeString()}] Consumer is not supported by router for this client: ${
            error.message
          }`,
        });
      } else {
        this.sendMessage({
          type: "sendError",
          content: `[${new Date().toLocaleTimeString()}] Queue browser error: ${
            error.message
          }`,
        });
      }
    }
  }

  addClickListenerForTable() {
    this.tableAbort.abort();
    this.tableAbort = new AbortController();
    this.table = document.querySelector<HTMLTableElement>(
      "div.table-container table.table.table-sm.table-hover.table-striped.border-separate"
    );

    if (!this.table) {
      this.sendMessage({
        type: "sendError",
        content: `[${new Date().toLocaleTimeString()}] Table not found`,
      });
      return;
    }

    this.table.addEventListener(
      "click",
      async event => {
        const target = event.target;
        if (!target || !(target instanceof Element)) return;
        const row = target.closest("tr")?.nextElementSibling;
        if (!row) return;
        const id = row.querySelector(
          "td:last-child compose div div:nth-child(2) div:last-child span:last-child"
        )?.textContent;

        if (!id) {
          this.sendMessage({
            type: "sendError",
            content: `[${new Date().toLocaleTimeString()}] Message ID not found`,
          });
          return;
        }

        const message = this.messages.get(id);

        if (!message) {
          this.sendMessage({
            type: "sendError",
            content: `[${new Date().toLocaleTimeString()}] Message not saved before. Is the process running?`,
          });
          return;
        }

        this.insertMessage(row, message);
      },
      {
        signal: this.tableAbort.signal,
      }
    );
  }

  insertMessage(row: Element, message: SolaceMessage) {
    const compose = row.querySelector("td:last-child compose");
    if (!compose) return;

    // remove content from previous page
    const lastDiv = compose.lastElementChild;
    if (!lastDiv) return;
    if (compose.childElementCount >= 2) lastDiv.remove();

    // insert infoContainer if not already inserted
    if (compose.childElementCount >= 2) return;
    const infoContainer = document.createElement("div");

    // insert copy and format buttons
    const icons = document.createElement("div");
    const copyButton = document.createElement("button");
    copyButton.classList.add("material-button");
    copyButton.style.paddingLeft = "0";
    copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#00c895"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg>`;
    copyButton.setAttribute("tooltip", "Copy message to clipboard");
    this.addTooltip(copyButton);
    copyButton.addEventListener("click", async () => {
      await navigator.clipboard.writeText(message.message);
    });
    icons.appendChild(copyButton);

    const formatButton = document.createElement("button");
    formatButton.classList.add("material-button");
    formatButton.style.paddingLeft = "0";
    formatButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#00c895"><path d="M120-120v-80h720v80H120Zm0-160v-80h480v80H120Zm0-160v-80h720v80H120Zm0-160v-80h480v80H120Zm0-160v-80h720v80H120Z"/></svg>`;
    formatButton.setAttribute("tooltip", "Format message to pretty JSON");
    formatButton.addEventListener("click", () => {
      this.updateInfoText(infoText, message.message, message.topic, true);
    });
    icons.appendChild(formatButton);
    infoContainer.appendChild(icons);

    // insert info text
    const infoText = document.createElement("div");
    this.updateInfoText(infoText, message.message, message.topic);
    infoContainer.appendChild(infoText);

    compose.appendChild(infoContainer);
  }

  disconnect() {
    if (!this.queueBrowser) return;
    this.queueBrowser.disconnect();
  }

  updateInfoText(
    infoText: HTMLDivElement,
    message: string,
    topic?: string,
    formatted = false
  ) {
    infoText.innerHTML = `
    <strong style="color: #00c895">Topic</strong>: ${topic ?? "-"}<br>
    <strong style="color: #00c895">Message</strong>: ${
      (formatted
        ? "<pre style='font-family: inherit; font-size: inherit'>"
        : "") +
      message +
      (formatted ? "</pre>" : "")
    }
    `;
  }

  addTooltip(ele: HTMLElement) {
    const cssClass = ele.classList[0];
    const style = document.createElement("style");
    style.textContent = `
    .${cssClass} {
      position: relative;
    }

    .${cssClass}::after {
      content: attr(tooltip);
      position: absolute;
      left: 50%;
      transform: translate(-50%, -20%) scale(0.95);
      bottom: 100%;
      margin-bottom: 8px;
      white-space: nowrap;
      padding: 6px 8px;
      border-radius: 6px;
      background: #111;
      color: white;
      font-size: 13px;
      opacity: 0;
      pointer-events: none;
      z-index: 20;
    }

    .${cssClass}:hover::after,
    .${cssClass}:focus::after {
      opacity: 1;
      transform: translate(-50%, -10%) scale(1);
    }
    `;

    ele.appendChild(style);
  }

  sendMessage(message: ChromeMessage) {
    chrome.runtime.sendMessage<ChromeMessage, void>(message);
  }
}

if (process.env.NODE_ENV !== "test") {
  const solace = new Solace();
  solace.init();
}
