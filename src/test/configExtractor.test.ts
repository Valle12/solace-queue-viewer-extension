import { ConfigExtractor } from "../scripts/configExtractor";
import {
  type ChromeMessage,
  ChromeMessageType,
  MessageConstant,
} from "../scripts/types";
import {
  describe,
  beforeEach,
  afterEach,
  mock,
  test,
  expect,
  spyOn,
} from "bun:test";
import { chrome } from "./bunTestChrome";

describe("ConfigExtractor", () => {
  let configExtractor: ConfigExtractor;

  beforeEach(() => {
    configExtractor = new ConfigExtractor();
  });

  afterEach(() => {
    mock.restore();
  });

  test("should create a new ConfigExtractor instance", () => {
    expect(configExtractor).toBeDefined();
  });

  test("should initialize and add event listener on body", async () => {
    let message = {
      to: ChromeMessageType.CONFIG_EXTRACTOR,
      message: MessageConstant.CONFIG_EXTRACTOR_URL_CHECK,
      from: ChromeMessageType.BACKGROUND,
    } as ChromeMessage;
    configExtractor.connectLoaded = true;
    chrome.runtime.onMessage.callListeners(message, {}, () => {});

    expect(configExtractor.connectLoaded).toBeFalsy();
    expect(document.body.getAttribute("click-listener")).toEqual("true");
  });

  test("should initialize and execute click listener on body", async () => {
    let message = {
      to: ChromeMessageType.CONFIG_EXTRACTOR,
      message: MessageConstant.CONFIG_EXTRACTOR_URL_CHECK,
      from: ChromeMessageType.BACKGROUND,
    } as ChromeMessage;
    configExtractor.connectLoaded = true;
    // this needs to be the object and not the instance, because the scope of the addListener function seems to make some problems
    let connectContentLoaderMock = spyOn(
      ConfigExtractor.prototype,
      "connectContentLoader"
    ).mockImplementation(() => Promise.resolve());
    spyOn(chrome.storage.local, "get").mockResolvedValue({
      "solaceQueueViewerExtension.test.host": "host",
    });
    const clusterMock = document.createElement("span");
    spyOn(document, "querySelector").mockReturnValue(clusterMock);
    chrome.runtime.onMessage.callListeners(message, {}, () => {});

    document.body.click();

    expect(configExtractor.connectLoaded).toBeFalsy();
    expect(document.body.getAttribute("click-listener")).toEqual("true");
    // Without this line, the test will fail
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(connectContentLoaderMock).toHaveBeenCalledTimes(1);
  });

  test("should execute connectContentLoader without doing anything", () => {
    configExtractor.connectLoaded = true;

    configExtractor.connectContentLoader();

    expect(configExtractor.connectLoaded).toBeTruthy();
  });

  test("should execute connectContentLoader and web page is not loaded yet", () => {
    const sendMessageMock = spyOn(chrome.runtime, "sendMessage");

    configExtractor.connectContentLoader();

    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledWith({
      from: ChromeMessageType.CONFIG_EXTRACTOR,
      to: ChromeMessageType.BACKGROUND,
      message: MessageConstant.CONFIG_EXTRACTOR_WEB_PAGE_NOT_LOADED,
    });
  });

  test("should execute connectContentLoader and connect page is not loaded yet", () => {
    const currentTab = document.createElement("a");
    spyOn(document, "querySelector").mockReturnValue(currentTab);
    const sendMessageMock = spyOn(chrome.runtime, "sendMessage");
    const querySelectorAllMock = spyOn(document, "querySelectorAll");

    configExtractor.connectContentLoader();

    expect(querySelectorAllMock).toHaveBeenCalledTimes(1);
    expect(querySelectorAllMock).toHaveBeenCalledWith("a[role='tab']");
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledWith({
      from: ChromeMessageType.CONFIG_EXTRACTOR,
      to: ChromeMessageType.BACKGROUND,
      message: MessageConstant.CONFIG_EXTRACTOR_WEB_PAGE_NOT_LOADED,
    });
  });

  test("should execute connectContentLoader and load connect page", () => {
    const currentTab = document.createElement("a");
    const connect = document.createElement("a");
    const connectMock = spyOn(connect, "click");
    spyOn(document, "querySelector").mockReturnValue(currentTab);
    const fragment = document.createDocumentFragment();
    fragment.appendChild(currentTab);
    fragment.appendChild(connect);
    const nodeList = fragment.childNodes as NodeListOf<Element>;
    spyOn(document, "querySelectorAll").mockReturnValue(nodeList);

    configExtractor.connectContentLoader();

    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  test.todo("should exeucte extractConfig and set local storage", async () => {
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

    let querySelectorMock = spyOn(document, "querySelector").mockImplementation(
      (selector: string) => {
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
      }
    );

    let data: { [key: string]: string } = {};
    let localStorageSetMock = spyOn(
      chrome.storage.local,
      "set"
    ).mockImplementation((store: { [key: string]: string }) => {
      data = store;
      return Promise.resolve();
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
