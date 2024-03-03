import { ChromeMessage, ChromeMessageType, MessageConstant } from "./types";

export class ConfigExtractor {
  connectLoaded = false;
  manageLoaded = false;

  constructor() {
    this.addListeners();
  }

  addListeners() {
    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
      let messageTyped = message as ChromeMessage;
      if (messageTyped.to !== ChromeMessageType.SOLACE) return;
      if (messageTyped.message == MessageConstant.CONFIG_EXTRACTOR_URL_CHECK) {
        this.connectLoaded = false;
        if (document.body.getAttribute("click-listener") !== "true") {
          document.body.setAttribute("click-listener", "true");
          document.body.addEventListener("click", () => {
            this.connectContentLoader();
          });
        }
      }
    });
  }

  connectContentLoader() {
    if (!this.connectLoaded) {
      this.connectLoaded = true;
      let currentTab = document.querySelector<HTMLAnchorElement>(
        "li.au-target.tab.primary-text.waves-effect.waves-primary a.active"
      );
      if (currentTab == null || currentTab.innerText === "Connect") return;
      let connect = document.querySelector<HTMLAnchorElement>(
        "#connectivity-tab-toggle"
      );

      if (connect == null) {
        console.error("Web page was not fully loaded yet");
        return;
      }

      connect.click();
      currentTab.click();
      this.extractConfig();
    }
  }

  async extractConfig() {
    let cluster = document.querySelector<HTMLHeadingElement>("#name-field");
    if (cluster == null) return;
    let clusterValue = cluster.innerText.trim();

    let host = document.querySelector<HTMLDivElement>(
      "#secured-web-messaging-host div div:nth-child(2)"
    );
    if (host == null) return;
    let hostValue = host.innerText.trim();

    let vpn = document.querySelector<HTMLDivElement>(
      "#web-messaging-message-vpn div"
    );
    if (vpn == null) return;
    let vpnValue = vpn.innerText.trim();

    let username = document.querySelector<HTMLDivElement>(
      "#web-messaging-username div"
    );
    if (username == null) return;
    let usernameValue = username.innerText.trim();

    let password = document.querySelector<HTMLDivElement>(
      "#web-messaging-password div"
    );
    if (password == null) return;
    let passwordValue = password.innerText.trim();

    let prefix = "solaceQueueViewerExtension";
    let hostKey = `${prefix}.${clusterValue}.host`;
    let vpnKey = `${prefix}.${clusterValue}.vpn`;
    let usernameKey = `${prefix}.${clusterValue}.username`;
    let passwordKey = `${prefix}.${clusterValue}.password`;

    await chrome.storage.local.set({
      [hostKey]: hostValue,
      [vpnKey]: vpnValue,
      [usernameKey]: usernameValue,
      [passwordKey]: passwordValue,
    });
  }
}

new ConfigExtractor();
