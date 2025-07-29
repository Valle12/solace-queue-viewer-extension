import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { Background } from "../src/background";

let background: Background;

beforeEach(() => {
  background = new Background();
});

afterEach(() => {
  mock.restore();
});

describe("constructor", () => {
  test("test if variables are set correctly", () => {
    expect(background.amountErrors).toBe(5);
    expect(background.lastInfo).toBe("-");
    expect(background.lastErrors).toEqual([]);
    expect(background.clusterUrlsSet).toEqual(new Set());
  });
});

describe("init", () => {
  test("test if init is called without chrome calls", () => {
    spyOn(chrome.storage.local, "get");

    background.init();

    expect(chrome.storage.local.get).toHaveBeenCalledTimes(1);
    expect(chrome.storage.local.onChanged.addListener).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
  });
});

describe("chrome.storage.local.get", () => {
  let listener: (changes: any) => void | Promise<void> = () =>
    Promise.resolve();

  beforeEach(() => {
    spyOn(chrome.storage.local, "get").mockImplementation(
      (
        _keys: string | string[] | Record<string, any>,
        callback?: (items: any) => void | Promise<void>
      ) => {
        if (!callback) return Promise.resolve();
        listener = callback;
        return Promise.resolve();
      }
    );
  });

  test("test with no configs", async () => {
    spyOn(chrome.runtime, "getManifest");

    background.init();
    let result = listener({});
    if (result instanceof Promise) await result;

    expect(chrome.runtime.getManifest).toHaveBeenCalledTimes(0);

    result = listener({ clusterUrls: [] });
    if (result instanceof Promise) await result;

    expect(chrome.runtime.getManifest).toHaveBeenCalledTimes(0);
  });

  test("test without web_accessible_resources", async () => {
    spyOn(chrome.runtime, "getManifest").mockReturnValue(
      {} as chrome.runtime.Manifest
    );
    spyOn(background, "setToModifiedArray");

    background.init();
    let result = listener({ clusterUrls: ["https://test.com"] });
    if (result instanceof Promise) await result;

    expect(chrome.runtime.getManifest).toHaveBeenCalledTimes(1);
    expect(background.setToModifiedArray).toHaveBeenCalledTimes(0);
  });

  test("test with one config, that is already registered", async () => {
    spyOn(chrome.runtime, "getManifest").mockReturnValue({
      web_accessible_resources: [
        {
          resources: ["content.js"],
        },
      ],
    } as chrome.runtime.Manifest);
    spyOn(background, "setToModifiedArray").mockImplementation(() => [
      "https://test.com/*",
    ]);
    spyOn(chrome.scripting, "getRegisteredContentScripts").mockImplementation(
      _filter => {
        return Promise.resolve([
          {
            id: "solace",
            css: [],
          },
        ]);
      }
    );
    spyOn(chrome.scripting, "registerContentScripts").mockImplementation(() =>
      Promise.resolve()
    );

    background.init();
    let result = listener({ clusterUrls: ["https://test.com"] });
    if (result instanceof Promise) await result;

    expect(background.setToModifiedArray).toHaveBeenCalledTimes(1);
    expect(chrome.scripting.registerContentScripts).toHaveBeenCalledTimes(0);
  });

  test("test with one config, that needs to be registered", async () => {
    spyOn(chrome.runtime, "getManifest").mockReturnValue({
      web_accessible_resources: [
        {
          resources: ["content.js"],
        },
      ],
    } as chrome.runtime.Manifest);
    spyOn(background, "setToModifiedArray").mockImplementation(() => [
      "https://test.com/*",
    ]);
    spyOn(chrome.scripting, "getRegisteredContentScripts").mockImplementation(
      _filter => {
        return Promise.resolve([]);
      }
    );
    spyOn(chrome.scripting, "registerContentScripts").mockImplementation(() =>
      Promise.resolve()
    );

    background.init();
    let result = listener({ clusterUrls: ["https://test.com"] });
    if (result instanceof Promise) await result;

    expect(chrome.scripting.registerContentScripts).toHaveBeenCalledTimes(1);
    expect(chrome.scripting.registerContentScripts).toHaveBeenCalledWith([
      {
        id: "solace",
        js: ["content.js"],
        matches: ["https://test.com/*"],
      },
    ]);
  });
});

describe("chrome.storage.local.onChanged", () => {
  let listener: (changes: any) => void | Promise<void> = () =>
    Promise.resolve();

  beforeEach(() => {
    spyOn(chrome.storage.local.onChanged, "addListener").mockImplementation(
      (callback: (changes: any) => void | Promise<void>) => {
        if (!callback) return;
        listener = callback;
        return Promise.resolve();
      }
    );
  });

  test("test if change does not contain clusterUrls", async () => {
    spyOn(background, "setToModifiedArray");

    background.init();
    const result = listener({});
    if (result instanceof Promise) await result;

    expect(background.clusterUrlsSet).toEqual(new Set());
    expect(background.setToModifiedArray).toHaveBeenCalledTimes(0);
  });

  test("test with empty value", async () => {
    spyOn(background, "setToModifiedArray");

    background.init();
    const result = listener({
      clusterUrls: {
        newValue: [],
      },
    });
    if (result instanceof Promise) await result;

    expect(background.clusterUrlsSet).toEqual(new Set());
    expect(background.setToModifiedArray).toHaveBeenCalledTimes(0);
  });

  test("test with one element array", async () => {
    spyOn(background, "setToModifiedArray").mockImplementation(() => [
      "https://test.com/*",
    ]);
    spyOn(chrome.scripting, "updateContentScripts");

    background.init();
    const result = listener({
      clusterUrls: {
        newValue: ["https://test.com"],
      },
    });
    if (result instanceof Promise) await result;

    expect(background.clusterUrlsSet).toEqual(new Set(["https://test.com"]));
    expect(background.setToModifiedArray).toHaveBeenCalledTimes(1);
    expect(chrome.scripting.updateContentScripts).toHaveBeenCalledTimes(1);
    expect(chrome.scripting.updateContentScripts).toHaveBeenCalledWith([
      {
        id: "solace",
        matches: ["https://test.com/*"],
        css: [],
      },
    ]);
  });

  test("test with two element array", async () => {
    spyOn(background, "setToModifiedArray").mockImplementation(() => [
      "https://test.com/*",
      "https://test2.com/*",
    ]);
    spyOn(chrome.scripting, "updateContentScripts");

    background.init();
    const result = listener({
      clusterUrls: {
        newValue: ["https://test.com", "https://test2.com/*"],
      },
    });
    if (result instanceof Promise) await result;

    expect(background.clusterUrlsSet).toEqual(
      new Set(["https://test.com", "https://test2.com/*"])
    );
    expect(background.setToModifiedArray).toHaveBeenCalledTimes(1);
    expect(chrome.scripting.updateContentScripts).toHaveBeenCalledTimes(1);
    expect(chrome.scripting.updateContentScripts).toHaveBeenCalledWith([
      {
        id: "solace",
        matches: ["https://test.com/*", "https://test2.com/*"],
        css: [],
      },
    ]);
  });
});

describe("chrome.runtime.onMessage.addListener", () => {
  let listener: (
    msg: any,
    sender: any,
    sendResponse: any
  ) => void | Promise<void> = () => Promise.resolve();

  beforeEach(() => {
    spyOn(chrome.runtime.onMessage, "addListener").mockImplementation(
      (
        callback: (
          msg: any,
          sender: any,
          sendResponse: any
        ) => void | Promise<void>
      ) => {
        if (!callback) return;
        listener = callback;
        return Promise.resolve();
      }
    );
  });

  test("test with sendInfo", async () => {
    background.init();
    const result = listener(
      { type: "sendInfo", content: "test" },
      {},
      () => {}
    );
    if (result instanceof Promise) await result;

    expect(background.lastInfo).toBe("test");
  });

  test("test with sendError without removing elements", async () => {
    background.init();
    const result = listener(
      { type: "sendError", content: "test" },
      {},
      () => {}
    );
    if (result instanceof Promise) await result;

    expect(background.lastErrors).toEqual(["test"]);
  });

  test("test with sendError with removing elements", async () => {
    background.init();
    background.lastErrors = ["test1", "test2", "test3", "test4", "test5"];
    const result = listener(
      { type: "sendError", content: "test" },
      {},
      () => {}
    );
    if (result instanceof Promise) await result;

    expect(background.lastErrors).toEqual([
      "test",
      "test1",
      "test2",
      "test3",
      "test4",
    ]);
  });

  test("test with getData", async () => {
    background.init();
    const result = listener(
      { type: "getData" },
      {},
      (response: { info: string; errors: string[] }) => {
        expect(response.info).toBe("-");
        expect(response.errors).toEqual([]);
      }
    );
    if (result instanceof Promise) await result;
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
});
