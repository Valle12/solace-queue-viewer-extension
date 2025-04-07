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
import { Popup } from "../src/popup/popup";
import type { MessageResponse } from "../src/types";

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
      Promise.resolve()
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
      }
    );
    spyOn(document, "querySelector").mockReturnValue(div);
    popup.tabs = {
      activeTab: {
        getAttribute: () => "infos-panel",
      },
      getRootNode: () => document,
      addEventListener: () => {},
    } as unknown as MdTabs;

    popup.addListeners();
    listener(new Event("DOMContentLoaded"));

    expect(popup.panelId).toBe("infos-panel");
    expect(popup.root).toEqual(document);
    expect(popup.currentPanel).toEqual(div);
  });

  test("test if code executes if tab change event is fired with no panel yet", () => {
    let listener: (ev: Event) => void = () => {};
    spyOn(document, "addEventListener").mockImplementation(() => {});
    popup.tabs = {
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

    expect(popup.panelId).toBe("infos-panel");
    expect(popup.root).toEqual(document);
    expect(popup.currentPanel).toBeNull();
  });

  test("test if code executes if tab change event is fired with panel already set", () => {
    let listener: (ev: Event) => void = () => {};
    let div = document.createElement("div");
    spyOn(document, "addEventListener").mockImplementation(() => {});
    spyOn(document, "querySelector").mockReturnValue(div);
    popup.currentPanel = div;
    popup.tabs = {
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

    expect(popup.panelId).toBe("infos-panel");
    expect(popup.root).toEqual(document);
    expect(popup.currentPanel.hidden).toBeFalse();
  });
});

describe("getData", () => {
  afterEach(() => {
    mock.restore();
  });

  test("test if it has no info, no errors and no storage entries", async () => {
    const infoList = document.createElement("md-list");
    const errorsList = document.createElement("md-list");
    spyOn(globalThis.chrome.runtime, "sendMessage").mockReturnValue(
      Promise.resolve({ info: "", errors: [] } as MessageResponse)
    );
    spyOn(chrome.storage.local, "get").mockImplementation(() => {
      return Promise.resolve({});
    });
    spyOn(document, "querySelector").mockImplementation((selectors: string) => {
      if (selectors.includes("#infos-panel")) return infoList;
      return errorsList;
    });
    spyOn(Array.prototype, "pop");

    await popup.getData();

    expect(infoList.querySelector("md-list-item")?.textContent).toBe("No info");
    expect(errorsList.querySelector("md-list-item")?.textContent).toBe(
      "No errors"
    );
    expect(Array.prototype.pop).toHaveBeenCalledTimes(0);
  });

  test("test if it has info, one error and one full storage entry", async () => {
    const infoList = document.createElement("md-list");
    const errorsList = document.createElement("md-list");
    spyOn(globalThis.chrome.runtime, "sendMessage").mockReturnValue(
      Promise.resolve({
        info: "Test Info",
        errors: ["Test Error"],
      } as MessageResponse)
    );
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
      "Last info: Test Info"
    );
    errorsList
      .querySelectorAll("md-list-item")
      .forEach((item, key, _parent) => {
        if (key === 0) expect(item.textContent).toBe("Last errors");
        else expect(item.textContent).toBe("Test Error");
      });
    expect(popup.configs.length).toBe(1);
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
    spyOn(globalThis.chrome.runtime, "sendMessage").mockReturnValue(
      Promise.resolve({
        info: "Test Info",
        errors: ["Test Error 1", "Test Error 2"],
      } as MessageResponse)
    );
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
      "Last info: Test Info"
    );
    const items = errorsList.querySelectorAll("md-list-item");
    expect(items.length).toBe(3);
    items.forEach((item, key, _parent) => {
      if (key === 0) expect(item.textContent).toBe("Last errors");
      if (key === 1) expect(item.textContent).toBe("Test Error 1");
      if (key === 2) expect(item.textContent).toBe("Test Error 2");
    });
    expect(popup.configs.length).toBe(2);
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
      }
    );
    spyOn(popup, "displayConfiguration").mockImplementation(() => {});
  });

  afterEach(() => {
    mock.restore();
  });

  test("test if no configurations are saved and click on new config", () => {
    popup.setupCredentialsPanel();
    cb(new Event("click"));

    expect(list.querySelector("md-list-item")?.textContent).toBe(
      "No Configurationsadd"
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
      "Configurations (1)add"
    );
    expect(popup.currentConfig).toBe(0);
    expect(popup.displayConfiguration).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledWith(
      "cluster",
      "url",
      "password",
      "userName",
      "vpn"
    );
  });

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
        [tf1, tf2, tf3, tf4, tf5] as unknown as NodeListOf<MdOutlinedTextField>
    );
    spyOn(tf1, "addEventListener").mockImplementation(
      (_type: any, listener: (ev: Event) => any) => {
        cb = listener;
      }
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
      "Configurations (3)add"
    );
    expect(popup.currentConfig).toBe(2);
    expect(popup.displayConfiguration).toHaveBeenCalledTimes(2);
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      1,
      "cluster",
      "url",
      "password",
      "userName",
      "vpn"
    );
  });
});

describe("displayConfiguration", () => {
  let previousConfiguration: MdListItem;
  let mdList: MdList;

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

  afterEach(() => {
    mock.restore();
  });

  test("test with active configuration and empty config", () => {
    popup.configs = [{}];

    popup.displayConfiguration();

    expect(previousConfiguration.remove).toHaveBeenCalledTimes(1);

    mock.restore();
    const mdListItem = mdList.querySelector("md-list-item") as MdListItem;
    const children = Array.from(mdListItem.children).filter(child =>
      child.matches("md-icon-button")
    );
    expect(children.length).toBe(0);
    expect(mdListItem?.querySelectorAll("md-list").length).toBe(1);
    const textfields = mdListItem?.querySelectorAll("md-outlined-text-field");
    expect(textfields?.length).toBe(5);
    textfields?.forEach((textfield, _key, _parent) => {
      expect(textfield.value).toBeEmpty();
    });
  });

  test("test with active configuration and one filled config", () => {
    popup.configs = [{}];

    popup.displayConfiguration("cluster", "url", "password", "userName", "vpn");

    expect(previousConfiguration.remove).toHaveBeenCalledTimes(1);

    mock.restore();
    const mdListItem = mdList.querySelector("md-list-item") as MdListItem;
    const children = Array.from(mdListItem.children).filter(child =>
      child.matches("md-icon-button")
    );
    expect(children.length).toBe(0);
    expect(mdListItem?.querySelectorAll("md-list").length).toBe(1);
    const textfields = mdListItem?.querySelectorAll("md-outlined-text-field");
    expect(textfields?.length).toBe(5);
    textfields?.forEach((textfield, key, _parent) => {
      if (key === 0) expect(textfield.value).toBe("cluster");
      if (key === 1) expect(textfield.value).toBe("url");
      if (key === 2) expect(textfield.value).toBe("password");
      if (key === 3) expect(textfield.value).toBe("userName");
      if (key === 4) expect(textfield.value).toBe("vpn");
    });
  });

  test("test with active configuration and two configs", () => {
    popup.configs = [{}, {}];

    popup.displayConfiguration("cluster", "url", "password", "userName", "vpn");

    expect(previousConfiguration.remove).toHaveBeenCalledTimes(1);

    mock.restore();
    const mdListItem = mdList.querySelector("md-list-item") as MdListItem;
    const children = Array.from(mdListItem.children).filter(child =>
      child.matches("md-icon-button")
    );
    expect(children.length).toBe(2);
    expect(mdListItem?.querySelectorAll("md-list").length).toBe(1);
    const textfields = mdListItem?.querySelectorAll("md-outlined-text-field");
    expect(textfields?.length).toBe(5);
    textfields?.forEach((textfield, key, _parent) => {
      if (key === 0) expect(textfield.value).toBe("cluster");
      if (key === 1) expect(textfield.value).toBe("url");
      if (key === 2) expect(textfield.value).toBe("password");
      if (key === 3) expect(textfield.value).toBe("userName");
      if (key === 4) expect(textfield.value).toBe("vpn");
    });
  });
});

describe("addElementListeners", () => {
  let mdListItem: MdListItem;

  beforeEach(() => {
    mdListItem = document.createElement("md-list-item");
  });

  afterEach(() => {
    mock.restore();
  });

  test("test with no prev and no next button and no clicks", () => {
    const clusterUrlHelp = document.createElement("md-icon-button");
    clusterUrlHelp.classList.add("cluster-url-help");
    mdListItem.appendChild(clusterUrlHelp);
    const clusterUrlTextField = document.createElement(
      "md-outlined-text-field"
    );
    clusterUrlTextField.classList.add("cluster-url");
    mdListItem.appendChild(clusterUrlTextField);
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdListItem.appendChild(saveButton);
    spyOn(mdListItem, "querySelector");

    popup.addElementListeners(mdListItem);

    expect(mdListItem.querySelector).toHaveBeenCalledTimes(5);
  });

  test("test with prev and next button and trigger button without overflow and textfield events", () => {
    const prevButton = document.createElement("md-icon-button");
    prevButton.classList.add("prev-config");
    mdListItem.appendChild(prevButton);
    let cb: (ev: Event) => any = () => {};
    spyOn(prevButton, "addEventListener").mockImplementation(
      (_type: string, listener: (ev: Event) => any) => {
        cb = listener;
      }
    );
    const nextButton = document.createElement("md-icon-button");
    nextButton.classList.add("next-config");
    mdListItem.appendChild(nextButton);
    const clusterUrlHelp = document.createElement("md-icon-button");
    clusterUrlHelp.classList.add("cluster-url-help");
    mdListItem.appendChild(clusterUrlHelp);
    let cb1: (ev: Event) => any = () => {};
    spyOn(clusterUrlHelp, "addEventListener").mockImplementation(
      (_type: string, listener: (ev: Event) => any) => {
        cb1 = listener;
      }
    );
    const clusterUrlTextField = document.createElement(
      "md-outlined-text-field"
    );
    clusterUrlTextField.classList.add("cluster-url");
    mdListItem.appendChild(clusterUrlTextField);
    let cb2: (ev: Event) => any = () => {};
    spyOn(clusterUrlTextField, "addEventListener").mockImplementation(
      (_type: string, listener: (ev: Event) => any) => {
        cb2 = listener;
      }
    );
    spyOn(clusterUrlTextField, "reportValidity").mockReturnValue(true);
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdListItem.appendChild(saveButton);
    let cb3: (ev: Event) => any = () => {};
    spyOn(saveButton, "addEventListener").mockImplementation(
      (_type: string, listener: (ev: Event) => any) => {
        cb3 = listener;
      }
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
      Promise.resolve()
    );
    spyOn(document, "querySelector");

    popup.addElementListeners(mdListItem);
    cb(new Event("click"));
    cb1(new Event("click"));
    cb2(new Event("input"));
    cb3(new Event("click"));

    expect(mdListItem.querySelector).toHaveBeenCalledTimes(5);
    expect(prevButton.addEventListener).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledWith(
      "cluster",
      "url",
      "password",
      "userName",
      "vpn"
    );
    expect(popup.currentConfig).toBe(0);
    expect(document.querySelector).toHaveBeenCalledTimes(1);
    expect(clusterUrlTextField.reportValidity).toHaveBeenCalledTimes(1);
    expect(popup.saveConfiguration).toHaveBeenCalledTimes(1);
  });

  test("test with prev and next button and trigger prev button two times", () => {
    const prevButton = document.createElement("md-icon-button");
    prevButton.classList.add("prev-config");
    mdListItem.appendChild(prevButton);
    let cb: (ev: Event) => any = () => {};
    spyOn(prevButton, "addEventListener").mockImplementation(
      (_type: string, listener: (ev: Event) => any) => {
        cb = listener;
      }
    );
    const nextButton = document.createElement("md-icon-button");
    nextButton.classList.add("next-config");
    mdListItem.appendChild(nextButton);
    const clusterUrlHelp = document.createElement("md-icon-button");
    clusterUrlHelp.classList.add("cluster-url-help");
    mdListItem.appendChild(clusterUrlHelp);
    const clusterUrlTextField = document.createElement(
      "md-outlined-text-field"
    );
    clusterUrlTextField.classList.add("cluster-url");
    mdListItem.appendChild(clusterUrlTextField);
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdListItem.appendChild(saveButton);
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

    expect(mdListItem.querySelector).toHaveBeenCalledTimes(5);
    expect(prevButton.addEventListener).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledTimes(2);
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      1,
      "cluster",
      "url",
      "password",
      "userName",
      "vpn"
    );
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      2,
      "cluster2",
      "url2",
      "password2",
      "userName2",
      "vpn2"
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
      }
    );
    const clusterUrlHelp = document.createElement("md-icon-button");
    clusterUrlHelp.classList.add("cluster-url-help");
    mdListItem.appendChild(clusterUrlHelp);
    const clusterUrlTextField = document.createElement(
      "md-outlined-text-field"
    );
    clusterUrlTextField.classList.add("cluster-url");
    mdListItem.appendChild(clusterUrlTextField);
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdListItem.appendChild(saveButton);
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

    expect(mdListItem.querySelector).toHaveBeenCalledTimes(5);
    expect(nextButton.addEventListener).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledWith(
      "cluster2",
      "url2",
      "password2",
      "userName2",
      "vpn2"
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
      }
    );
    const clusterUrlHelp = document.createElement("md-icon-button");
    clusterUrlHelp.classList.add("cluster-url-help");
    mdListItem.appendChild(clusterUrlHelp);
    const clusterUrlTextField = document.createElement(
      "md-outlined-text-field"
    );
    clusterUrlTextField.classList.add("cluster-url");
    mdListItem.appendChild(clusterUrlTextField);
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdListItem.appendChild(saveButton);
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

    expect(mdListItem.querySelector).toHaveBeenCalledTimes(5);
    expect(nextButton.addEventListener).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenCalledTimes(2);
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      1,
      "cluster2",
      "url2",
      "password2",
      "userName2",
      "vpn2"
    );
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      2,
      "cluster",
      "url",
      "password",
      "userName",
      "vpn"
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
      }
    );
    const nextButton = document.createElement("md-icon-button");
    nextButton.classList.add("next-config");
    mdListItem.appendChild(nextButton);
    let cb1: (ev: Event) => any = () => {};
    spyOn(nextButton, "addEventListener").mockImplementation(
      (_type: string, listener: (ev: Event) => any) => {
        cb1 = listener;
      }
    );
    const clusterUrlHelp = document.createElement("md-icon-button");
    clusterUrlHelp.classList.add("cluster-url-help");
    mdListItem.appendChild(clusterUrlHelp);
    const clusterUrlTextField = document.createElement(
      "md-outlined-text-field"
    );
    clusterUrlTextField.classList.add("cluster-url");
    mdListItem.appendChild(clusterUrlTextField);
    const saveButton = document.createElement("md-icon-button");
    saveButton.classList.add("save-button");
    mdListItem.appendChild(saveButton);
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

    expect(mdListItem.querySelector).toHaveBeenCalledTimes(5);
    expect(prevButton.addEventListener).toHaveBeenCalledTimes(1);
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      1,
      "cluster3",
      "url3",
      "password3",
      "userName3",
      "vpn3"
    );
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      2,
      "cluster2",
      "url2",
      "password2",
      "userName2",
      "vpn2"
    );
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      3,
      "cluster",
      "url",
      "password",
      "userName",
      "vpn"
    );
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      4,
      "cluster3",
      "url3",
      "password3",
      "userName3",
      "vpn3"
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
      "vpn"
    );
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      6,
      "cluster2",
      "url2",
      "password2",
      "userName2",
      "vpn2"
    );
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      7,
      "cluster3",
      "url3",
      "password3",
      "userName3",
      "vpn3"
    );
    expect(popup.displayConfiguration).toHaveBeenNthCalledWith(
      8,
      "cluster",
      "url",
      "password",
      "userName",
      "vpn"
    );
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
  });

  afterEach(() => {
    mdList.remove();
    mock.restore();
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

    await popup.saveConfiguration();

    expect(chrome.storage.local.set).toHaveBeenCalledTimes(0);
  });

  test("test with valid clusterUrl and connectionUrl", async () => {
    popup.configs = [{}];
    popup.currentConfig = 0;
    spyOn(clusterUrl, "reportValidity").mockReturnValue(true);
    spyOn(url, "reportValidity").mockReturnValue(true);
    spyOn(chrome.storage.local, "get").mockImplementation(() => {
      return Promise.resolve({
        clusterUrls: ["cluster"],
      });
    });

    await popup.saveConfiguration();

    expect(chrome.storage.local.get).toHaveBeenCalledTimes(1);
    expect(chrome.storage.local.get).toHaveBeenCalledWith("clusterUrls");
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(2);
    expect(chrome.storage.local.set).toHaveBeenNthCalledWith(1, {
      clusterUrls: ["cluster"],
    });
    expect(chrome.storage.local.set).toHaveBeenNthCalledWith(2, {
      "cluster.password": "password",
      "cluster.url": "url",
      "cluster.userName": "userName",
      "cluster.vpn": "vpn",
    });
  });
});
