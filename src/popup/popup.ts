import "@material/web/dialog/dialog";
import "@material/web/divider/divider";
import "@material/web/icon/icon";
import "@material/web/iconbutton/icon-button";
import type { MdIconButton } from "@material/web/iconbutton/icon-button";
import "@material/web/list/list";
import type { MdList } from "@material/web/list/list";
import "@material/web/list/list-item";
import type { MdListItem } from "@material/web/list/list-item";
import "@material/web/tabs/primary-tab";
import "@material/web/tabs/secondary-tab";
import "@material/web/tabs/tabs";
import type { MdTabs } from "@material/web/tabs/tabs";
import "@material/web/textfield/outlined-text-field";
import type { MdOutlinedTextField } from "@material/web/textfield/outlined-text-field";
import type { ChromeMessage, Config, MessageResponse } from "../types";

export class Popup {
  primaryTabs = document.querySelector("md-tabs.primary") as MdTabs;
  secondaryTabs: MdTabs | undefined;
  primaryPanelId: string | null | undefined;
  secondaryPanelId: string | null | undefined;
  primaryRoot!: Document | ShadowRoot;
  secondaryRoot!: MdList | undefined;
  currentPrimaryPanel!: HTMLElement | null;
  currentSecondaryPanel!: HTMLElement | null;
  configs: Config[] = [];
  currentConfig = 0;
  arrowKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];

  async init() {
    this.addListeners();
    await this.getData();
    this.setupCredentialsPanel();
  }

  addListeners() {
    document.addEventListener("DOMContentLoaded", () => {
      this.primaryPanelId =
        this.primaryTabs.activeTab?.getAttribute("aria-controls");
      this.primaryRoot = this.primaryTabs.getRootNode() as
        | Document
        | ShadowRoot;
      this.currentPrimaryPanel = this.primaryRoot.querySelector(
        `#${this.primaryPanelId}`
      );
    });

    this.primaryTabs.addEventListener("change", () => {
      if (this.currentPrimaryPanel) this.currentPrimaryPanel.hidden = true;
      this.primaryPanelId =
        this.primaryTabs.activeTab?.getAttribute("aria-controls");

      if (this.primaryPanelId === "how-to-use-panel") {
        this.secondaryTabs = document.querySelector(
          "md-tabs.secondary"
        ) as MdTabs;
        this.addSecondaryTabsListener();
      }

      this.primaryRoot = this.primaryTabs.getRootNode() as
        | Document
        | ShadowRoot;
      this.currentPrimaryPanel = this.primaryRoot.querySelector(
        `#${this.primaryPanelId}`
      );
      if (this.currentPrimaryPanel) this.currentPrimaryPanel.hidden = false;
    });
  }

  addSecondaryTabsListener() {
    if (!this.secondaryTabs) return;
    this.secondaryPanelId =
      this.secondaryTabs.activeTab?.getAttribute("aria-controls");
    this.secondaryRoot = this.secondaryTabs.parentElement as MdList;
    this.currentSecondaryPanel = this.secondaryRoot.querySelector(
      `#${this.secondaryPanelId}`
    );

    this.secondaryTabs.addEventListener("change", () => {
      if (this.currentSecondaryPanel) this.currentSecondaryPanel.hidden = true;
      this.secondaryPanelId =
        this.secondaryTabs?.activeTab?.getAttribute("aria-controls");
      if (!this.secondaryTabs) return;
      this.secondaryRoot = this.secondaryTabs.parentElement as MdList;
      this.currentSecondaryPanel = this.secondaryRoot.querySelector(
        `#${this.secondaryPanelId}`
      );
      if (this.currentSecondaryPanel) {
        this.currentSecondaryPanel.hidden = false;
      }
    });
  }

  async getData() {
    const response = await chrome.runtime.sendMessage<
      ChromeMessage,
      MessageResponse
    >({ type: "getData" });
    const mdList1 = document.querySelector("#infos-panel md-list") as MdList;
    const lastInfo =
      response.info === "" ? "No info" : `Last info: ${response.info}`;
    const mdListItem1 = document.createElement("md-list-item");
    mdListItem1.textContent = lastInfo;
    mdList1.appendChild(mdListItem1);

    const mdList2 = document.querySelector("#errors-panel md-list") as MdList;
    const lastErrors =
      response.errors.length === 0 ? "No errors" : "Last errors";
    let mdListItem2 = document.createElement("md-list-item");
    mdListItem2.textContent = lastErrors;
    mdList2.appendChild(mdListItem2);
    for (const error of response.errors) {
      mdListItem2 = document.createElement("md-list-item");
      mdListItem2.textContent = error;
      mdList2.appendChild(mdListItem2);
    }

    const items = await chrome.storage.local.get();
    let storage: Config;
    Object.entries(items).forEach(([key, value]) => {
      if (key.includes(".password")) storage = { password: value };
      if (key.includes(".url")) storage.url = value;
      if (key.includes(".userName")) storage.userName = value;
      if (key.includes(".vpn")) {
        storage.vpn = value;
        const parts = key.split(".");
        parts.pop();
        storage.clusterUrl = parts.join(".");
        this.configs.push(storage);
      }
    });
  }

  setupCredentialsPanel() {
    const mdList = document.querySelector("#settings-panel md-list") as MdList;
    const mdListItem = document.createElement("md-list-item");
    mdListItem.classList.add("configurations");
    mdListItem.textContent =
      this.configs.length === 0
        ? "No Configurations"
        : `Configurations (${this.configs.length})`;
    const mdIconButton = document.createElement("md-icon-button");
    const mdIcon = document.createElement("md-icon");
    mdIcon.textContent = "add";
    mdIconButton.appendChild(mdIcon);
    mdIconButton.slot = "end";
    mdIconButton.addEventListener("click", () => {
      if (this.configs.at(-1)?.clusterUrl) {
        this.currentConfig = this.configs.length;
        this.configs.push({});
        mdListItem.textContent = `Configurations (${this.configs.length})`;
        mdListItem.appendChild(mdIconButton);
      }
      this.displayConfiguration();
    });
    mdListItem.appendChild(mdIconButton);
    mdList.appendChild(mdListItem);

    if (this.configs.length === 0) return;
    const config = this.configs[this.currentConfig];
    this.displayConfiguration(
      config.clusterUrl,
      config.url,
      config.password,
      config.userName,
      config.vpn
    );
  }

  displayConfiguration(
    clusterUrl = "",
    connectionUrl = "",
    connectionPassword = "",
    connectionUsername = "",
    connectionVpn = ""
  ) {
    const previousConfiguration = document.querySelector(
      ".current-configuration"
    );
    if (previousConfiguration) previousConfiguration.remove();
    const mdList = document.querySelector("#settings-panel md-list") as MdList;
    const mdListItem = document.createElement("md-list-item");
    mdListItem.classList.add("current-configuration");
    mdListItem.innerHTML = `
    ${
      this.configs.length <= 1
        ? ""
        : `<md-icon-button class="prev-config" slot="start"><md-icon>chevron_left</md-icon></md-icon-button>`
    }
    <md-list style="text-align: center; --md-list-item-bottom-space: 4px; --md-list-item-top-space: 4px">
      <md-list-item>
        <md-outlined-text-field class="cluster-url" label="Solace Cluster URL" type="url" placeholder="https://hello.world:123" value="${clusterUrl}" required style="resize: none; padding-top: 5px; padding-bottom: 3px">
          <md-icon slot="leading-icon" filled style="color: #00c895">circle</md-icon>
        </md-outlined-text-field>
      </md-list-item>
      <md-divider></md-divider>
      <md-list-item>
        <md-outlined-text-field class="connection-url" label="Connection URL" type:"url" placeholder="wss://hello.world:443" value="${connectionUrl}" style="resize: none; padding-top: 5px"></md-outlined-text-field>
      </md-list-item>
      <md-list-item>
        <md-outlined-text-field class="connection-password" label="Connection Password" type:"password" placeholder="password" value="${connectionPassword}" style="resize: none; padding-top: 5px"></md-outlined-text-field>
      </md-list-item>
      <md-list-item>
        <md-outlined-text-field class="connection-username" label="Connection Username" placeholder="user" value="${connectionUsername}" style="resize: none; padding-top: 5px"></md-outlined-text-field>
      </md-list-item>
      <md-list-item>
        <md-outlined-text-field class="connection-vpn" label="Connection VPN" placeholder="vpn" value="${connectionVpn}" style="resize: none; padding-top: 5px"></md-outlined-text-field>
      </md-list-item>
      <md-list-item>
        <md-icon-button class="save-button">
          <md-icon>save</md-icon>
        </md-icon-button>
        ${
          clusterUrl
            ? `<md-icon-button class="delete-button"><md-icon>delete</md-icon></md-icon-button>`
            : ""
        }
      </md-list-item>
    </md-list>
    ${
      this.configs.length <= 1
        ? ""
        : `<md-icon-button class="next-config" slot="end"><md-icon>chevron_right</md-icon></md-icon-button>`
    }
    `;
    this.addElementListeners(mdListItem);
    mdList.appendChild(mdListItem);

    // Allow arrow keys to move inside textfield
    const textfields = document.querySelectorAll("md-outlined-text-field");
    textfields.forEach(textfield => {
      textfield.addEventListener("keydown", e => {
        if (this.arrowKeys.includes(e.key)) {
          e.stopPropagation();
        }
      });
    });
  }

  addElementListeners(mdListItem: MdListItem) {
    const prevButton = mdListItem.querySelector<MdIconButton>(".prev-config");
    if (prevButton)
      prevButton.addEventListener("click", () => {
        this.currentConfig =
          this.currentConfig === 0
            ? this.configs.length - 1
            : this.currentConfig - 1;
        const config = this.configs[this.currentConfig];
        this.displayConfiguration(
          config.clusterUrl,
          config.url,
          config.password,
          config.userName,
          config.vpn
        );
      });
    const nextButton = mdListItem.querySelector<MdIconButton>(".next-config");
    if (nextButton)
      nextButton.addEventListener("click", () => {
        this.currentConfig = (this.currentConfig + 1) % this.configs.length;
        const config = this.configs[this.currentConfig];
        this.displayConfiguration(
          config.clusterUrl,
          config.url,
          config.password,
          config.userName,
          config.vpn
        );
      });
    const clusterUrlTextField = mdListItem.querySelector(
      ".cluster-url"
    ) as MdOutlinedTextField;
    clusterUrlTextField.addEventListener(
      "input",
      clusterUrlTextField.reportValidity
    );
    const saveButton = mdListItem.querySelector(".save-button") as MdIconButton;
    saveButton.addEventListener("click", () => this.saveConfiguration());
    const deleteButton = mdListItem.querySelector(".delete-button");
    deleteButton?.addEventListener("click", () => this.deleteConfiguration());
  }

  async saveConfiguration() {
    // TODO validate by connecting to solace
    const clusterUrl = document.querySelector(
      ".cluster-url"
    ) as MdOutlinedTextField;
    const connectionUrl = document.querySelector(
      ".connection-url"
    ) as MdOutlinedTextField;
    const connectionPassword = document.querySelector(
      ".connection-password"
    ) as MdOutlinedTextField;
    const connectionUsername = document.querySelector(
      ".connection-username"
    ) as MdOutlinedTextField;
    const connectionVpn = document.querySelector(
      ".connection-vpn"
    ) as MdOutlinedTextField;
    if (!clusterUrl.reportValidity()) return;
    if (!connectionUrl.reportValidity()) return;
    const clusterUrlValue = clusterUrl.value;
    const connectionUrlValue = connectionUrl.value;
    const connectionPasswordValue = connectionPassword.value;
    const connectionUsernameValue = connectionUsername.value;
    const connectionVpnValue = connectionVpn.value;
    this.configs[this.currentConfig] = {
      clusterUrl: clusterUrlValue,
      url: connectionUrlValue,
      password: connectionPasswordValue,
      userName: connectionUsernameValue,
      vpn: connectionVpnValue,
    };
    const clusterUrls = await chrome.storage.local.get("clusterUrls");
    const clusterUrlsSet = new Set(clusterUrls.clusterUrls);
    clusterUrlsSet.add(clusterUrlValue);
    await chrome.storage.local.set({ clusterUrls: Array.from(clusterUrlsSet) });
    await chrome.storage.local.set({
      [`${clusterUrlValue}.password`]: connectionPasswordValue,
      [`${clusterUrlValue}.url`]: connectionUrlValue,
      [`${clusterUrlValue}.userName`]: connectionUsernameValue,
      [`${clusterUrlValue}.vpn`]: connectionVpnValue,
    });
    this.displayConfiguration(
      clusterUrlValue,
      connectionUrlValue,
      connectionPasswordValue,
      connectionUsernameValue,
      connectionVpnValue
    );
  }

  async deleteConfiguration() {
    // Delete the current configuration
    const deletedConfig = this.configs.splice(this.currentConfig, 1);
    const deletedUrl = deletedConfig[0].clusterUrl;

    // Delete entry from storage cluster url list
    const clusterUrls = await chrome.storage.local.get("clusterUrls");
    const clusterUrlsSet = new Set(clusterUrls.clusterUrls);
    clusterUrlsSet.delete(deletedUrl);
    await chrome.storage.local.set({ clusterUrls: Array.from(clusterUrlsSet) });

    // Delete actual configuration from storage
    await chrome.storage.local.remove([
      `${deletedUrl}.password`,
      `${deletedUrl}.url`,
      `${deletedUrl}.userName`,
      `${deletedUrl}.vpn`,
    ]);

    // Show correct configuration and configurations amount
    if (this.configs.length === 0) {
      this.currentConfig = 0;
      this.displayConfiguration();
      return;
    }

    if (this.currentConfig === this.configs.length) {
      this.currentConfig--;
    }

    const configurations = document.querySelector(
      ".configurations"
    ) as MdListItem;
    configurations.textContent = `Configurations (${this.configs.length})`;

    const currentConfig = this.configs[this.currentConfig];
    this.displayConfiguration(
      currentConfig.clusterUrl,
      currentConfig.url,
      currentConfig.password,
      currentConfig.userName,
      currentConfig.vpn
    );
  }
}

if (process.env.NODE_ENV !== "test") {
  const popup = new Popup();
  popup.init();
}
