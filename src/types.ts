type scripts = "solace" | "popup";

export type ChromeMessage = {
  type: "sendInfo" | "sendError";
  content: string;
};

/** Last info and errors, stored in chrome.storage.session so it survives service worker restarts */
export type Status = {
  info: string;
  errors: string[];
};

export const createDefaultStatus = (): Status => ({ info: "-", errors: [] });

export type Config = Partial<{
  password: string;
  url: string;
  userName: string;
  vpn: string;
  clusterUrl: string;
}>;

export type SolaceButton = "play_arrow" | "stop";

export type SolaceMessage = {
  topic?: string;
  message: string;
  isJson: boolean;
};
