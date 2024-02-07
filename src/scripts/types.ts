export enum MessageConstant {
  MESSAGES_QUEUED_URL_CHECK,
  MESSAGES_QUEUED_URL_CHECK_FALSE,
}

export enum ChromeMessageType {
  SOLACE,
  BACKGROUND,
}

export type ChromeMessage = {
  from: ChromeMessageType;
  to: ChromeMessageType;
  message: MessageConstant;
};
