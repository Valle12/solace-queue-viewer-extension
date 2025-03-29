import type { ChromeMessage, MessageResponse } from "./types";

const amountErrors = 5;

let lastInfo = "-";
let lastErrors: string[] = [];

chrome.webNavigation.onCompleted.addListener(details => {
  console.log("Page completed loading", details); // TODO remove this line
});

chrome.runtime.onMessage.addListener((tmpMsg, _sender, tmpSendResponse) => {
  const msg = tmpMsg as ChromeMessage;
  const sendResponse = tmpSendResponse as (response: MessageResponse) => void;

  if (msg.type === "sendInfo") {
    lastInfo = msg.content;
  } else if (msg.type === "sendError") {
    lastErrors.unshift(msg.content);
    if (lastErrors.length > amountErrors) lastErrors.pop();
  } else if (msg.type === "getData") {
    sendResponse({
      info: lastInfo,
      errors: lastErrors,
    });
  }
});
