import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  setSystemTime,
  spyOn,
  test,
} from "bun:test";
import { Background } from "../src/background";
import type { Status } from "../src/types";

let background: Background;

const js = ["src/solace.js"];
const manifest = {
  web_accessible_resources: [{ resources: js, matches: ["<all_urls>"] }],
} as unknown as chrome.runtime.Manifest;

beforeEach(() => {
  background = new Background();
});

afterEach(() => {
  mock.restore();
  setSystemTime();
});

describe("constructor", () => {
  test("test if variables are set correctly", () => {
    expect(background.amountErrors).toBe(5);
    expect(background.scriptId).toBe("solace");
    expect(background.clusterUrlsSet).toEqual(new Set());
  });
});

describe("init", () => {
  beforeEach(() => {
    spyOn(background, "syncContentScripts").mockImplementation(() =>
      Promise.resolve(),
    );
  });

  test("test if listeners are added and content scripts are synced", () => {
    spyOn(chrome.runtime.onInstalled, "addListener");
    spyOn(chrome.runtime.onStartup, "addListener");
    spyOn(chrome.storage.local.onChanged, "addListener");
    spyOn(chrome.runtime.onMessage, "addListener");

    background.init();

    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.onStartup.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.storage.local.onChanged.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(background.syncContentScripts).toHaveBeenCalledTimes(1);
    expect(background.syncContentScripts).toHaveBeenCalledWith();
  });

  test("test if onInstalled and onStartup sync the content scripts", () => {
    let installedListener: () => void = () => {};
    let startupListener: () => void = () => {};
    spyOn(chrome.runtime.onInstalled, "addListener").mockImplementation(
      (callback: any) => {
        installedListener = callback;
      },
    );
    spyOn(chrome.runtime.onStartup, "addListener").mockImplementation(
      (callback: any) => {
        startupListener = callback;
      },
    );

    background.init();
    installedListener();
    startupListener();

    expect(background.syncContentScripts).toHaveBeenCalledTimes(3);
  });
});

describe("chrome.storage.local.onChanged", () => {
  let listener: (changes: any) => void = () => {};

  beforeEach(() => {
    spyOn(chrome.storage.local.onChanged, "addListener").mockImplementation(
      (callback: any) => {
        listener = callback;
      },
    );
    spyOn(background, "syncContentScripts").mockImplementation(() =>
      Promise.resolve(),
    );
    background.init();
  });

  test("test if change does not contain clusterUrls", () => {
    listener({ "https://test.com.url": { newValue: "wss://test.com:443" } });

    // Only the sync on startup
    expect(background.syncContentScripts).toHaveBeenCalledTimes(1);
  });

  test("test with first configuration", () => {
    listener({ clusterUrls: { newValue: ["https://test.com"] } });

    expect(background.syncContentScripts).toHaveBeenCalledTimes(2);
    expect(background.syncContentScripts).toHaveBeenLastCalledWith([
      "https://test.com",
    ]);
  });

  test("test with additional configuration", () => {
    listener({
      clusterUrls: {
        oldValue: ["https://test.com"],
        newValue: ["https://test.com", "https://test2.com"],
      },
    });

    expect(background.syncContentScripts).toHaveBeenLastCalledWith([
      "https://test2.com",
    ]);
  });

  test("test with removed configuration", () => {
    listener({
      clusterUrls: {
        oldValue: ["https://test.com", "https://test2.com"],
        newValue: ["https://test.com"],
      },
    });

    expect(background.syncContentScripts).toHaveBeenLastCalledWith([]);
  });

  test("test with cleared storage", () => {
    listener({ clusterUrls: { oldValue: ["https://test.com"] } });

    expect(background.syncContentScripts).toHaveBeenLastCalledWith([]);
  });
});

describe("chrome.runtime.onMessage.addListener", () => {
  let listener: (msg: any, sender: any, sendResponse: any) => void = () => {};

  beforeEach(() => {
    spyOn(chrome.runtime.onMessage, "addListener").mockImplementation(
      (callback: any) => {
        listener = callback;
      },
    );
    spyOn(background, "syncContentScripts").mockImplementation(() =>
      Promise.resolve(),
    );
    spyOn(background, "setInfo").mockImplementation(() => Promise.resolve());
    spyOn(background, "addError").mockImplementation(() => Promise.resolve());
    background.init();
  });

  test("test with sendInfo", () => {
    listener({ type: "sendInfo", content: "test" }, {}, () => {});

    expect(background.setInfo).toHaveBeenCalledTimes(1);
    expect(background.setInfo).toHaveBeenCalledWith("test");
    expect(background.addError).toHaveBeenCalledTimes(0);
  });

  test("test with sendError", () => {
    listener({ type: "sendError", content: "test" }, {}, () => {});

    expect(background.addError).toHaveBeenCalledTimes(1);
    expect(background.addError).toHaveBeenCalledWith("test");
    expect(background.setInfo).toHaveBeenCalledTimes(0);
  });

  test("test with unknown message", () => {
    listener({ type: "getData" }, {}, () => {});

    expect(background.setInfo).toHaveBeenCalledTimes(0);
    expect(background.addError).toHaveBeenCalledTimes(0);
  });
});

describe("syncContentScripts", () => {
  test("test if syncs run one after the other", async () => {
    const order: string[] = [];
    let finishFirst = () => {};
    spyOn(background, "applyContentScripts")
      .mockImplementationOnce(
        () =>
          new Promise<void>(resolve => {
            order.push("first start");
            finishFirst = () => {
              order.push("first end");
              resolve();
            };
          }),
      )
      .mockImplementationOnce(async () => {
        order.push("second start");
      });

    background.syncContentScripts();
    const done = background.syncContentScripts(["https://test.com"]);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(order).toEqual(["first start"]);

    finishFirst();
    await done;

    expect(order).toEqual(["first start", "first end", "second start"]);
    expect(background.applyContentScripts).toHaveBeenNthCalledWith(1, []);
    expect(background.applyContentScripts).toHaveBeenNthCalledWith(2, [
      "https://test.com",
    ]);
  });

  test("test if a failing sync is reported and later syncs still run", async () => {
    const date = new Date();
    setSystemTime(date);
    spyOn(background, "applyContentScripts")
      .mockImplementationOnce(() =>
        Promise.reject(new Error("Duplicate script ID 'solace'")),
      )
      .mockImplementationOnce(() => Promise.reject("not an error object"))
      .mockImplementationOnce(() => Promise.resolve());
    spyOn(background, "addError").mockImplementation(() => Promise.resolve());

    background.syncContentScripts();
    background.syncContentScripts();
    await background.syncContentScripts();

    expect(background.applyContentScripts).toHaveBeenCalledTimes(3);
    expect(background.addError).toHaveBeenCalledTimes(2);
    expect(background.addError).toHaveBeenNthCalledWith(
      1,
      `[${date.toLocaleTimeString()}] Could not update content script: Duplicate script ID 'solace'`,
    );
    expect(background.addError).toHaveBeenNthCalledWith(
      2,
      `[${date.toLocaleTimeString()}] Could not update content script: not an error object`,
    );
  });
});

describe("applyContentScripts", () => {
  let clusterUrls: string[] | undefined;

  beforeEach(() => {
    clusterUrls = undefined;
    spyOn(chrome.runtime, "getManifest").mockReturnValue(manifest);
    spyOn(chrome.storage.local, "get").mockImplementation(() =>
      Promise.resolve(clusterUrls ? { clusterUrls } : {}),
    );
    spyOn(chrome.scripting, "getRegisteredContentScripts").mockImplementation(
      () => Promise.resolve([]),
    );
    spyOn(chrome.scripting, "registerContentScripts").mockImplementation(() =>
      Promise.resolve(),
    );
    spyOn(chrome.scripting, "updateContentScripts").mockImplementation(() =>
      Promise.resolve(),
    );
    spyOn(chrome.scripting, "unregisterContentScripts").mockImplementation(
      () => Promise.resolve(),
    );
    spyOn(background, "injectIntoOpenTabs").mockImplementation(() =>
      Promise.resolve(),
    );
  });

  function mockRegistered(script: chrome.scripting.RegisteredContentScript) {
    spyOn(chrome.scripting, "getRegisteredContentScripts").mockImplementation(
      () => Promise.resolve([script]),
    );
  }

  test("test without web_accessible_resources", async () => {
    spyOn(chrome.runtime, "getManifest").mockReturnValue(
      {} as chrome.runtime.Manifest,
    );

    await background.applyContentScripts([]);

    expect(chrome.storage.local.get).toHaveBeenCalledTimes(0);
    expect(chrome.scripting.registerContentScripts).toHaveBeenCalledTimes(0);
  });

  test("test with no configs and nothing registered", async () => {
    await background.applyContentScripts([]);

    expect(chrome.scripting.getRegisteredContentScripts).toHaveBeenCalledWith({
      ids: ["solace"],
    });
    expect(chrome.scripting.unregisterContentScripts).toHaveBeenCalledTimes(0);
    expect(chrome.scripting.registerContentScripts).toHaveBeenCalledTimes(0);
    expect(chrome.scripting.updateContentScripts).toHaveBeenCalledTimes(0);
  });

  test("test with all configs deleted, but script still registered", async () => {
    clusterUrls = [];
    mockRegistered({ id: "solace", js, matches: ["https://test.com/*"] });

    await background.applyContentScripts([]);

    expect(chrome.scripting.unregisterContentScripts).toHaveBeenCalledTimes(1);
    expect(chrome.scripting.unregisterContentScripts).toHaveBeenCalledWith({
      ids: ["solace"],
    });
    expect(chrome.scripting.registerContentScripts).toHaveBeenCalledTimes(0);
  });

  test("test with config, that needs to be registered", async () => {
    clusterUrls = ["https://test.com"];

    await background.applyContentScripts([]);

    expect(background.clusterUrlsSet).toEqual(new Set(["https://test.com"]));
    expect(chrome.scripting.registerContentScripts).toHaveBeenCalledTimes(1);
    expect(chrome.scripting.registerContentScripts).toHaveBeenCalledWith([
      {
        id: "solace",
        js,
        matches: ["https://test.com/*"],
        runAt: "document_idle",
        persistAcrossSessions: true,
      },
    ]);
    expect(chrome.scripting.updateContentScripts).toHaveBeenCalledTimes(0);
  });

  test("test with registration that is already up to date", async () => {
    clusterUrls = ["https://test.com", "https://test2.com"];
    mockRegistered({
      id: "solace",
      js,
      matches: ["https://test2.com/*", "https://test.com/*"],
    });

    await background.applyContentScripts([]);

    expect(chrome.scripting.registerContentScripts).toHaveBeenCalledTimes(0);
    expect(chrome.scripting.updateContentScripts).toHaveBeenCalledTimes(0);
    expect(chrome.scripting.unregisterContentScripts).toHaveBeenCalledTimes(0);
  });

  test("test with registration, that misses a cluster", async () => {
    clusterUrls = ["https://test.com", "https://test2.com"];
    mockRegistered({ id: "solace", js, matches: ["https://test.com/*"] });

    await background.applyContentScripts([]);

    expect(chrome.scripting.updateContentScripts).toHaveBeenCalledTimes(1);
    expect(chrome.scripting.updateContentScripts).toHaveBeenCalledWith([
      {
        id: "solace",
        js,
        matches: ["https://test.com/*", "https://test2.com/*"],
      },
    ]);
    expect(chrome.scripting.registerContentScripts).toHaveBeenCalledTimes(0);
  });

  test("test with registration of an outdated script file", async () => {
    clusterUrls = ["https://test.com"];
    mockRegistered({
      id: "solace",
      js: ["src/old.js"],
      matches: ["https://test.com/*"],
    });

    await background.applyContentScripts([]);

    expect(chrome.scripting.updateContentScripts).toHaveBeenCalledWith([
      { id: "solace", js, matches: ["https://test.com/*"] },
    ]);
  });

  test("test if open tabs are only injected for added clusters", async () => {
    clusterUrls = ["https://test.com", "https://test2.com"];

    await background.applyContentScripts(["https://test2.com"]);

    expect(background.injectIntoOpenTabs).toHaveBeenCalledTimes(1);
    expect(background.injectIntoOpenTabs).toHaveBeenCalledWith(
      ["https://test2.com/*"],
      js,
    );
  });

  test("test if clusters, that were removed again, are not injected", async () => {
    clusterUrls = ["https://test.com"];

    await background.applyContentScripts(["https://test2.com"]);

    expect(background.injectIntoOpenTabs).toHaveBeenCalledTimes(0);
  });

  test("test without added clusters", async () => {
    clusterUrls = ["https://test.com"];

    await background.applyContentScripts([]);

    expect(background.injectIntoOpenTabs).toHaveBeenCalledTimes(0);
  });
});

describe("first configuration", () => {
  // Regression: the first config was only picked up after a service worker restart
  test("test if the content script gets registered and injected without restart", async () => {
    let onChanged: (changes: any) => void = () => {};
    let clusterUrls: string[] | undefined;
    const registered: chrome.scripting.RegisteredContentScript[] = [];
    spyOn(chrome.storage.local.onChanged, "addListener").mockImplementation(
      (callback: any) => {
        onChanged = callback;
      },
    );
    spyOn(chrome.runtime, "getManifest").mockReturnValue(manifest);
    spyOn(chrome.storage.local, "get").mockImplementation(() =>
      Promise.resolve(clusterUrls ? { clusterUrls } : {}),
    );
    spyOn(chrome.scripting, "getRegisteredContentScripts").mockImplementation(
      () => Promise.resolve([...registered]),
    );
    spyOn(chrome.scripting, "registerContentScripts").mockImplementation(
      (scripts: chrome.scripting.RegisteredContentScript[]) => {
        registered.push(...scripts);
        return Promise.resolve();
      },
    );
    spyOn(chrome.scripting, "updateContentScripts").mockImplementation(() =>
      Promise.reject(new Error("Script with ID 'solace' does not exist")),
    );
    spyOn(chrome.tabs, "query").mockImplementation(() =>
      Promise.resolve([{ id: 1 } as chrome.tabs.Tab]),
    );
    spyOn(background, "injectIntoTab").mockImplementation(() =>
      Promise.resolve(),
    );

    background.init();
    await background.syncChain;

    expect(chrome.scripting.registerContentScripts).toHaveBeenCalledTimes(0);

    clusterUrls = ["https://test.com"];
    onChanged({ clusterUrls: { newValue: clusterUrls } });
    await background.syncChain;

    expect(chrome.scripting.registerContentScripts).toHaveBeenCalledTimes(1);
    expect(registered[0].matches).toEqual(["https://test.com/*"]);
    expect(chrome.scripting.updateContentScripts).toHaveBeenCalledTimes(0);
    expect(chrome.tabs.query).toHaveBeenCalledWith({
      url: ["https://test.com/*"],
    });
    expect(background.injectIntoTab).toHaveBeenCalledWith(1, js);
  });
});

describe("getContentScriptFiles", () => {
  test("test without web_accessible_resources", () => {
    spyOn(chrome.runtime, "getManifest").mockReturnValue(
      {} as chrome.runtime.Manifest,
    );

    expect(background.getContentScriptFiles()).toBeUndefined();
  });

  test("test with manifest v2 resources", () => {
    spyOn(chrome.runtime, "getManifest").mockReturnValue({
      web_accessible_resources: ["src/solace.js"],
    } as chrome.runtime.Manifest);

    expect(background.getContentScriptFiles()).toBeUndefined();
  });

  test("test with manifest v3 resources", () => {
    spyOn(chrome.runtime, "getManifest").mockReturnValue(manifest);

    expect(background.getContentScriptFiles()).toEqual(js);
  });
});

describe("injectIntoOpenTabs", () => {
  test("test if every tab with an id gets injected", async () => {
    spyOn(chrome.tabs, "query").mockImplementation(() =>
      Promise.resolve([{ id: 1 }, {}, { id: 2 }] as chrome.tabs.Tab[]),
    );
    spyOn(background, "injectIntoTab").mockImplementation(() =>
      Promise.resolve(),
    );

    await background.injectIntoOpenTabs(["https://test.com/*"], js);

    expect(chrome.tabs.query).toHaveBeenCalledWith({
      url: ["https://test.com/*"],
    });
    expect(background.injectIntoTab).toHaveBeenCalledTimes(2);
    expect(background.injectIntoTab).toHaveBeenNthCalledWith(1, 1, js);
    expect(background.injectIntoTab).toHaveBeenNthCalledWith(2, 2, js);
  });

  test("test if a failing tab does not stop the others", async () => {
    spyOn(chrome.tabs, "query").mockImplementation(() =>
      Promise.resolve([{ id: 1 }, { id: 2 }] as chrome.tabs.Tab[]),
    );
    spyOn(background, "injectIntoTab").mockImplementation((tabId: number) =>
      tabId === 1 ? Promise.reject(new Error("Tab closed")) : Promise.resolve(),
    );

    await background.injectIntoOpenTabs(["https://test.com/*"], js);

    expect(background.injectIntoTab).toHaveBeenCalledTimes(2);
  });
});

describe("injectIntoTab", () => {
  test("test if content script gets injected", async () => {
    const executeScript = spyOn(chrome.scripting, "executeScript")
      .mockImplementationOnce(() =>
        Promise.resolve([{ documentId: "1", frameId: 0, result: false }]),
      )
      .mockImplementationOnce(() => Promise.resolve([]));

    await background.injectIntoTab(1, js);

    expect(executeScript).toHaveBeenCalledTimes(2);
    expect(executeScript).toHaveBeenNthCalledWith(1, {
      target: { tabId: 1 },
      func: expect.any(Function),
    });
    expect(executeScript).toHaveBeenNthCalledWith(2, {
      target: { tabId: 1 },
      files: js,
    });
  });

  test("test if content script is not injected twice", async () => {
    const executeScript = spyOn(
      chrome.scripting,
      "executeScript",
    ).mockImplementation(() =>
      Promise.resolve([{ documentId: "1", frameId: 0, result: true }]),
    );

    await background.injectIntoTab(1, js);

    expect(executeScript).toHaveBeenCalledTimes(1);
  });

  test("test if probe checks the flag of the content script", async () => {
    const executeScript = spyOn(
      chrome.scripting,
      "executeScript",
    ).mockImplementation(() =>
      Promise.resolve([{ documentId: "1", frameId: 0, result: true }]),
    );

    await background.injectIntoTab(1, js);
    const injection = executeScript.mock.calls[0][0] as {
      func: () => boolean;
    };

    expect(injection.func()).toBeFalse();
    Object.assign(globalThis, { solaceQueueViewer: true });
    expect(injection.func()).toBeTrue();
    delete (globalThis as { solaceQueueViewer?: boolean }).solaceQueueViewer;
  });
});

describe("status", () => {
  let stored: { status?: Status };
  let setSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    stored = {};
    spyOn(chrome.storage.session, "get").mockImplementation(() =>
      Promise.resolve(structuredClone(stored)),
    );
    setSpy = spyOn(chrome.storage.session, "set").mockImplementation(
      (items: { status?: Status }) => {
        Object.assign(stored, structuredClone(items));
        return Promise.resolve();
      },
    );
  });

  test("test if info is set on the default status", async () => {
    await background.setInfo("test");

    expect(stored.status).toEqual({ info: "test", errors: [] });
  });

  test("test if info keeps the errors", async () => {
    stored.status = { info: "-", errors: ["error"] };

    await background.setInfo("test");

    expect(stored.status).toEqual({ info: "test", errors: ["error"] });
  });

  test("test if error is added in front", async () => {
    stored.status = { info: "info", errors: ["error1"] };

    await background.addError("error2");

    expect(stored.status).toEqual({
      info: "info",
      errors: ["error2", "error1"],
    });
  });

  test("test if only the last 5 errors are kept", async () => {
    stored.status = {
      info: "-",
      errors: ["test1", "test2", "test3", "test4", "test5"],
    };

    await background.addError("test");

    expect(stored.status?.errors).toEqual([
      "test",
      "test1",
      "test2",
      "test3",
      "test4",
    ]);
  });

  test("test if errors arriving at the same time are all kept", async () => {
    background.addError("error1");
    background.setInfo("info");
    await background.addError("error2");

    expect(stored.status).toEqual({
      info: "info",
      errors: ["error2", "error1"],
    });
  });

  test("test if a failing update does not block later updates", async () => {
    spyOn(console, "error").mockImplementation(() => {});
    setSpy.mockImplementationOnce(() => Promise.reject(new Error("quota")));

    await background.setInfo("lost");
    await background.setInfo("kept");

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(stored.status).toEqual({ info: "kept", errors: [] });
  });
});

describe("setToModifiedArray", () => {
  test("test with /* at the end", () => {
    background.clusterUrlsSet = new Set(["https://test.com/*"]);

    const result = background.setToModifiedArray();

    expect(result).toEqual(["https://test.com/*"]);
  });

  test("test without /* at the end", () => {
    background.clusterUrlsSet = new Set(["https://test.com"]);

    const result = background.setToModifiedArray();

    expect(result).toEqual(["https://test.com/*"]);
  });

  test("test with empty set", () => {
    background.clusterUrlsSet = new Set();

    const result = background.setToModifiedArray();

    expect(result).toEqual([]);
  });

  test("test with multiple mixed URLs", () => {
    background.clusterUrlsSet = new Set([
      "https://test1.com/*",
      "https://test2.com",
      "https://test3.com/*",
    ]);

    const result = background.setToModifiedArray();

    expect(result).toEqual([
      "https://test1.com/*",
      "https://test2.com/*",
      "https://test3.com/*",
    ]);
  });

  test("test with URLs that end up as the same pattern", () => {
    background.clusterUrlsSet = new Set([
      "https://test.com",
      "https://test.com/*",
    ]);

    const result = background.setToModifiedArray();

    expect(result).toEqual(["https://test.com/*"]);
  });

  test("test with given URLs", () => {
    background.clusterUrlsSet = new Set(["https://test.com"]);

    const result = background.setToModifiedArray(["https://test2.com"]);

    expect(result).toEqual(["https://test2.com/*"]);
  });
});

describe("hasSameItems", () => {
  test("test with same items in different order", () => {
    expect(background.hasSameItems(["a", "b"], ["b", "a"])).toBeTrue();
  });

  test("test with different items", () => {
    expect(background.hasSameItems(["a", "b"], ["a", "c"])).toBeFalse();
  });

  test("test with different amount of items", () => {
    expect(background.hasSameItems(["a"], ["a", "b"])).toBeFalse();
  });

  test("test with duplicates", () => {
    expect(background.hasSameItems(["a", "a"], ["a"])).toBeTrue();
  });

  test("test with undefined", () => {
    expect(background.hasSameItems(undefined, [])).toBeTrue();
    expect(background.hasSameItems(undefined, ["a"])).toBeFalse();
  });
});
