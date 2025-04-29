type scripts = "solace" | "popup";

export type ChromeMessage =
  | {
      type: "sendInfo" | "sendError";
      content: string;
    }
  | {
      type: "getData";
    };

export type MessageResponse = {
  info: string;
  errors: string[];
};

export interface ChromePort extends chrome.runtime.Port {
  postMessage(message: ChromeMessage): void;
  onMessage: ChromePortMessageEvent;
  name: scripts;
}

interface ChromePortMessageEvent extends chrome.runtime.PortMessageEvent {
  addListener(callback: (msg: ChromeMessage, port: ChromePort) => void): void;
}

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
};
