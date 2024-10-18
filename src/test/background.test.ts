import { Background } from "../scripts/background";
import { ChromeMessageType, MessageConstant } from "../scripts/types";
import {
  spyOn,
  describe,
  beforeEach,
  afterEach,
  mock,
  test,
  expect,
  type Mock,
} from "bun:test";
import { chrome } from "./bunTestChrome";

describe("Background", () => {
  let background: Background;
  let chromeTabsOnUpdatedAddListenerMock: Mock<any>;
  let eventFunction: Function;

  beforeEach(() => {
    chromeTabsOnUpdatedAddListenerMock = spyOn(
      chrome.tabs.onUpdated,
      "addListener"
    ).mockImplementation((callback: Function) => {
      eventFunction = callback;
    });

    background = new Background();
  });

  afterEach(() => {
    mock.restore();
  });

  test("should create a new Background instance", () => {
    expect(background).toBeDefined();
  });

  test("should add listeners and send wrong url to solace", async () => {
    let tab = {
      url: "https://youtube.com",
      id: 1,
    } as chrome.tabs.Tab;
    spyOn(chrome.tabs, "query").mockImplementation(() =>
      Promise.resolve([tab])
    );
    let sendMessageSpy = spyOn(background, "sendMessage").mockImplementation(
      () => Promise.resolve()
    );

    await eventFunction(1, { status: "complete" }, {});

    expect(chromeTabsOnUpdatedAddListenerMock).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy).toHaveBeenCalledWith(
      1,
      ChromeMessageType.SOLACE,
      MessageConstant.MESSAGES_QUEUED_URL_CHECK_FALSE
    );
  });

  test("should add listeners and send correct url to solace", async () => {
    let tab = {
      url: "https://us-1.messaging.solace.cloud:943/123/endpoints/queues/123/messages",
      id: 1,
    } as chrome.tabs.Tab;
    spyOn(chrome.tabs, "query").mockImplementation(() =>
      Promise.resolve([tab])
    );
    let sendMessageSpy = spyOn(background, "sendMessage").mockImplementation(
      () => Promise.resolve()
    );

    await eventFunction(1, { status: "complete" }, {});

    expect(chromeTabsOnUpdatedAddListenerMock).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy).toHaveBeenCalledWith(
      1,
      ChromeMessageType.SOLACE,
      MessageConstant.MESSAGES_QUEUED_URL_CHECK
    );
  });

  test("should add listeners and send correct url to configExtractor", async () => {
    let tab = {
      url: "https://console.solace.cloud/services/123",
      id: 1,
    } as chrome.tabs.Tab;
    spyOn(chrome.tabs, "query").mockImplementation(() =>
      Promise.resolve([tab])
    );
    let sendMessageSpy = spyOn(background, "sendMessage").mockImplementation(
      () => Promise.resolve()
    );

    await eventFunction(1, { status: "complete" }, {});

    expect(chromeTabsOnUpdatedAddListenerMock).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy).toHaveBeenCalledWith(
      1,
      ChromeMessageType.CONFIG_EXTRACTOR,
      MessageConstant.CONFIG_EXTRACTOR_URL_CHECK
    );
  });

  test("should send message to solace successfully", () => {
    let chromeTabsSendMessageMock = spyOn(
      chrome.tabs,
      "sendMessage"
    ).mockImplementation(() => Promise.resolve());

    background.sendMessage(
      1,
      ChromeMessageType.SOLACE,
      MessageConstant.MESSAGES_QUEUED_URL_CHECK
    );

    expect(chromeTabsSendMessageMock).toHaveBeenCalledTimes(1);
  });

  test("should send message to solace unsuccessfully", () => {
    let chromeTabsSendMessageMock = spyOn(
      chrome.tabs,
      "sendMessage"
    ).mockImplementation(() => Promise.reject());

    background.sendMessage(
      1,
      ChromeMessageType.SOLACE,
      MessageConstant.MESSAGES_QUEUED_URL_CHECK
    );

    expect(chromeTabsSendMessageMock).toHaveBeenCalledTimes(1);
  });

  test("should send message to configExtractor successfully", () => {
    let chromeTabsSendMessageMock = spyOn(
      chrome.tabs,
      "sendMessage"
    ).mockImplementation(() => Promise.resolve());

    background.sendMessage(
      1,
      ChromeMessageType.BACKGROUND,
      MessageConstant.CONFIG_EXTRACTOR_URL_CHECK
    );

    expect(chromeTabsSendMessageMock).toHaveBeenCalledTimes(1);
  });
});
