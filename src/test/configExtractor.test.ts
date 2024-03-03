import { ConfigExtractor } from "../scripts/configExtractor";
import { vi as jest } from "vitest";
import { chrome } from "jest-chrome";
import {
  ChromeMessage,
  ChromeMessageType,
  MessageConstant,
} from "../scripts/types";

describe("ConfigExtractor", () => {
  let configExtractor: ConfigExtractor;

  beforeEach(() => {
    configExtractor = new ConfigExtractor();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create a new ConfigExtractor instance", () => {
    expect(configExtractor).toBeDefined();
  });

  it("should initialize and add event listener on body", () => {
    let message = {
      to: ChromeMessageType.SOLACE,
      message: MessageConstant.CONFIG_EXTRACTOR_URL_CHECK,
      from: ChromeMessageType.BACKGROUND,
    } as ChromeMessage;
    configExtractor.connectLoaded = true;
    chrome.runtime.onMessage.callListeners(message, {}, () => {});

    expect(configExtractor.connectLoaded).toBeFalsy();
    expect(document.body.getAttribute("click-listener")).toEqual("true");
  });

  it("should initialize and execute click listener on body", () => {
    let message = {
      to: ChromeMessageType.SOLACE,
      message: MessageConstant.CONFIG_EXTRACTOR_URL_CHECK,
      from: ChromeMessageType.BACKGROUND,
    } as ChromeMessage;
    configExtractor.connectLoaded = true;
    // this needs to be the object and not the instance, because the scope of the addListener function seems to make some problems
    let connectContentLoaderMock = jest
      .spyOn(ConfigExtractor.prototype, "connectContentLoader")
      .mockImplementation(() => {});
    chrome.runtime.onMessage.callListeners(message, {}, () => {});

    document.body.click();

    expect(configExtractor.connectLoaded).toBeFalsy();
    expect(document.body.getAttribute("click-listener")).toEqual("true");
    expect(connectContentLoaderMock).toHaveBeenCalledTimes(1);
  });

  it("should execute connectContentLoader without doing anything", () => {
    configExtractor.connectLoaded = true;

    configExtractor.connectContentLoader();

    expect(configExtractor.connectLoaded).toBeTruthy();
  });

  it("should execute connectContentLoader and page is not loaded yet", () => {
    let currentTab = document.createElement("a");
    let connect: any = null;

    jest.spyOn(document, "querySelector").mockImplementation((selector) => {
      if (
        selector ===
        "li.au-target.tab.primary-text.waves-effect.waves-primary a.active"
      ) {
        return currentTab;
      } else if (selector === "#connectivity-tab-toggle") {
        return connect;
      }
    });

    let error = "";
    let logMock = jest
      .spyOn(console, "error")
      .mockImplementation((consoleError) => (error = consoleError));

    configExtractor.connectContentLoader();

    expect(error).toEqual("Web page was not fully loaded yet");
    expect(logMock).toHaveBeenCalledTimes(1);
  });

  it("should execute connectContentLoader and load settings page", () => {
    let currentTab = document.createElement("a");
    let connect = document.createElement("a");

    jest.spyOn(document, "querySelector").mockImplementation((selector) => {
      if (
        selector ===
        "li.au-target.tab.primary-text.waves-effect.waves-primary a.active"
      ) {
        return currentTab;
      } else {
        return connect;
      }
    });

    let extractConfigMock = jest
      .spyOn(configExtractor, "extractConfig")
      .mockImplementation(() => Promise.resolve());

    configExtractor.connectContentLoader();

    expect(extractConfigMock).toHaveBeenCalledTimes(1);
  });

  it("should exeucte extractConfig and set local storage", async () => {
    let cluster = document.createElement("h1");
    cluster.innerText = "test  ";
    let host = document.createElement("div");
    host.innerText = "host";
    let vpn = document.createElement("div");
    vpn.innerText = "vpn";
    let username = document.createElement("div");
    username.innerText = "username";
    let password = document.createElement("div");
    password.innerText = "password";

    let querySelectorMock = jest
      .spyOn(document, "querySelector")
      .mockImplementation((selector) => {
        if (selector === "#name-field") {
          return cluster;
        } else if (
          selector === "#secured-web-messaging-host div div:nth-child(2)"
        ) {
          return host;
        } else if (selector === "#web-messaging-message-vpn div") {
          return vpn;
        } else if (selector === "#web-messaging-username div") {
          return username;
        } else {
          return password;
        }
      });

    let data;
    let localStorageSetMock = jest
      .spyOn(chrome.storage.local, "set")
      .mockImplementation((store) => {
        data = store;
      });

    await configExtractor.extractConfig();

    expect(querySelectorMock).toHaveBeenCalledTimes(5);
    expect(localStorageSetMock).toHaveBeenCalledTimes(1);
    expect(data).toEqual({
      "solaceQueueViewerExtension.test.host": "host",
      "solaceQueueViewerExtension.test.vpn": "vpn",
      "solaceQueueViewerExtension.test.username": "username",
      "solaceQueueViewerExtension.test.password": "password",
    });
  });
});
