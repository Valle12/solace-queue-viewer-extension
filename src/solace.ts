import JSZip from "jszip";
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
  baseColor = "#00c895";

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
    if (!(url.includes("queues/") && url.includes("/messages"))) {
      this.disconnect();
      return;
    }

    const selector =
      "li.au-target.nav-item.dropdown.action-menu.list-action.showInput";
    let ele = document.querySelector<HTMLLIElement>(selector);
    if (ele) {
      this.extractBaseColor(ele);
      this.insertButton(ele, url);
    } else {
      const observer = new MutationObserver((_mutations, observer) => {
        ele = document.querySelector<HTMLLIElement>(selector);
        if (!ele) return;
        observer.disconnect();
        this.extractBaseColor(ele);
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
    let processButton = ele.querySelector("#process-button");
    if (!processButton) {
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
        color: ${this.baseColor};
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
    if (processButton) processButton.remove();
    processButton = document.createElement("button");
    processButton.classList.add("material-button");
    processButton.id = "process-button";

    if (this.currentIcon === "play_arrow") {
      processButton.innerHTML = `<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="300 -780 480 600"><path d="M320-200v-560l440 280-440 280Z"/></svg>`;
    } else if (this.currentIcon === "stop") {
      processButton.innerHTML = `<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="300 -780 480 600"><path d="M240-240v-480h480v480H240Z"/></svg>`;
    }

    processButton.addEventListener(
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
      },
    );

    ele.prepend(processButton);

    // insert download button
    let downloadButton = ele.querySelector("#download-button");
    if (downloadButton) downloadButton.remove();
    if (this.currentIcon === "play_arrow") return;
    downloadButton = document.createElement("button");
    downloadButton.classList.add("material-button");
    downloadButton.id = "download-button";
    downloadButton.innerHTML = `<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>`;

    downloadButton.addEventListener("click", async () => {
      await this.downloadAllJsonMessages();
    });

    ele.prepend(downloadButton);
  }

  extractBaseColor(ele: HTMLLIElement) {
    const i = ele.querySelector("i");
    if (!i) return;
    this.baseColor = window.getComputedStyle(i).color;
  }

  extractQueueName() {
    const queueElement = document.querySelector(
      "span.title.title-content.detail-title-width.ellipsis-data",
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

    this.password = result[`${clusterName}.password`] as string;
    this.url = result[`${clusterName}.url`] as string;
    this.userName = result[`${clusterName}.userName`] as string;
    this.vpnName = result[`${clusterName}.vpn`] as string;

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
            message.getBinaryAttachment() as Uint8Array,
          ),
          isJson: false,
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
      "div.table-container table.table.table-sm.table-hover.table-striped.border-separate",
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
        const spans = row.querySelectorAll("span");
        let id: string | null = null;

        for (let i = 0; i < spans.length; i++) {
          if (spans[i].textContent?.includes("Replication Group Message ID:")) {
            const idSpan = spans[i].nextElementSibling;
            if (idSpan && idSpan.tagName === "SPAN") {
              id = idSpan.textContent;
              break;
            }
          }
        }

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

        this.insertMessage(row, message, id);
      },
      {
        signal: this.tableAbort.signal,
      },
    );
  }

  insertMessage(row: Element, message: SolaceMessage, id: string) {
    const compose = row.querySelector("td:last-child compose");
    if (!compose) return;

    // remove content from previous page
    const lastDiv = compose.lastElementChild;
    if (!lastDiv) return;
    if (compose.childElementCount >= 2) lastDiv.remove();

    // insert infoContainer if not already inserted
    if (compose.childElementCount >= 2) return;
    const infoContainer = document.createElement("div");

    // internal formatting to JSON if possible
    if (!message.isJson) this.tryJsonParse(message);

    // insert copy, format and download buttons
    const icons = document.createElement("div");
    const copyButton = document.createElement("button");
    copyButton.classList.add("material-button");
    copyButton.style.paddingLeft = "0";
    copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="${this.baseColor}"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg>`;
    copyButton.setAttribute("tooltip", "Copy message to clipboard");
    this.addTooltip(copyButton);
    copyButton.addEventListener("click", async () => {
      await navigator.clipboard.writeText(message.message);
      this.displayToast("Message copied to clipboard");
      copyButton.blur();
    });
    icons.appendChild(copyButton);

    const formatButton = document.createElement("button");
    formatButton.classList.add("material-button");
    formatButton.style.paddingLeft = "0";
    formatButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="${this.baseColor}"><path d="M120-120v-80h720v80H120Zm0-160v-80h480v80H120Zm0-160v-80h720v80H120Zm0-160v-80h480v80H120Zm0-160v-80h720v80H120Z"/></svg>`;
    formatButton.setAttribute("tooltip", "Format message to pretty JSON");
    formatButton.addEventListener("click", () => {
      this.updateInfoText(infoText, message.message, message.topic, true);
      formatButton.blur();
    });
    if (message.isJson) icons.appendChild(formatButton);

    const downloadButton = document.createElement("button");
    downloadButton.classList.add("material-button");
    downloadButton.style.paddingLeft = "0";
    downloadButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="${this.baseColor}"><path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>`;
    downloadButton.setAttribute("tooltip", "Download JSON");
    downloadButton.addEventListener("click", () => {
      const blob = new Blob([message.message], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${message.topic ? message.topic : id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      downloadButton.blur();
    });
    if (message.isJson) icons.appendChild(downloadButton);
    infoContainer.appendChild(icons);

    // insert info text
    const infoText = document.createElement("div");
    this.updateInfoText(infoText, message.message, message.topic);
    infoContainer.appendChild(infoText);

    compose.appendChild(infoContainer);
  }

  disconnect() {
    if (!this.queueBrowser) return;
    this.currentIcon = "play_arrow";
    this.queueBrowser.disconnect();
  }

  updateInfoText(
    infoText: HTMLDivElement,
    message: string,
    topic?: string,
    formatted = false,
  ) {
    infoText.innerHTML = `
    <strong style="color: ${this.baseColor}">Topic</strong>: ${topic ?? "-"}<br>
    <strong style="color: ${this.baseColor}">Message</strong>: ${
      (formatted
        ? "<pre style='font-family: inherit; font-size: inherit'>"
        : "") +
      message +
      (formatted ? "</pre>" : "")
    }
    `;
  }

  tryJsonParse(solaceMessage: SolaceMessage) {
    const message = solaceMessage.message;
    const firstCurly = message.indexOf("{");
    const firstSquare = message.indexOf("[");

    let startIndex = -1;
    let endIndex = -1;

    if (firstCurly !== -1 && (firstSquare === -1 || firstCurly < firstSquare)) {
      startIndex = firstCurly;
      endIndex = message.lastIndexOf("}") + 1;
    } else if (firstSquare !== -1) {
      startIndex = firstSquare;
      endIndex = message.lastIndexOf("]") + 1;
    }

    try {
      if (startIndex !== -1 && endIndex > startIndex) {
        const potentialJson = message.substring(startIndex, endIndex);
        const parsed = JSON.parse(potentialJson);
        solaceMessage.message = JSON.stringify(parsed, null, 2);
        solaceMessage.isJson = true;
        return;
      }
    } catch (e) {}
  }

  async downloadAllJsonMessages() {
    const zip = new JSZip();
    for (const entry of this.messages) {
      this.tryJsonParse(entry[1]);
      if (!entry[1].isJson) continue;
      const safeName = entry[0].replace(/[<>:"/\\|?*]/g, "_");
      zip.file(`${safeName}.json`, entry[1].message);
    }

    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 9,
      },
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "all_messages.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  addTooltip(ele: HTMLElement) {
    const cssClass = ele.classList[0];
    if (!cssClass) return;
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

  displayToast(message: string) {
    let toastContainer =
      document.querySelector<HTMLDivElement>(".toast-container");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.classList.add("toast-container");
      toastContainer.style.display = "flex";
      toastContainer.style.width = "100%";
      toastContainer.style.justifyContent = "center";
      toastContainer.style.position = "fixed";
      toastContainer.style.bottom = "20px";
      toastContainer.style.zIndex = "9999";
      toastContainer.style.background = "transparent";
      document.body.appendChild(toastContainer);
    }

    // prevent multiple toasts at the same time
    const oldToast = document.querySelector(".custom-toast");
    if (oldToast) oldToast.remove();
    const toast = document.createElement("div");
    toast.classList.add("custom-toast");
    toast.style.display = "inline-block";
    toast.style.padding = "8px 12px";
    toast.style.borderRadius = "6px";
    toast.style.color = "white";
    toast.style.background = "#111";
    toast.style.fontSize = "16px";
    toast.style.textAlign = "left";
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  sendMessage(message: ChromeMessage) {
    chrome.runtime.sendMessage<ChromeMessage, void>(message);
  }
}

if (process.env.NODE_ENV !== "test") {
  const solace = new Solace();
  solace.init();
}
