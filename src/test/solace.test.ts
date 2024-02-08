import { Solace } from "../scripts/solace";
import {
  ChromeMessage,
  ChromeMessageType,
  MessageConstant,
} from "../scripts/types";
import { chrome } from "jest-chrome";
import { vi as jest } from "vitest";

describe("Solace", () => {
  it("should create a new Solace instance", () => {
    let solace = new Solace();
    expect(solace).toBeDefined();
  });

  it("should turn buttonsInserted to false on invalid url", () => {
    let message = {
      to: ChromeMessageType.SOLACE,
      from: ChromeMessageType.BACKGROUND,
      message: MessageConstant.MESSAGES_QUEUED_URL_CHECK_FALSE,
    } as ChromeMessage;

    let solace = new Solace();
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

    let solace = new Solace();
    let insertPlayButtonMethod = jest.spyOn(solace, "insertPlayButton");
    chrome.runtime.onMessage.callListeners(message, {}, () => {});
    expect(insertPlayButtonMethod).toHaveBeenCalled();
  });
});
