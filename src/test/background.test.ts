import { Background } from "../scripts/background";
import { MockInstance, vi as jest } from "vitest";
import { ChromeMessageType, MessageConstant } from "../scripts/types";

describe("Background", () => {
  let background: Background;
  let chromeTabsOnUpdatedAddListenerMock: MockInstance;
  let eventFunction: Function;

  beforeEach(() => {
    chromeTabsOnUpdatedAddListenerMock = jest
      .spyOn(chrome.tabs.onUpdated, "addListener")
      .mockImplementation((callback) => {
        eventFunction = callback;
      });

    background = new Background();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should create a new Background instance", () => {
    expect(background).toBeDefined();
  });

  it("should add listeners and send wrong url to solace", async () => {
    let tab = {
      url: "https://youtube.com",
      id: 1,
    } as chrome.tabs.Tab;
    jest.spyOn(chrome.tabs, "query").mockResolvedValue([tab]);
    let sendMessageSpy = jest
      .spyOn(background, "sendMessage")
      .mockImplementation(() => Promise.resolve());

    await eventFunction(1, { status: "complete" }, {});

    expect(chromeTabsOnUpdatedAddListenerMock).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy).toHaveBeenCalledWith(
      1,
      ChromeMessageType.SOLACE,
      MessageConstant.MESSAGES_QUEUED_URL_CHECK_FALSE
    );
  });

  it("should add listeners and send correct url to solace", async () => {
    let tab = {
      url: "https://us-1.messaging.solace.cloud:943/123/endpoints/queues/123/messages",
      id: 1,
    } as chrome.tabs.Tab;
    jest.spyOn(chrome.tabs, "query").mockResolvedValue([tab]);
    let sendMessageSpy = jest
      .spyOn(background, "sendMessage")
      .mockImplementation(() => Promise.resolve());

    await eventFunction(1, { status: "complete" }, {});

    expect(chromeTabsOnUpdatedAddListenerMock).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy).toHaveBeenCalledWith(
      1,
      ChromeMessageType.SOLACE,
      MessageConstant.MESSAGES_QUEUED_URL_CHECK
    );
  });

  it("should add listeners and send correct url to configExtractor", async () => {
    let tab = {
      url: "https://console.solace.cloud/services/123",
      id: 1,
    } as chrome.tabs.Tab;
    jest.spyOn(chrome.tabs, "query").mockResolvedValue([tab]);
    let sendMessageSpy = jest
      .spyOn(background, "sendMessage")
      .mockImplementation(() => Promise.resolve());

    await eventFunction(1, { status: "complete" }, {});

    expect(chromeTabsOnUpdatedAddListenerMock).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy).toHaveBeenCalledWith(
      1,
      ChromeMessageType.SOLACE,
      MessageConstant.CONFIG_EXTRACTOR_URL_CHECK
    );
  });

  it("should send message to solace successfully", () => {
    let chromeTabsSendMessageMock = jest
      .spyOn(chrome.tabs, "sendMessage")
      .mockImplementation(() => Promise.resolve());

    background.sendMessage(
      1,
      ChromeMessageType.SOLACE,
      MessageConstant.MESSAGES_QUEUED_URL_CHECK
    );

    expect(chromeTabsSendMessageMock).toHaveBeenCalledTimes(1);
  });

  it("should send message to solace unsuccessfully", () => {
    let chromeTabsSendMessageMock = jest
      .spyOn(chrome.tabs, "sendMessage")
      .mockImplementation(() => Promise.reject());

    background.sendMessage(
      1,
      ChromeMessageType.SOLACE,
      MessageConstant.MESSAGES_QUEUED_URL_CHECK
    );

    expect(chromeTabsSendMessageMock).toHaveBeenCalledTimes(1);
  });

  it("should send message to configExtractor successfully", () => {
    let chromeTabsSendMessageMock = jest
      .spyOn(chrome.tabs, "sendMessage")
      .mockImplementation(() => Promise.resolve());

    background.sendMessage(
      1,
      ChromeMessageType.BACKGROUND,
      MessageConstant.CONFIG_EXTRACTOR_URL_CHECK
    );

    expect(chromeTabsSendMessageMock).toHaveBeenCalledTimes(1);
  });
});
