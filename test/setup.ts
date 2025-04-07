import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { beforeEach, mock } from "bun:test";

// happy-dom
GlobalRegistrator.register();

// happy-dom extension for @material/web
if (!HTMLElement.prototype.attachInternals) {
  HTMLElement.prototype.attachInternals = function () {
    return {
      setFormValue: () => {},
    } as unknown as ElementInternals;
  };
}

// chrome
const chromeMock = {
  runtime: {
    sendMessage: mock(),
    onMessage: {
      addListener: mock(),
    },
    getManifest: Function(),
  },
  storage: {
    local: {
      get: (
        _keys:
          | string
          | number
          | (string | number)[]
          | Partial<{
              [key: string]: any;
            }>
          | null,
        _callback: (items: { [key: string]: any }) => void
      ) => {},
      set: (items: Partial<{ [key: string]: any }>) => Promise<void>,
      onChanged: {
        addListener: mock(),
      },
    },
  },
  scripting: {
    getRegisteredContentScripts: (
      _filter?: chrome.scripting.ContentScriptFilter
    ) => Promise<chrome.scripting.RegisteredContentScript[]>,
    registerContentScripts: (
      _scripts: chrome.scripting.RegisteredContentScript[]
    ) => Promise<void>,
    updateContentScripts: (
      _scripts: chrome.scripting.RegisteredContentScript[]
    ) => Promise<void>,
  },
};

Object.assign(globalThis, { chrome: chromeMock });

// env variables
beforeEach(() => {
  Bun.env.NODE_ENV = "test";
});
