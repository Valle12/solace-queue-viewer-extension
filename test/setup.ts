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
// Call counts of these shared mock() functions persist across tests and files,
// so assert counts on a fresh spyOn() instead
const chromeMock = {
  runtime: {
    sendMessage: <ChromeMessage>(_message: ChromeMessage) => Promise.resolve(),
    onMessage: {
      addListener: mock(),
    },
    onInstalled: {
      addListener: mock(),
    },
    onStartup: {
      addListener: mock(),
    },
    getManifest: Function(),
  },
  storage: {
    local: {
      get: (
        _keys?:
          | string
          | number
          | (string | number)[]
          | Partial<{
              [key: string]: any;
            }>
          | null,
      ): Promise<{ [key: string]: any }> => Promise.resolve({}),
      set: (_items: Partial<{ [key: string]: any }>) => Promise.resolve(),
      remove: (_keys: string | number | (string | number)[]) =>
        Promise.resolve(),
      onChanged: {
        addListener: mock(),
      },
    },
    session: {
      get: (
        _keys?: string | string[] | null,
      ): Promise<{ [key: string]: any }> => Promise.resolve({}),
      set: (_items: Partial<{ [key: string]: any }>) => Promise.resolve(),
      remove: (_keys: string | string[]) => Promise.resolve(),
      onChanged: {
        addListener: mock(),
      },
    },
  },
  scripting: {
    getRegisteredContentScripts: (
      _filter?: chrome.scripting.ContentScriptFilter,
    ): Promise<chrome.scripting.RegisteredContentScript[]> =>
      Promise.resolve([]),
    registerContentScripts: (
      _scripts: chrome.scripting.RegisteredContentScript[],
    ) => Promise.resolve(),
    updateContentScripts: (
      _scripts: chrome.scripting.RegisteredContentScript[],
    ) => Promise.resolve(),
    unregisterContentScripts: (
      _filter?: chrome.scripting.ContentScriptFilter,
    ) => Promise.resolve(),
    executeScript: (
      _injection: chrome.scripting.ScriptInjection<unknown[], unknown>,
    ): Promise<chrome.scripting.InjectionResult<unknown>[]> =>
      Promise.resolve([]),
  },
  tabs: {
    query: (_queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> =>
      Promise.resolve([]),
  },
};

Object.assign(globalThis, { chrome: chromeMock });

// env variables
beforeEach(() => {
  Bun.env.NODE_ENV = "test";
});
