import solace from "solclientjs";

export type SolaceStorage = {
  host: string;
  vpn: string;
  username: string;
  password: string;
};

export enum Sender {
  SOLACE,
  BACKGROUND,
  POPUP,
  CONFIG,
}

export type Message = {
  from: Sender;
  to: Sender;
  message: string;
  type: "info" | "error";
};

export class Solace {
  port: chrome.runtime.Port;

  constructor() {
    this.port = chrome.runtime.connect({ name: "solace" });
    this.extractConfigration();
  }

  async extractConfigration() {
    let storage = await chrome.storage.local.get();
    let filteredStorage = Object.entries(storage).filter(([key, _value]) =>
      key.startsWith("solaceQueueViewerExtension.")
    );
    let itemsCasted = {} as SolaceStorage;
    filteredStorage.forEach(([key, value]) => {
      key = key.split(".")[2];
      if (
        key === "host" ||
        key === "vpn" ||
        key === "username" ||
        key === "password"
      ) {
        itemsCasted[key] = value;
      }
    });
    if (
      itemsCasted.host == null ||
      itemsCasted.vpn == null ||
      itemsCasted.username == null ||
      itemsCasted.password == null
    ) {
      this.sendMessage(
        "The properties inside of local storage seem to be incomplete.",
        Sender.POPUP,
        false
      );
      return;
    }

    this.initSession(itemsCasted);
  }

  async initSession(config: SolaceStorage) {
    let properties = new solace.SolclientFactoryProperties();
    properties.profile = solace.SolclientFactoryProfiles.version10_5;
    solace.SolclientFactory.init(properties);
    let session = solace.SolclientFactory.createSession({
      url: config.host,
      vpnName: config.vpn,
      userName: config.username,
      password: config.password,
      reconnectRetries: 0,
      connectRetries: 0,
    });

    session.connect();
    session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, () => {
      this.sendMessage(
        "Connection failed! Maybe the credentials you entered were wrong.",
        Sender.POPUP,
        false
      );
    });

    session.on(solace.SessionEventCode.UP_NOTICE, () => {
      this.sendMessage("Connection established!");
    });
  }

  private sendMessage(
    message: string,
    to: Sender.BACKGROUND | Sender.POPUP = Sender.POPUP,
    infoMessage = true
  ) {
    if (infoMessage) {
      this.port.postMessage({
        from: Sender.SOLACE,
        to,
        message,
        type: "info",
      } as Message);
    } else {
      this.port.postMessage({
        from: Sender.SOLACE,
        to,
        message,
        type: "error",
      } as Message);
    }
  }
}

new Solace();
