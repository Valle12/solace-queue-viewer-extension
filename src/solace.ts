import {
  LogLevel,
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
import type { ChromeMessage } from "./types";

export class Solace {
  password = "";
  url = "";
  userName = "";
  vpnName = "";
  session: Session | undefined = undefined;
  queueBrowser: QueueBrowser | undefined = undefined;

  constructor() {
    this.addListeners();
    this.init();
    this.loadCredentials("blablabla"); // TODO remove explicit call and hardcoded value
    //this.createSession(); // TODO Remove with call from outside
  }

  addListeners() {
    window.addEventListener("load", event => {
      console.log("Page loaded", event); // TODO only call if on specific page
    });
  }

  init() {
    const properties = new SolclientFactoryProperties();
    properties.profile = SolclientFactoryProfiles.version10_5;
    properties.logLevel = LogLevel.WARN;
    SolclientFactory.init(properties);
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
    this.vpnName = result[`${clusterName}.vpnName`];

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
    // TODO handle possible error thrown by createSession
    this.session = SolclientFactory.createSession({
      password: this.password,
      url: this.url,
      userName: this.userName,
      vpnName: this.vpnName,
    });

    this.session.on(SessionEventCode.UP_NOTICE, () => {
      this.sendMessage({
        type: "sendInfo",
        content: "Successful session connection",
      });

      this.createQueueBrowser();
    });

    this.session.on(SessionEventCode.DISCONNECTED, () => {
      this.sendMessage({
        type: "sendInfo",
        content: "Session disconnected",
      });

      // TODO implements logic to handle disconnection
    });

    this.session.connect();
  }

  createQueueBrowser() {
    if (!this.session) {
      this.sendMessage({
        type: "sendError",
        content: `[${new Date().toLocaleTimeString()}] Session not created yet, should not have happened`,
      });

      return;
    }

    const queueDescriptor = new QueueDescriptor({
      type: QueueType.QUEUE,
      name: "queueName", // TODO remove hardcoded value
    });

    this.queueBrowser = this.session.createQueueBrowser({
      queueDescriptor,
    });

    this.queueBrowser.on(QueueBrowserEventName.UP, () => {
      console.log("QueueBrowser is up"); // TODO send info log to popup
    });

    this.queueBrowser.on(QueueBrowserEventName.DOWN, () => {
      console.log("QueueBrowser is down"); // TODO send info log to popup
    });

    this.queueBrowser.on(QueueBrowserEventName.MESSAGE, message => {
      console.log(
        "Message received",
        new TextDecoder().decode(message.getBinaryAttachment() as Uint8Array) // TODO decide between UInt8Array and string
      ); // TODO display message on web page
    });

    this.queueBrowser.connect();
  }

  sendMessage(message: ChromeMessage) {
    chrome.runtime.sendMessage<ChromeMessage, void>(message);
  }
}

if (process.env.NODE_ENV !== "test") {
  new Solace();
}
