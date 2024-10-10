import {
  type ChromeMessage,
  ChromeMessageType,
  MessageConstant,
} from "./types";

export class ConfigExtractor {
  connectLoaded = false;
  manageLoaded = false;
  currentTab!: HTMLAnchorElement;
  prefix = "solaceQueueViewerExtension.";
  clusterValue!: string;

  constructor() {
    this.addListeners();
  }

  addListeners() {
    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
      let messageTyped = message as ChromeMessage;
      if (messageTyped.to !== ChromeMessageType.CONFIG_EXTRACTOR) return;
      if (messageTyped.message == MessageConstant.CONFIG_EXTRACTOR_URL_CHECK) {
        this.connectLoaded = false;
        if (document.body.getAttribute("click-listener") !== "true") {
          document.body.setAttribute("click-listener", "true");
          document.body.addEventListener("click", async () => {
            let cluster = document.querySelector<HTMLSpanElement>(
              "span[data-qa='solace-header-title']"
            );
            if (cluster == null) {
              this.sendMessage(
                ChromeMessageType.BACKGROUND,
                MessageConstant.CLUSTER_NOT_EXTRACTED
              );
              return;
            }

            this.clusterValue = cluster.innerText.trim();
            let credentials = await chrome.storage.local.get();
            if (credentials[`${this.prefix}${this.clusterValue}.host`]) {
              return;
            }

            this.connectContentLoader();
          });
        }
      } else if (
        messageTyped.message ==
        MessageConstant.CONFIG_EXTRACTOR_CONNECT_PAGE_LOADED
      ) {
        this.interactWithConnectPage();
      }
    });
  }

  async connectContentLoader() {
    if (!this.connectLoaded) {
      this.connectLoaded = true;
      let currentTab = document.querySelector<HTMLAnchorElement>(
        "a[role='tab'][aria-selected='true']"
      );
      if (currentTab == null) {
        this.sendMessage(
          ChromeMessageType.BACKGROUND,
          MessageConstant.CONFIG_EXTRACTOR_WEB_PAGE_NOT_LOADED
        );
        return;
      }

      this.currentTab = currentTab;
      let connect = document
        .querySelectorAll<HTMLAnchorElement>("a[role='tab']")
        .item(1);
      if (connect == null) {
        this.sendMessage(
          ChromeMessageType.BACKGROUND,
          MessageConstant.CONFIG_EXTRACTOR_WEB_PAGE_NOT_LOADED
        );
        return;
      }

      connect.click();
    }
  }

  interactWithConnectPage() {
    let nodejsPanel = document.querySelector<HTMLDivElement>("div#nodejs div");
    if (nodejsPanel == null) {
      this.sendMessage(
        ChromeMessageType.BACKGROUND,
        MessageConstant.CONFIG_EXTRACTOR_WEB_PAGE_NOT_LOADED
      );
      return;
    }
    nodejsPanel.click();

    let credentialPanel = document.querySelector<HTMLButtonElement>(
      "div[data-qa='libraries-row-solaceNodeJSAPI'] div:last-child button"
    );
    if (credentialPanel == null) {
      this.sendMessage(
        ChromeMessageType.BACKGROUND,
        MessageConstant.CONFIG_EXTRACTOR_WEB_PAGE_NOT_LOADED
      );
      return;
    }

    credentialPanel.click();
    this.extractConfig();
  }

  async extractConfig() {
    let host = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        "div#drawer-container div div div:last-child div button"
      )
    ).filter((btn) =>
      btn.parentElement?.innerText.includes("messaging.solace.cloud")
    )[0].parentElement;
    if (host == null) {
      this.sendMessage(
        ChromeMessageType.BACKGROUND,
        MessageConstant.HOST_NOT_EXTRACTED
      );
      return;
    }

    let hostValue = host.innerText.trim();
    let vpn = document.querySelector<HTMLDivElement>(
      "div#drawer-container div div div:last-child div div div:nth-child(3) div:last-child div"
    );
    if (vpn == null) {
      this.sendMessage(
        ChromeMessageType.BACKGROUND,
        MessageConstant.VPN_NOT_EXTRACTED
      );
      return;
    }

    let vpnValue = vpn.innerText.trim();
    let username = document.querySelector<HTMLDivElement>(
      "div#drawer-container div div div:last-child div div div:nth-child(1) div:last-child div"
    );
    if (username == null) {
      this.sendMessage(
        ChromeMessageType.BACKGROUND,
        MessageConstant.USERNAME_NOT_EXTRACTED
      );
      return;
    }

    let usernameValue = username.innerText.trim();
    let password = document.querySelector<HTMLDivElement>(
      "div#drawer-container div div div:last-child div div div:nth-child(2) div:last-child div"
    );
    if (password == null) {
      this.sendMessage(
        ChromeMessageType.BACKGROUND,
        MessageConstant.PASSWORD_NOT_EXTRACTED
      );
      return;
    }

    password.querySelector<HTMLButtonElement>("button")?.click();
    let passwordValue = password.innerText.trim();
    console.log(this.currentTab);
    // TODO check if switching back works
    this.currentTab.click();
    let prefix = "solaceQueueViewerExtension";
    let hostKey = `${prefix}.${this.clusterValue}.host`;
    let vpnKey = `${prefix}.${this.clusterValue}.vpn`;
    let usernameKey = `${prefix}.${this.clusterValue}.username`;
    let passwordKey = `${prefix}.${this.clusterValue}.password`;

    await chrome.storage.local.set({
      [hostKey]: hostValue,
      [vpnKey]: vpnValue,
      [usernameKey]: usernameValue,
      [passwordKey]: passwordValue,
    });
  }

  async sendMessage(to: ChromeMessageType, message: MessageConstant) {
    chrome.runtime
      .sendMessage({
        from: ChromeMessageType.CONFIG_EXTRACTOR,
        to,
        message,
      } as ChromeMessage)
      .catch(() => {});
  }
}

new ConfigExtractor();
