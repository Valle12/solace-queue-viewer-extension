import { MdIconButton } from "@material/web/iconbutton/icon-button";
import type { MdList } from "@material/web/list/list";
import type { MdListItem } from "@material/web/list/list-item";
import type { MdTabs } from "@material/web/tabs/tabs";
import { MdOutlinedTextField } from "@material/web/textfield/outlined-text-field";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { Session, SessionEventCode, SolclientFactory } from "solclientjs";
import { Popup } from "../src/popup/popup";
import type { Status } from "../src/types";

function mockStatus(status?: Status) {
  spyOn(chrome.storage.session, "get").mockImplementation(() =>
    Promise.resolve(status ? { status } : {}),
  );
}

let popup: Popup;

beforeEach(() => {
  popup = new Popup();
});

afterEach(() => {
  mock.restore();
});

describe("init", () => {
  beforeEach(() => {
    spyOn(popup, "addListeners").mockImplementation(() => {});
    spyOn(popup, "getData").mockImplementation(() => Promise.resolve());
    spyOn(popup, "setupCredentialsPanel").mockImplementation(() =>
      Promise.resolve(),
    );
  });

  test("test if init runs methods succesfully", async () => {
    await popup.init();

    expect(popup.addListeners).toHaveBeenCalledTimes(1);
    expect(popup.getData).toHaveBeenCalledTimes(1);
    expect(popup.setupCredentialsPanel).toHaveBeenCalledTimes(1);
  });
});

describe("addListeners", () => {
  test("test if method executes if DOMContentLoaded event is fired", () => {
    let listener: (ev: Event) => void = () => {};
    let div = document.createElement("div");
    spyOn(document, "addEventListener").mockImplementation(
      (_event: any, cb: (ev: Event) => void) => {
        listener = cb;
      },
    );
    spyOn(document, "querySelector").mockReturnValue(div);
    popup.primaryTabs = {
      activeTab: {
        getAttribute: () => "infos-panel",
      },
      getRootNode: () => document,
      addEventListener: () => {},
    } as unknown as MdTabs;

    popup.addListeners();
    listener(new Event("DOMContentLoaded"));

    expect(popup.primaryPanelId).toBe("infos-panel");
    expect(popup.primaryRoot).toEqual(document);
    expect(popup.currentPrimaryPanel).toEqual(div);
  });

  test("test if code executes if tab change event is fired with no panel yet", () => {
    let listener: (ev: Event) => void = () => {};
    spyOn(document, "addEventListener").mockImplementation(() => {});
    popup.primaryTabs = {
      addEventListener: (_type: any, cb: (ev: Event) => void) => {
        listener = cb;
      },
      activeTab: {
        getAttribute: () => "infos-panel",
      },
      getRootNode: () => document,
    } as unknown as MdTabs;

    popup.addListeners();
    listener(new Event("change"));

    expect(popup.primaryPanelId).toBe("infos-panel");
    expect(popup.primaryRoot).toEqual(document);
    expect(popup.currentPrimaryPanel).toBeNull();
  });

  test("test if code executes if tab change event is fired with panel already set", () => {
    let listener: (ev: Event) => void = () => {};
    let div = document.createElement("div");
    spyOn(document, "addEventListener").mockImplementation(() => {});
    spyOn(document, "querySelector").mockReturnValue(div);
    popup.currentPrimaryPanel = div;
    popup.primaryTabs = {
      addEventListener: (_type: any, cb: (ev: Event) => void) => {
        listener = cb;
      },
      activeTab: {
        getAttribute: () => "infos-panel",
      },
      getRootNode: () => document,
    } as unknown as MdTabs;

    popup.addListeners();
    listener(new Event("change"));

    expect(popup.primaryPanelId).toBe("infos-panel");
    expect(popup.primaryRoot).toEqual(document);
    expect(popup.currentPrimaryPanel.hidden).toBeFalse();
  });

  test("test if code executed if tab change event is fired with how-to-use-panel already set", () => {
    let listener: (ev: Event) => void = () => {};
    let div = document.createElement("div");
    spyOn(document, "addEventListener").mockImplementation(() => {});
    spyOn(document, "querySelector").mockReturnValue(div);
    spyOn(popup, "addSecondaryTabsListener").mockImplementation(() => {});
    popup.currentPrimaryPanel = div;
    popup.primaryTabs = {
      addEventListener: (_type: any, cb: (ev: Event) => void) => {
        listener = cb;
      },
      activeTab: {
        getAttribute: () => "how-to-use-panel",
      },
      getRootNode: () => document,
    } as unknown as MdTabs;

    popup.addListeners();
    listener(new Event("change"));

    expect(popup.primaryPanelId).toBe("how-to-use-panel");
    expect(popup.primaryRoot).toEqual(document);
    expect(popup.currentPrimaryPanel.hidden).toBeFalse();
    expect(popup.addSecondaryTabsListener).toHaveBeenCalledTimes(1);
  });

  test("test if status changes get rendered while the popup is open", () => {
    let listener: (changes: any) => void = () => {};
    spyOn(document, "addEventListener").mockImplementation(() => {});
    spyOn(chrome.storage.session.onChanged, "addListener").mockImplementation(
      (callback: any) => {
        listener = callback;
      },
    );
    spyOn(popup, "renderStatus").mockImplementation(() => {});
    popup.primaryTabs = {
      addEventListener: () => {},
    } as unknown as MdTabs;

    popup.addListeners();
    listener({ other: { newValue: "other" } });

    expect(popup.renderStatus).toHaveBeenCalledTimes(0);

    listener({ status: { newValue: { info: "info", errors: ["error"] } } });

    expect(popup.renderStatus).toHaveBeenCalledTimes(1);
    expect(popup.renderStatus).toHaveBeenCalledWith({
      info: "info",
      errors: ["error"],
    });

    listener({ status: { oldValue: { info: "info", errors: [] } } });

    expect(popup.renderStatus).toHaveBeenCalledTimes(2);
    expect(popup.renderStatus).toHaveBeenLastCalledWith({
      info: "-",
      errors: [],
    });
  });
});

describe("renderStatus", () => {
  let infoList: MdList;
  let errorsList: MdList;

  beforeEach(() => {
    infoList = document.createElement("md-list") as MdList;
    errorsList = document.createElement("md-list") as MdList;
    spyOn(document, "querySelector").mockImplementation((selectors: string) => {
      if (selectors.includes("#infos-panel")) return infoList;
      return errorsList;
    });
  });

  function texts(list: MdList) {
    return Array.from(
      list.querySelectorAll("md-list-item"),
      item => item.textContent,
    );
  }

  test("test if status replaces the previously rendered one", () => {
    popup.renderStatus({ info: "-", errors: [] });
    popup.renderStatus({
      info: "Test Info",
      errors: ["Test Error 1", "Test Error 2"],
    });

    expect(texts(infoList)).toEqual(["Last info: Test Info"]);
    expect(texts(errorsList)).toEqual([
      "Last errors",
      "Test Error 1",
      "Test Error 2",
    ]);
  });

  test("test if errors get removed again", () => {
    popup.renderStatus({ info: "Test Info", errors: ["Test Error"] });
    popup.renderStatus({ info: "", errors: [] });

    expect(texts(infoList)).toEqual(["No info"]);
    expect(texts(errorsList)).toEqual(["No errors"]);
  });
});

describe("getData", () => {
  test("test if it has no status yet and no storage entries", async () => {
    const infoList = document.createElement("md-list");
    const errorsList = document.createElement("md-list");
    mockStatus();
    spyOn(chrome.storage.local, "get").mockImplementation(() => {
      return Promise.resolve({});
    });
    spyOn(document, "querySelector").mockImplementation((selectors: string) => {
      if (selectors.includes("#infos-panel")) return infoList;
      return errorsList;
    });

    await popup.getData();

    expect(chrome.storage.session.get).toHaveBeenCalledWith("status");
    expect(infoList.querySelector("md-list-item")?.textContent).toBe(
      "Last info: -",
    );
    expect(errorsList.querySelector("md-list-item")?.textContent).toBe(
      "No errors",
    );
    expect(popup.configs).toHaveLength(0);
  });

  test("test if it has no info, no errors and no storage entries", async () => {
    const infoList = document.createElement("md-list");
    const errorsList = document.createElement("md-list");
    mockStatus({ info: "", errors: [] });
    spyOn(chrome.storage.local, "get").mockImplementation(() => {
      return Promise.resolve({});
    });
    spyOn(document, "querySelector").mockImplementation((selectors: string) => {
      if (selectors.includes("#infos-panel")) return infoList;
      return errorsList;
    });
    spyOn(popup.configs, "push");

    await popup.getData();

    expect(infoList.querySelector("md-list-item")?.textContent).toBe("No info");
    expect(errorsList.querySelector("md-list-item")?.textContent).toBe(
      "No errors",
    );
    expect(popup.configs.push).toHaveBeenCalledTimes(0);
  });

  test("test if it has info, one error and one full storage entry", async () => {
    const infoList = document.createElement("md-list");
    const errorsList = document.createElement("md-list");
    mockStatus({ info: "Test Info", errors: ["Test Error"] });
    spyOn(chrome.storage.local, "get").mockImplementation(() => {
      return Promise.resolve({
        "cluster.password": "password",
        "cluster.url": "url",
        "cluster.userName": "userName",
        "cluster.vpn": "vpn",
      });
    });
    spyOn(document, "querySelector").mockImplementation((selectors: string) => {
      if (selectors.includes("#infos-panel")) return infoList;
      return errorsList;
    });

    await popup.getData();

    expect(infoList.querySelector("md-list-item")?.textContent).toBe(
      "Last info: Test Info",
    );
    errorsList
      .querySelectorAll("md-list-item")
      .forEach((item, key, _parent) => {
        if (key === 0) expect(item.textContent).toBe("Last errors");
        else expect(item.textContent).toBe("Test Error");
      });
    expect(popup.configs).toHaveLength(1);
    expect(popup.configs[0]).toEqual({
      clusterUrl: "cluster",
      password: "password",
      url: "url",
      userName: "userName",
      vpn: "vpn",
    });
  });

  test("test if it has info, multiple errors and multiple full storage entries", async () => {
    const infoList = document.createElement("md-list");
    const errorsList = document.createElement("md-list");
    mockStatus({ info: "Test Info", errors: ["Test Error 1", "Test Error 2"] });
    spyOn(chrome.storage.local, "get").mockImplementation(() => {
      return Promise.resolve({
        "cluster.password": "password",
        "cluster.url": "url",
        "cluster.userName": "userName",
        "cluster.vpn": "vpn",
        "cluster2.password": "password2",
        "cluster2.url": "url2",
        "cluster2.userName": "userName2",
        "cluster2.vpn": "vpn2",
      });
    });
    spyOn(document, "querySelector").mockImplementation((selectors: string) => {
      if (selectors.includes("#infos-panel")) return infoList;
      return errorsList;
    });

    await popup.getData();

    expect(infoList.querySelector("md-list-item")?.textContent).toBe(
      "Last info: Test Info",
    );
    const items = errorsList.querySelectorAll("md-list-item");
    expect(items).toHaveLength(3);
    items.forEach((item, key, _parent) => {
      if (key === 0) expect(item.textContent).toBe("Last errors");
      if (key === 1) expect(item.textContent).toBe("Test Error 1");
      if (key === 2) expect(item.textContent).toBe("Test Error 2");
    });
    expect(popup.configs).toHaveLength(2);
    expect(popup.configs[0]).toEqual({
      clusterUrl: "cluster",
      password: "password",
      url: "url",
      userName: "userName",
      vpn: "vpn",
    });
    expect(popup.configs[1]).toEqual({
      clusterUrl: "cluster2",
      password: "password2",
      url: "url2",
      userName: "userName2",
      vpn: "vpn2",
    });
  });

  test("test getData with incomplete storage data", async () => {
    const infoList = document.createElement("md-list");
    const errorsList = document.createElement("md-list");
    mockStatus({ info: "", errors: [] });
    spyOn(chrome.storage.local, "get").mockImplementation(() => {
      return Promise.resolve({
        "cluster.password": "password",
        // Missing url field
        "cluster.userName": "userName",
        "cluster.vpn": "vpn",
        // Incomplete second cluster data
        "cluster2.password": "password2",
      });
    });
    spyOn(document, "querySelector").mockImplementation((selectors: string) => {
      if (selectors.includes("#infos-panel")) return infoList;
      return errorsList;
    });

    await popup.getData();

    // Should only have one complete config
    expect(popup.configs).toHaveLength(1);
    expect(popup.configs[0]).toEqual({
      clusterUrl: "cluster",
      password: "password",
      userName: "userName",
      vpn: "vpn",
    });
    // The incomplete config should be excluded
    expect(
      popup.configs.find(c => c.clusterUrl === "cluster2"),
    ).toBeUndefined();
  });
});

describe("setupCredentialsPanel", () => {
  let list: MdList;
  let cb: (ev: Event) => void;

  beforeEach(() => {
    list = document.createElement("md-list");
    spyOn(document, "querySelector").mockReturnValue(list);
    spyOn(MdIconButton.prototype, "addEventListener").mockImplementation(
      (_type: any, listener: (ev: Event) => any) => {
        cb = listener;
      },
    );
    spyOn(popup, "displayConfiguration").mockImplementation(() => {});
  });

  test("test if no configurations are saved and click on new config", () => {
    popup.setupCredentialsPanel();
    cb(new Event("click"));

    expect(list.querySelector("md-list-item")?.textContent).toBe(
      "No Configurationsadd",
    );
    expect(popup.displayConfiguration).toHaveBeenCalledTimes(1);
  });

  test("test if one configuration is saved and don't click on new config", () => {
    popup.configs = [
      {
        clusterUrl: "cluster",
        password: "password",
        url: "url",
        userName: "userName",
        vpn: "vpn",
      },
    ];

    popup.setupCredentialsPanel();

    expect(list.querySelector("md-list-item")?.textContent).toBe(
      "Configurations (1)add",
    );
    expect(popup.currentConfig).toBe(0);
    expect(popup.displayConfiguration).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledWith(
      "cluster",
      "url",
      "password",
      "userName",
      "vpn",
    );
  });

  test("test if two configurations are saved and click on new config", () => {
    popup.configs = [
      {
        clusterUrl: "cluster",
        password: "password",
        url: "url",
        userName: "userName",
        vpn: "vpn",
      },
      {
        clusterUrl: "cluster2",
        password: "password2",
        url: "url2",
        userName: "userName2",
        vpn: "vpn2",
      },
    ];

    popup.setupCredentialsPanel();
    cb(new Event("click"));

    expect(list.querySelector("md-list-item")?.textContent).toBe(
      "Configurations (2)add",
    );
    expect(popup.currentConfig).toBe(2);
    expect(popup.displayConfiguration).toHaveBeenCalledTimes(2);
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      1,
      "cluster",
      "url",
      "password",
      "userName",
      "vpn",
    );
  });
});

describe("displayConfiguration", () => {
  let previousConfiguration: MdListItem;
  let mdList: MdList;
  let cb: (ev: Event) => void;

  beforeEach(() => {
    previousConfiguration = document.createElement("md-list-item");
    mdList = document.createElement("md-list");
    spyOn(previousConfiguration, "remove");
    spyOn(document, "querySelector").mockImplementation((selectors: string) => {
      if (selectors.includes(".current-configuration"))
        return previousConfiguration;
      return mdList;
    });
  });

  test.each([
    {
      name: "empty config",
      configCount: 1,
      values: ["", "", "", "", ""],
      iconButtons: 0,
    },
    {
      name: "one filled config",
      configCount: 1,
      values: ["cluster", "url", "password", "userName", "vpn"],
      iconButtons: 0,
    },
    {
      name: "two configs",
      configCount: 2,
      values: ["cluster", "url", "password", "userName", "vpn"],
      iconButtons: 2,
    },
  ])(
    "test with active configuration and $name",
    ({ configCount, values, iconButtons }) => {
      popup.configs = Array.from({ length: configCount }, () => ({}));

      popup.displayConfiguration(...values);

      expect(previousConfiguration.remove).toHaveBeenCalledTimes(1);

      mock.restore();
      const mdListItem = mdList.querySelector("md-list-item") as MdListItem;
      const children = Array.from(mdListItem.children).filter(child =>
        child.matches("md-icon-button"),
      );
      expect(children).toHaveLength(iconButtons);
      expect(mdListItem.querySelectorAll("md-list")).toHaveLength(1);
      const textfields = mdListItem.querySelectorAll("md-outlined-text-field");
      expect(textfields).toHaveLength(5);
      textfields.forEach((textfield, key) => {
        expect(textfield.value).toBe(values[key]);
      });
    },
  );

  test("test if textfields will get event listeners attached", () => {
    popup.configs = [
      {
        clusterUrl: "cluster",
        password: "password",
        url: "url",
        userName: "userName",
        vpn: "vpn",
      },
    ];

    // displayConfiguration would create 5 outlined textfields
    const tf1 = document.createElement("div") as unknown as MdOutlinedTextField;
    const tf2 = document.createElement("div") as unknown as MdOutlinedTextField;
    const tf3 = document.createElement("div") as unknown as MdOutlinedTextField;
    const tf4 = document.createElement("div") as unknown as MdOutlinedTextField;
    const tf5 = document.createElement("div") as unknown as MdOutlinedTextField;
    document.body.appendChild(tf1);
    document.body.appendChild(tf2);
    document.body.appendChild(tf3);
    document.body.appendChild(tf4);
    document.body.appendChild(tf5);
    spyOn(document, "querySelectorAll").mockImplementation(
      () =>
        [tf1, tf2, tf3, tf4, tf5] as unknown as NodeListOf<MdOutlinedTextField>,
    );
    spyOn(tf1, "addEventListener").mockImplementation(
      (_type: any, listener: (ev: Event) => any) => {
        cb = listener;
      },
    );
    spyOn(tf2, "addEventListener");
    spyOn(tf3, "addEventListener");
    spyOn(tf4, "addEventListener");
    spyOn(tf5, "addEventListener");

    popup.setupCredentialsPanel();
    cb(new Event("keydown"));

    expect(tf1.addEventListener).toHaveBeenCalledTimes(1);
    expect(tf2.addEventListener).toHaveBeenCalledTimes(1);
    expect(tf3.addEventListener).toHaveBeenCalledTimes(1);
    expect(tf4.addEventListener).toHaveBeenCalledTimes(1);
    expect(tf5.addEventListener).toHaveBeenCalledTimes(1);
  });
});

describe("addElementListeners", () => {
  let mdListItem: MdListItem;

  beforeEach(() => {
    mdListItem = document.createElement("md-list-item");
  });

  test("test with no prev and no next button and no clicks", () => {
    const clusterUrlTextField = document.createElement(
      "md-outlined-text-field",
    );
    clusterUrlTextField.classList.add("cluster-url");
    mdListItem.appendChild(clusterUrlTextField);
    const connectionUrlTextField = document.createElement(
      "md-outlined-text-field",
    );
    connectionUrlTextField.classList.add("connection-url");
    mdListItem.appendChild(connectionUrlTextField);
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdListItem.appendChild(saveButton);
    spyOn(mdListItem, "querySelector");

    popup.addElementListeners(mdListItem);

    expect(mdListItem.querySelector).toHaveBeenCalledTimes(6);
  });

  test("test with prev and next button and trigger button without overflow and textfield events", () => {
    const prevButton = document.createElement("md-icon-button");
    prevButton.classList.add("prev-config");
    mdListItem.appendChild(prevButton);
    let cb: (ev: Event) => any = () => {};
    spyOn(prevButton, "addEventListener").mockImplementation(
      (_type: string, listener: (ev: Event) => any) => {
        cb = listener;
      },
    );
    const nextButton = document.createElement("md-icon-button");
    nextButton.classList.add("next-config");
    mdListItem.appendChild(nextButton);
    const clusterUrlTextField = document.createElement(
      "md-outlined-text-field",
    );
    clusterUrlTextField.classList.add("cluster-url");
    Object.defineProperty(clusterUrlTextField, "validity", {
      value: { patternMismatch: true },
      configurable: true,
    });
    spyOn(clusterUrlTextField, "setCustomValidity").mockImplementation(
      () => {},
    );
    mdListItem.appendChild(clusterUrlTextField);
    let cb1: (ev: Event) => any = () => {};
    spyOn(clusterUrlTextField, "addEventListener").mockImplementation(
      (_type: string, listener: (ev: Event) => any) => {
        cb1 = listener;
      },
    );
    spyOn(clusterUrlTextField, "reportValidity").mockReturnValue(true);
    const connectionUrlTextField = document.createElement(
      "md-outlined-text-field",
    );
    connectionUrlTextField.classList.add("connection-url");
    Object.defineProperty(connectionUrlTextField, "validity", {
      value: { patternMismatch: true },
      configurable: true,
    });
    spyOn(connectionUrlTextField, "setCustomValidity").mockImplementation(
      () => {},
    );
    mdListItem.appendChild(connectionUrlTextField);
    let cb2: (ev: Event) => any = () => {};
    spyOn(connectionUrlTextField, "addEventListener").mockImplementation(
      (_type: string, listener: (ev: Event) => any) => {
        cb2 = listener;
      },
    );
    spyOn(connectionUrlTextField, "reportValidity").mockReturnValue(true);
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdListItem.appendChild(saveButton);
    let cb3: (ev: Event) => any = () => {};
    spyOn(saveButton, "addEventListener").mockImplementation(
      (_type: string, listener: (ev: Event) => any) => {
        cb3 = listener;
      },
    );
    const deleteButton = document.createElement("md-icon-button");
    deleteButton.classList.add("delete-button");
    mdListItem.appendChild(deleteButton);
    let cb4: (ev: Event) => any = () => {};
    spyOn(deleteButton, "addEventListener").mockImplementation(
      (_type: string, listener: (ev: Event) => any) => {
        cb4 = listener;
      },
    );
    spyOn(mdListItem, "querySelector");
    popup.configs = [
      {
        clusterUrl: "cluster",
        password: "password",
        url: "url",
        userName: "userName",
        vpn: "vpn",
      },
      {
        clusterUrl: "cluster2",
        password: "password2",
        url: "url2",
        userName: "userName2",
        vpn: "vpn2",
      },
    ];
    popup.currentConfig = 1;
    spyOn(popup, "displayConfiguration").mockImplementation(() => {});
    spyOn(popup, "saveConfiguration").mockImplementation(() =>
      Promise.resolve(),
    );
    spyOn(popup, "deleteConfiguration").mockImplementation(() =>
      Promise.resolve(),
    );
    spyOn(popup, "resetErrors").mockImplementation(() => {});
    spyOn(document, "querySelector");

    popup.addElementListeners(mdListItem);
    cb(new Event("click"));
    cb1(new Event("input"));

    expect(clusterUrlTextField.setCustomValidity).toHaveBeenCalledTimes(1);
    expect(clusterUrlTextField.setCustomValidity).toHaveBeenCalledWith(
      'Provide URL as shown in "How to use"',
    );

    Object.defineProperty(clusterUrlTextField, "validity", {
      value: { patternMismatch: false },
      configurable: true,
    });
    cb1(new Event("input"));
    expect(clusterUrlTextField.setCustomValidity).toHaveBeenCalledTimes(2);
    expect(clusterUrlTextField.setCustomValidity).toHaveBeenCalledWith("");

    cb2(new Event("input"));

    expect(connectionUrlTextField.setCustomValidity).toHaveBeenCalledTimes(1);
    expect(connectionUrlTextField.setCustomValidity).toHaveBeenCalledWith(
      'Provide URL as shown in "How to use"',
    );

    Object.defineProperty(connectionUrlTextField, "validity", {
      value: { patternMismatch: false },
      configurable: true,
    });
    cb2(new Event("input"));
    expect(connectionUrlTextField.setCustomValidity).toHaveBeenCalledTimes(2);
    expect(connectionUrlTextField.setCustomValidity).toHaveBeenCalledWith("");

    cb3(new Event("click"));
    cb4(new Event("click"));

    expect(mdListItem.querySelector).toHaveBeenCalledTimes(6);
    expect(prevButton.addEventListener).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledWith(
      "cluster",
      "url",
      "password",
      "userName",
      "vpn",
    );
    expect(popup.currentConfig).toBe(0);
    expect(clusterUrlTextField.reportValidity).toHaveBeenCalledTimes(2);
    expect(connectionUrlTextField.reportValidity).toHaveBeenCalledTimes(2);
    expect(popup.saveConfiguration).toHaveBeenCalledTimes(1);
    expect(popup.deleteConfiguration).toHaveBeenCalledTimes(1);
    expect(popup.resetErrors).toHaveBeenCalledTimes(4);
  });

  test("test with prev and next button and trigger prev button two times", () => {
    const prevButton = document.createElement("md-icon-button");
    prevButton.classList.add("prev-config");
    mdListItem.appendChild(prevButton);
    let cb: (ev: Event) => any = () => {};
    spyOn(prevButton, "addEventListener").mockImplementation(
      (_type: string, listener: (ev: Event) => any) => {
        cb = listener;
      },
    );
    const nextButton = document.createElement("md-icon-button");
    nextButton.classList.add("next-config");
    mdListItem.appendChild(nextButton);
    const clusterUrlTextField = document.createElement(
      "md-outlined-text-field",
    );
    clusterUrlTextField.classList.add("cluster-url");
    mdListItem.appendChild(clusterUrlTextField);
    const connectionUrlTextField = document.createElement(
      "md-outlined-text-field",
    );
    connectionUrlTextField.classList.add("connection-url");
    mdListItem.appendChild(connectionUrlTextField);
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdListItem.appendChild(saveButton);
    const deleteButton = document.createElement("md-icon-button");
    deleteButton.classList.add("delete-button");
    mdListItem.appendChild(deleteButton);
    spyOn(mdListItem, "querySelector");
    popup.configs = [
      {
        clusterUrl: "cluster",
        password: "password",
        url: "url",
        userName: "userName",
        vpn: "vpn",
      },
      {
        clusterUrl: "cluster2",
        password: "password2",
        url: "url2",
        userName: "userName2",
        vpn: "vpn2",
      },
    ];
    popup.currentConfig = 1;
    spyOn(popup, "displayConfiguration").mockImplementation(() => {});

    popup.addElementListeners(mdListItem);
    cb(new Event("click"));
    cb(new Event("click"));

    expect(mdListItem.querySelector).toHaveBeenCalledTimes(6);
    expect(prevButton.addEventListener).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledTimes(2);
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      1,
      "cluster",
      "url",
      "password",
      "userName",
      "vpn",
    );
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      2,
      "cluster2",
      "url2",
      "password2",
      "userName2",
      "vpn2",
    );
    expect(popup.currentConfig).toBe(1);
  });

  test("test with prev and next button and trigger next button without overflow", () => {
    const prevButton = document.createElement("md-icon-button");
    prevButton.classList.add("prev-config");
    mdListItem.appendChild(prevButton);
    const nextButton = document.createElement("md-icon-button");
    nextButton.classList.add("next-config");
    mdListItem.appendChild(nextButton);
    let cb: (ev: Event) => any = () => {};
    spyOn(nextButton, "addEventListener").mockImplementation(
      (_type: string, listener: (ev: Event) => any) => {
        cb = listener;
      },
    );
    const clusterUrlTextField = document.createElement(
      "md-outlined-text-field",
    );
    clusterUrlTextField.classList.add("cluster-url");
    mdListItem.appendChild(clusterUrlTextField);
    const connectionUrlTextField = document.createElement(
      "md-outlined-text-field",
    );
    connectionUrlTextField.classList.add("connection-url");
    mdListItem.appendChild(connectionUrlTextField);
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdListItem.appendChild(saveButton);
    const deleteButton = document.createElement("md-icon-button");
    deleteButton.classList.add("delete-button");
    mdListItem.appendChild(deleteButton);
    spyOn(mdListItem, "querySelector");
    popup.configs = [
      {
        clusterUrl: "cluster",
        password: "password",
        url: "url",
        userName: "userName",
        vpn: "vpn",
      },
      {
        clusterUrl: "cluster2",
        password: "password2",
        url: "url2",
        userName: "userName2",
        vpn: "vpn2",
      },
    ];
    popup.currentConfig = 0;
    spyOn(popup, "displayConfiguration").mockImplementation(() => {});

    popup.addElementListeners(mdListItem);
    cb(new Event("click"));

    expect(mdListItem.querySelector).toHaveBeenCalledTimes(6);
    expect(nextButton.addEventListener).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledWith(
      "cluster2",
      "url2",
      "password2",
      "userName2",
      "vpn2",
    );
    expect(popup.currentConfig).toBe(1);
  });

  test("test with prev and next button and trigger next button two times", () => {
    const prevButton = document.createElement("md-icon-button");
    prevButton.classList.add("prev-config");
    mdListItem.appendChild(prevButton);
    const nextButton = document.createElement("md-icon-button");
    nextButton.classList.add("next-config");
    mdListItem.appendChild(nextButton);
    let cb: (ev: Event) => any = () => {};
    spyOn(nextButton, "addEventListener").mockImplementation(
      (_type: string, listener: (ev: Event) => any) => {
        cb = listener;
      },
    );
    const clusterUrlTextField = document.createElement(
      "md-outlined-text-field",
    );
    clusterUrlTextField.classList.add("cluster-url");
    mdListItem.appendChild(clusterUrlTextField);
    const connectionUrlTextField = document.createElement(
      "md-outlined-text-field",
    );
    connectionUrlTextField.classList.add("connection-url");
    mdListItem.appendChild(connectionUrlTextField);
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdListItem.appendChild(saveButton);
    const deleteButton = document.createElement("md-icon-button");
    deleteButton.classList.add("delete-button");
    mdListItem.appendChild(deleteButton);
    spyOn(mdListItem, "querySelector");
    popup.configs = [
      {
        clusterUrl: "cluster",
        password: "password",
        url: "url",
        userName: "userName",
        vpn: "vpn",
      },
      {
        clusterUrl: "cluster2",
        password: "password2",
        url: "url2",
        userName: "userName2",
        vpn: "vpn2",
      },
    ];
    popup.currentConfig = 0;
    spyOn(popup, "displayConfiguration").mockImplementation(() => {});

    popup.addElementListeners(mdListItem);
    cb(new Event("click"));
    cb(new Event("click"));

    expect(mdListItem.querySelector).toHaveBeenCalledTimes(6);
    expect(nextButton.addEventListener).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledTimes(2);
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      1,
      "cluster2",
      "url2",
      "password2",
      "userName2",
      "vpn2",
    );
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      2,
      "cluster",
      "url",
      "password",
      "userName",
      "vpn",
    );
    expect(popup.currentConfig).toBe(0);
  });

  test("test with prev and next button and trigger both multiple times", () => {
    const prevButton = document.createElement("md-icon-button");
    prevButton.classList.add("prev-config");
    mdListItem.appendChild(prevButton);
    let cb: (ev: Event) => any = () => {};
    spyOn(prevButton, "addEventListener").mockImplementation(
      (_type: string, listener: (ev: Event) => any) => {
        cb = listener;
      },
    );
    const nextButton = document.createElement("md-icon-button");
    nextButton.classList.add("next-config");
    mdListItem.appendChild(nextButton);
    let cb1: (ev: Event) => any = () => {};
    spyOn(nextButton, "addEventListener").mockImplementation(
      (_type: string, listener: (ev: Event) => any) => {
        cb1 = listener;
      },
    );
    const clusterUrlTextField = document.createElement(
      "md-outlined-text-field",
    );
    clusterUrlTextField.classList.add("cluster-url");
    mdListItem.appendChild(clusterUrlTextField);
    const connectionUrlTextField = document.createElement(
      "md-outlined-text-field",
    );
    connectionUrlTextField.classList.add("connection-url");
    mdListItem.appendChild(connectionUrlTextField);
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdListItem.appendChild(saveButton);
    const deleteButton = document.createElement("md-icon-button");
    deleteButton.classList.add("delete-button");
    mdListItem.appendChild(deleteButton);
    spyOn(mdListItem, "querySelector");
    popup.configs = [
      {
        clusterUrl: "cluster",
        password: "password",
        url: "url",
        userName: "userName",
        vpn: "vpn",
      },
      {
        clusterUrl: "cluster2",
        password: "password2",
        url: "url2",
        userName: "userName2",
        vpn: "vpn2",
      },
      {
        clusterUrl: "cluster3",
        password: "password3",
        url: "url3",
        userName: "userName3",
        vpn: "vpn3",
      },
    ];
    popup.currentConfig = 0;
    spyOn(popup, "displayConfiguration").mockImplementation(() => {});

    popup.addElementListeners(mdListItem);
    cb(new Event("click"));
    expect(popup.currentConfig).toBe(2);
    cb(new Event("click"));
    expect(popup.currentConfig).toBe(1);
    cb(new Event("click"));
    expect(popup.currentConfig).toBe(0);
    cb(new Event("click"));
    expect(popup.currentConfig).toBe(2);

    expect(mdListItem.querySelector).toHaveBeenCalledTimes(6);
    expect(prevButton.addEventListener).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      1,
      "cluster3",
      "url3",
      "password3",
      "userName3",
      "vpn3",
    );
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      2,
      "cluster2",
      "url2",
      "password2",
      "userName2",
      "vpn2",
    );
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      3,
      "cluster",
      "url",
      "password",
      "userName",
      "vpn",
    );
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      4,
      "cluster3",
      "url3",
      "password3",
      "userName3",
      "vpn3",
    );

    cb1(new Event("click"));
    expect(popup.currentConfig).toBe(0);
    cb1(new Event("click"));
    expect(popup.currentConfig).toBe(1);
    cb1(new Event("click"));
    expect(popup.currentConfig).toBe(2);
    cb1(new Event("click"));
    expect(popup.currentConfig).toBe(0);

    expect(nextButton.addEventListener).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledTimes(8);
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      5,
      "cluster",
      "url",
      "password",
      "userName",
      "vpn",
    );
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      6,
      "cluster2",
      "url2",
      "password2",
      "userName2",
      "vpn2",
    );
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      7,
      "cluster3",
      "url3",
      "password3",
      "userName3",
      "vpn3",
    );
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      8,
      "cluster",
      "url",
      "password",
      "userName",
      "vpn",
    );
  });
});

describe("resetErrors", () => {
  let clusterUrlTextField: MdOutlinedTextField;
  let connectionUrlTextField: MdOutlinedTextField;

  beforeEach(() => {
    clusterUrlTextField = document.createElement("md-outlined-text-field");
    clusterUrlTextField.classList.add("cluster-url");
    connectionUrlTextField = document.createElement("md-outlined-text-field");
    connectionUrlTextField.classList.add("connection-url");
  });

  test("test with nothing to do", () => {
    popup.credentialsErrorShown = false;

    popup.resetErrors(clusterUrlTextField, connectionUrlTextField);

    expect(popup.credentialsErrorShown).toBeFalse();
  });

  test("test with errors to reset", () => {
    popup.credentialsErrorShown = true;
    spyOn(clusterUrlTextField, "setCustomValidity");
    spyOn(clusterUrlTextField, "reportValidity").mockImplementation(() => true);
    spyOn(connectionUrlTextField, "setCustomValidity");
    spyOn(connectionUrlTextField, "reportValidity").mockImplementation(
      () => true,
    );

    popup.resetErrors(clusterUrlTextField, connectionUrlTextField);

    expect(popup.credentialsErrorShown).toBeFalse();
    expect(clusterUrlTextField.setCustomValidity).toHaveBeenCalledTimes(1);
    expect(clusterUrlTextField.setCustomValidity).toHaveBeenCalledWith("");
    expect(connectionUrlTextField.setCustomValidity).toHaveBeenCalledTimes(1);
    expect(connectionUrlTextField.setCustomValidity).toHaveBeenCalledWith("");
  });
});

describe("saveConfiguration", () => {
  let mdList: MdList;
  let clusterUrl: MdOutlinedTextField;
  let url: MdOutlinedTextField;

  beforeEach(() => {
    mdList = document.createElement("md-list");
    const mdListItem = document.createElement("md-list-item");
    clusterUrl = document.createElement("md-outlined-text-field");
    clusterUrl.classList.add("cluster-url");
    clusterUrl.value = "cluster";
    mdListItem.appendChild(clusterUrl);
    url = document.createElement("md-outlined-text-field");
    url.classList.add("connection-url");
    url.value = "url";
    mdListItem.appendChild(url);
    const password = document.createElement("md-outlined-text-field");
    password.classList.add("connection-password");
    password.value = "password";
    mdListItem.appendChild(password);
    const userName = document.createElement("md-outlined-text-field");
    userName.classList.add("connection-username");
    userName.value = "userName";
    mdListItem.appendChild(userName);
    const vpn = document.createElement("md-outlined-text-field");
    vpn.classList.add("connection-vpn");
    vpn.value = "vpn";
    mdListItem.appendChild(vpn);
    mdList.appendChild(mdListItem);
    document.body.appendChild(mdList);

    spyOn(popup, "displayConfiguration").mockImplementation(() => {});
  });

  afterEach(() => {
    mdList.remove();
  });

  test("test with invalid clusterUrl", async () => {
    spyOn(clusterUrl, "reportValidity").mockReturnValue(false);
    spyOn(url, "reportValidity");

    await popup.saveConfiguration();

    expect(url.reportValidity).toHaveBeenCalledTimes(0);
  });

  test("test with invalid connectionUrl", async () => {
    spyOn(clusterUrl, "reportValidity").mockReturnValue(true);
    spyOn(url, "reportValidity").mockReturnValue(false);
    spyOn(chrome.storage.local, "set");

    await popup.saveConfiguration();

    expect(chrome.storage.local.set).toHaveBeenCalledTimes(0);
  });

  test("test with valid clusterUrl and connectionUrl, but invalid credentials", async () => {
    popup.configs = [{}];
    popup.currentConfig = 0;
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdList.appendChild(saveButton);
    const progress = document.createElement("md-circular-progress");
    progress.classList.add("progress");
    mdList.appendChild(progress);
    spyOn(clusterUrl, "reportValidity").mockReturnValue(true);
    spyOn(clusterUrl, "setCustomValidity");
    spyOn(url, "reportValidity").mockReturnValue(true);
    spyOn(popup, "verifyCredentials").mockImplementation(() => {
      expect(saveButton.style.display).toBe("none");
      expect(progress.style.display).toBe("inline-flex");
      return Promise.resolve(false);
    });

    await popup.saveConfiguration();

    expect(saveButton.style.display).toBe("inline-flex");
    expect(progress.style.display).toBe("none");

    expect(clusterUrl.setCustomValidity).toHaveBeenCalledTimes(1);
    expect(clusterUrl.setCustomValidity).toHaveBeenCalledWith(
      "Invalid connection credentials",
    );
  });

  test("test with valid clusterUrl and connectionUrl and valid credentials", async () => {
    popup.configs = [{}];
    popup.currentConfig = 0;
    const mdListItem = document.createElement("md-list-item");
    mdListItem.classList.add("configurations");
    mdListItem.textContent = "No Configurations";
    const mdIconButton = document.createElement("md-icon-button");
    mdListItem.appendChild(mdIconButton);
    mdList.appendChild(mdListItem);
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdList.appendChild(saveButton);
    const progress = document.createElement("md-circular-progress");
    progress.classList.add("progress");
    mdList.appendChild(progress);
    spyOn(clusterUrl, "reportValidity").mockReturnValue(true);
    spyOn(clusterUrl, "setCustomValidity");
    spyOn(url, "reportValidity").mockReturnValue(true);
    spyOn(chrome.storage.local, "get").mockImplementation(() => {
      return Promise.resolve({
        clusterUrls: ["cluster"],
      });
    });
    spyOn(chrome.storage.local, "set");
    spyOn(popup, "verifyCredentials").mockImplementation(() => {
      expect(saveButton.style.display).toBe("none");
      expect(progress.style.display).toBe("inline-flex");
      return Promise.resolve(true);
    });

    await popup.saveConfiguration();

    expect(saveButton.style.display).toBe("inline-flex");
    expect(progress.style.display).toBe("none");

    expect(chrome.storage.local.get).toHaveBeenCalledTimes(1);
    expect(chrome.storage.local.get).toHaveBeenCalledWith("clusterUrls");
    // One write, so credentials are stored together with the cluster url
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      clusterUrls: ["cluster"],
      "cluster.password": "password",
      "cluster.url": "url",
      "cluster.userName": "userName",
      "cluster.vpn": "vpn",
    });
    expect(popup.displayConfiguration).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledWith(
      "cluster",
      "url",
      "password",
      "userName",
      "vpn",
    );
  });

  test("test with first-time use case (no clusterUrls in storage)", async () => {
    popup.configs = [{}];
    popup.currentConfig = 0;
    const mdListItem = document.createElement("md-list-item");
    mdListItem.classList.add("configurations");
    mdListItem.textContent = "No Configurations";
    const mdIconButton = document.createElement("md-icon-button");
    mdListItem.appendChild(mdIconButton);
    mdList.appendChild(mdListItem);
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdList.appendChild(saveButton);
    const progress = document.createElement("md-circular-progress");
    progress.classList.add("progress");
    mdList.appendChild(progress);
    spyOn(clusterUrl, "reportValidity").mockReturnValue(true);
    spyOn(url, "reportValidity").mockReturnValue(true);
    spyOn(chrome.storage.local, "get").mockImplementation(() => {
      return Promise.resolve({});
    });
    spyOn(chrome.storage.local, "set");
    spyOn(popup, "verifyCredentials").mockImplementation(() =>
      Promise.resolve(true),
    );

    await popup.saveConfiguration();

    expect(chrome.storage.local.get).toHaveBeenCalledTimes(1);
    expect(chrome.storage.local.get).toHaveBeenCalledWith("clusterUrls");
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      clusterUrls: ["cluster"],
      "cluster.password": "password",
      "cluster.url": "url",
      "cluster.userName": "userName",
      "cluster.vpn": "vpn",
    });
  });

  test("test that configs array is properly updated after saving", async () => {
    popup.configs = [{ clusterUrl: "old-cluster" }];
    popup.currentConfig = 0;
    const mdListItem = document.createElement("md-list-item");
    mdListItem.classList.add("configurations");
    mdListItem.textContent = "No Configurations";
    const mdIconButton = document.createElement("md-icon-button");
    mdListItem.appendChild(mdIconButton);
    mdList.appendChild(mdListItem);
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdList.appendChild(saveButton);
    const progress = document.createElement("md-circular-progress");
    progress.classList.add("progress");
    mdList.appendChild(progress);
    spyOn(clusterUrl, "reportValidity").mockReturnValue(true);
    spyOn(url, "reportValidity").mockReturnValue(true);
    spyOn(chrome.storage.local, "get").mockImplementation(() => {
      return Promise.resolve({ clusterUrls: ["old-cluster"] });
    });
    spyOn(chrome.storage.local, "set");
    spyOn(chrome.storage.local, "remove");
    spyOn(popup, "verifyCredentials").mockImplementation(() =>
      Promise.resolve(true),
    );

    await popup.saveConfiguration();

    expect(popup.configs[0]).toEqual({
      clusterUrl: "cluster",
      password: "password",
      url: "url",
      userName: "userName",
      vpn: "vpn",
    });
    // The changed cluster url replaces the old one instead of keeping both
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      clusterUrls: ["cluster"],
      "cluster.password": "password",
      "cluster.url": "url",
      "cluster.userName": "userName",
      "cluster.vpn": "vpn",
    });
    expect(chrome.storage.local.remove).toHaveBeenCalledTimes(1);
    expect(chrome.storage.local.remove).toHaveBeenCalledWith([
      "old-cluster.password",
      "old-cluster.url",
      "old-cluster.userName",
      "old-cluster.vpn",
    ]);
  });

  test("test if editing the credentials of a cluster keeps the configuration", async () => {
    popup.configs = [{ clusterUrl: "cluster", password: "old password" }];
    popup.currentConfig = 0;
    const mdListItem = document.createElement("md-list-item");
    mdListItem.classList.add("configurations");
    const mdIconButton = document.createElement("md-icon-button");
    mdListItem.appendChild(mdIconButton);
    mdList.appendChild(mdListItem);
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdList.appendChild(saveButton);
    const progress = document.createElement("md-circular-progress");
    progress.classList.add("progress");
    mdList.appendChild(progress);
    spyOn(clusterUrl, "reportValidity").mockReturnValue(true);
    spyOn(url, "reportValidity").mockReturnValue(true);
    spyOn(chrome.storage.local, "get").mockImplementation(() => {
      return Promise.resolve({ clusterUrls: ["cluster", "other"] });
    });
    spyOn(chrome.storage.local, "set");
    spyOn(chrome.storage.local, "remove");
    spyOn(popup, "verifyCredentials").mockImplementation(() =>
      Promise.resolve(true),
    );

    await popup.saveConfiguration();

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      clusterUrls: ["cluster", "other"],
      "cluster.password": "password",
      "cluster.url": "url",
      "cluster.userName": "userName",
      "cluster.vpn": "vpn",
    });
    expect(chrome.storage.local.remove).toHaveBeenCalledTimes(0);
  });
});

describe("verifyCredentials", () => {
  test("test with invalid credential types", async () => {
    spyOn(SolclientFactory, "createSession").mockImplementation(() => {
      throw new Error("error");
    });

    const result = await popup.verifyCredentials(
      "password",
      "url",
      "userName",
      "vpnName",
    );

    expect(result).toBeFalse();
  });

  test("test with invalid credentials", async () => {
    let cb: () => void = () => {};
    const session = {
      connect: mock(),
      on: (event: SessionEventCode, listener: () => void) => {
        if (event === SessionEventCode.CONNECT_FAILED_ERROR) {
          cb = listener;
        }
      },
      dispose: mock(),
    } as unknown as Session;

    spyOn(SolclientFactory, "createSession").mockImplementation(() => session);

    const result = popup.verifyCredentials(
      "password",
      "url",
      "userName",
      "vpnName",
    );
    cb();

    expect(await result).toBeFalse();
    expect(session.dispose).toHaveBeenCalledTimes(1);
  });

  test("test with valid credentials", async () => {
    let cb: () => void = () => {};
    const session = {
      connect: mock(),
      on: (event: SessionEventCode, listener: () => void) => {
        if (event === SessionEventCode.UP_NOTICE) {
          cb = listener;
        }
      },
      disconnect: mock(),
      dispose: mock(),
    } as unknown as Session;

    spyOn(SolclientFactory, "createSession").mockImplementation(() => session);

    const result = popup.verifyCredentials(
      "password",
      "url",
      "userName",
      "vpnName",
    );
    cb();

    expect(await result).toBeTrue();
    expect(session.disconnect).toHaveBeenCalledTimes(1);
    expect(session.dispose).toHaveBeenCalledTimes(1);
  });
});

describe("deleteConfiguration", () => {
  beforeEach(() => {
    spyOn(chrome.storage.local, "set").mockImplementation(() =>
      Promise.resolve(),
    );
    spyOn(chrome.storage.local, "remove").mockImplementation(() =>
      Promise.resolve(),
    );
    spyOn(popup, "displayConfiguration").mockImplementation(() => {});
  });

  test("test with only one config", async () => {
    popup.configs = [
      {
        clusterUrl: "cluster",
        password: "password",
        url: "url",
        userName: "userName",
        vpn: "vpn",
      },
    ];
    const mdListItem = document.createElement("md-list-item");
    mdListItem.classList.add("configurations");
    mdListItem.textContent = "No Configurations";
    const mdIconButton = document.createElement("md-icon-button");
    mdListItem.appendChild(mdIconButton);
    document.body.appendChild(mdListItem);
    spyOn(chrome.storage.local, "get").mockImplementation(() =>
      Promise.resolve({
        clusterUrls: ["cluster"],
      }),
    );

    await popup.deleteConfiguration();

    expect(chrome.storage.local.get).toHaveBeenCalledTimes(1);
    expect(chrome.storage.local.get).toHaveBeenCalledWith("clusterUrls");
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      clusterUrls: [],
    });
    expect(chrome.storage.local.remove).toHaveBeenCalledTimes(1);
    expect(chrome.storage.local.remove).toHaveBeenCalledWith([
      "cluster.password",
      "cluster.url",
      "cluster.userName",
      "cluster.vpn",
    ]);
    expect(popup.displayConfiguration).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledWith();
    expect(popup.configs).toHaveLength(0);
  });

  const firstConfig = {
    clusterUrl: "cluster",
    password: "password",
    url: "url",
    userName: "userName",
    vpn: "vpn",
  };
  const secondConfig = {
    clusterUrl: "cluster2",
    password: "password2",
    url: "url2",
    userName: "userName2",
    vpn: "vpn2",
  };

  test.each([
    {
      name: "first",
      currentConfig: 0,
      storedUrls: ["cluster2"],
      removedKeys: [
        "cluster.password",
        "cluster.url",
        "cluster.userName",
        "cluster.vpn",
      ],
      remaining: secondConfig,
    },
    {
      name: "second",
      currentConfig: 1,
      storedUrls: ["cluster"],
      removedKeys: [
        "cluster2.password",
        "cluster2.url",
        "cluster2.userName",
        "cluster2.vpn",
      ],
      remaining: firstConfig,
    },
  ])(
    "test with two configs and deleting the $name one",
    async ({ currentConfig, storedUrls, removedKeys, remaining }) => {
      popup.currentConfig = currentConfig;
      popup.configs = [{ ...firstConfig }, { ...secondConfig }];
      spyOn(chrome.storage.local, "get").mockImplementation(() =>
        Promise.resolve({
          clusterUrls: ["cluster", "cluster2"],
        }),
      );
      const configurations = document.createElement("md-list-item");
      spyOn(document, "querySelector").mockReturnValue(configurations);

      await popup.deleteConfiguration();

      expect(chrome.storage.local.get).toHaveBeenCalledTimes(1);
      expect(chrome.storage.local.get).toHaveBeenCalledWith("clusterUrls");
      expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        clusterUrls: storedUrls,
      });
      expect(chrome.storage.local.remove).toHaveBeenCalledTimes(1);
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(removedKeys);
      expect(configurations.textContent).toBe("Configurations (1)");
      expect(popup.currentConfig).toBe(0);
      expect(popup.displayConfiguration).toHaveBeenCalledTimes(1);
      expect(popup.displayConfiguration).toHaveBeenCalledWith(
        remaining.clusterUrl,
        remaining.url,
        remaining.password,
        remaining.userName,
        remaining.vpn,
      );
      expect(popup.configs).toHaveLength(1);
      expect(popup.configs[0]).toEqual(remaining);
    },
  );

  // Regression: deleting one of several configurations removed the add button,
  // deleting the last one then failed and kept showing its credentials
  test("test if deleting all configurations keeps the add button and clears the form", async () => {
    const panel = document.createElement("div");
    panel.id = "settings-panel";
    const list = document.createElement("md-list");
    panel.appendChild(list);
    const header = document.createElement("md-list-item");
    header.classList.add("configurations");
    header.textContent = "Configurations (2)";
    const addButton = document.createElement("md-icon-button");
    header.appendChild(addButton);
    list.appendChild(header);
    // In front of elements other tests left behind, the popup queries the first match
    document.body.prepend(panel);
    popup.configs = [
      {
        clusterUrl: "cluster1",
        url: "url1",
        password: "password1",
        userName: "userName1",
        vpn: "vpn1",
      },
      {
        clusterUrl: "cluster2",
        url: "url2",
        password: "password2",
        userName: "userName2",
        vpn: "vpn2",
      },
    ];
    popup.currentConfig = 1;
    spyOn(chrome.storage.local, "get").mockImplementation(() =>
      Promise.resolve({ clusterUrls: ["cluster1", "cluster2"] }),
    );

    try {
      await popup.deleteConfiguration();

      expect(header.textContent).toBe("Configurations (1)");
      expect(header.contains(addButton)).toBeTrue();
      expect(popup.displayConfiguration).toHaveBeenLastCalledWith(
        "cluster1",
        "url1",
        "password1",
        "userName1",
        "vpn1",
      );

      await popup.deleteConfiguration();

      expect(header.textContent).toBe("No Configurations");
      expect(header.contains(addButton)).toBeTrue();
      // An empty form, not the credentials of the deleted configuration
      expect(popup.displayConfiguration).toHaveBeenCalledTimes(2);
      expect(popup.displayConfiguration).toHaveBeenLastCalledWith();
    } finally {
      panel.remove();
    }
  });
});

describe("addSecondaryTabsListener", () => {
  test("test with no secondary tabs", () => {
    spyOn(Element.prototype, "getAttribute");

    popup.addSecondaryTabsListener();

    expect(Element.prototype.getAttribute).toHaveBeenCalledTimes(0);
  });

  test("test with secondary tabs and change event", () => {
    const mdList = document.createElement("div") as unknown as MdList;
    const panel = document.createElement("div");
    panel.id = "errors-panel";
    mdList.appendChild(panel);
    popup.secondaryTabs = {
      activeTab: {
        getAttribute: () => "errors-panel",
      },
      parentElement: mdList,
      addEventListener: (type: string, cb: (event: Event) => void) => {},
    } as unknown as MdTabs;
    let listener = (event: Event) => {};
    spyOn(popup.secondaryTabs, "addEventListener").mockImplementation(
      (type: string, cb: (event: Event) => void) => {
        listener = cb;
      },
    );

    popup.addSecondaryTabsListener();
    listener(new Event("change"));

    expect(popup.secondaryTabs.addEventListener).toHaveBeenCalledTimes(1);
    expect(popup.secondaryPanelId).toBe("errors-panel");
    expect(popup.currentSecondaryPanel?.hidden).toBeFalse();
  });
});
