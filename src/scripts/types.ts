export enum MessageConstant {
  MESSAGES_QUEUED_URL_CHECK,
  MESSAGES_QUEUED_URL_CHECK_FALSE,
  CONFIG_EXTRACTOR_URL_CHECK,
  CONFIG_EXTRACTOR_WEB_PAGE_NOT_LOADED,
  POPUP_GET_ERRORS,
  SOLACE_CONNECTION_FAILED,
  QUEUE_BROWSER_CONNECION_FAILED,
}

export enum ChromeMessageType {
  SOLACE,
  BACKGROUND,
  CONFIG_EXTRACTOR,
  POPUP,
}

export type ChromeMessage = {
  from: ChromeMessageType;
  to: ChromeMessageType;
  message: MessageConstant;
};
