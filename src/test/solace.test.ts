import {
  ChromeMessage,
  ChromeMessageType,
  MessageConstant,
} from "../scripts/types";
import { chrome } from "jest-chrome";
import { vi as jest } from "vitest";
import { Solace } from "../scripts/solace";

describe("Solace", () => {
  let solace: Solace;

  beforeEach(() => {
    // clearListeners is required here, because the manifest gets executed and so an instance of solace is started, but without having a reference to it
    chrome.runtime.onMessage.clearListeners();
    solace = new Solace();
  });

  it("should create a new Solace instance", () => {
    expect(solace).toBeDefined();
  });

  it("should turn buttonsInserted to false on invalid url", () => {
    let message = {
      to: ChromeMessageType.SOLACE,
      from: ChromeMessageType.BACKGROUND,
      message: MessageConstant.MESSAGES_QUEUED_URL_CHECK_FALSE,
    } as ChromeMessage;

    solace.buttonsInserted = true;
    expect(solace.buttonsInserted).toBeTruthy();
    chrome.runtime.onMessage.callListeners(message, {}, () => {});
    expect(solace.buttonsInserted).toBeFalsy();
  });

  it("should execute insertPlayButton method on valid url", () => {
    let message = {
      to: ChromeMessageType.SOLACE,
      from: ChromeMessageType.BACKGROUND,
      message: MessageConstant.MESSAGES_QUEUED_URL_CHECK,
    } as ChromeMessage;

    let insertPlayButtonMethod = jest
      .spyOn(solace, "insertPlayButton")
      .mockImplementation(() => Promise.resolve());
    chrome.runtime.onMessage.callListeners(message, {}, () => {});
    expect(insertPlayButtonMethod).toHaveBeenCalledTimes(1);
  });

  it("should execute loadConfig method on click event", () => {
    let loadConfigMethod = jest
      .spyOn(solace, "loadConfig")
      .mockImplementation(() => Promise.resolve());
    document.body.click();
    expect(loadConfigMethod).toHaveBeenCalledTimes(1);
  });

  it("should execute loadConfig without doing anything", () => {
    solace.configLoaded = true;
    solace.loadConfig();
    expect(solace.configLoaded).toBeTruthy();
  });

  it("should execute loadConfig and set solaceConfig", async () => {
    expect(solace.solaceConfig).toBeUndefined();
    let div = document.createElement("div");
    div.innerText = "test";
    jest.spyOn(document, "querySelector").mockReturnValue(div);

    let obj = {
      "solaceQueueViewerExtension.test.host": "host",
      "solaceQueueViewerExtension.test.password": "password",
      "solaceQueueViewerExtension.test.vpn": "vpn",
      "solaceQueueViewerExtension.test.username": "username",
    };

    jest.spyOn(chrome.storage.local, "get").mockImplementation((_keys) => {
      return obj;
    });

    await solace.loadConfig();
    expect(solace.solaceConfig).toBeDefined();
    expect(solace.solaceConfig.host).toEqual("host");
    expect(solace.solaceConfig.password).toEqual("password");
    expect(solace.solaceConfig.vpn).toEqual("vpn");
    expect(solace.solaceConfig.username).toEqual("username");
    expect(solace.configLoaded).toBeTruthy();
  });

  it("should execute insertPlayButton and do nothing", () => {
    solace.buttonsInserted = true;
    solace.insertPlayButton();
    expect(solace.buttonsInserted).toBeTruthy();
  });

  it("should execute insertPlayButton and insert buttons, no action yet", () => {
    let button = document.createElement("button");
    let i = document.createElement("i");
    let createElementMock = jest.spyOn(document, "createElement");
    createElementMock.mockImplementation((tagName) => {
      if (tagName === "button") {
        return button;
      }

      return i;
    });

    createElementMock.mockRestore();
    let actionPanel = document.createElement("ul");
    jest.spyOn(document, "querySelector").mockReturnValue(actionPanel);

    jest.useFakeTimers();
    solace.insertPlayButton();
    jest.runAllTimers();
    jest.useRealTimers();

    let resultButton = actionPanel.lastElementChild as HTMLButtonElement;
    expect(resultButton.nodeName).toEqual(button.nodeName);
    expect(getComputedStyle(resultButton).margin).toEqual("0px 5px 1px 5px");
    expect(getComputedStyle(resultButton).color).toEqual("rgb(0, 200, 149)");
    let iElem = resultButton.firstElementChild as HTMLElement;
    expect(iElem.classList.contains("material-icons")).toBeTruthy();
    expect(iElem.innerText).toEqual("play_arrow");
    expect(solace.buttonsInserted).toBeTruthy();
  });

  it("should execute insertPlayButton and insert buttons with click event two times", () => {
    let button = document.createElement("button");
    let i = document.createElement("i");
    let createElementMock = jest.spyOn(document, "createElement");
    createElementMock.mockImplementation((tagName) => {
      if (tagName === "button") {
        return button;
      }

      return i;
    });

    let establishConnectionMock = jest
      .spyOn(solace, "establishConnection")
      .mockImplementation(() => Promise.resolve());

    jest.useFakeTimers();
    solace.insertPlayButton();
    jest.runAllTimers();
    jest.useRealTimers();

    button.click();
    expect(i.innerText).toEqual("stop");
    expect(establishConnectionMock).toHaveBeenCalledTimes(1);

    let disconnectMock = jest
      .spyOn(solace, "disconnect")
      .mockImplementation(() => Promise.resolve());
    button.click();
    expect(i.innerText).toEqual("play_arrow");
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});
