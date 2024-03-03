import {
  ChromeMessage,
  ChromeMessageType,
  MessageConstant,
} from "../scripts/types";
import { chrome } from "jest-chrome";
import { vi as jest } from "vitest";
import { Solace } from "../scripts/solace";
import solace from "solclientjs";

describe("Solace", () => {
  let solaceInstance: Solace;

  beforeEach(() => {
    // clearListeners is required here, because the manifest gets executed and so an instance of solace is started, but without having a reference to it
    chrome.runtime.onMessage.clearListeners();
    solaceInstance = new Solace();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create a new Solace instance", () => {
    expect(solaceInstance).toBeDefined();
  });

  it("should set startReceiving to null to false on invalid url", () => {
    let message = {
      to: ChromeMessageType.SOLACE,
      from: ChromeMessageType.BACKGROUND,
      message: MessageConstant.MESSAGES_QUEUED_URL_CHECK_FALSE,
    } as ChromeMessage;

    solaceInstance.startReceiving = document.createElement("button");
    expect(solaceInstance.startReceiving).not.toBeNull();
    chrome.runtime.onMessage.callListeners(message, {}, () => {});
    expect(solaceInstance.startReceiving).toBeNull();
  });

  it("should execute insertPlayButton method on valid url", () => {
    let message = {
      to: ChromeMessageType.SOLACE,
      from: ChromeMessageType.BACKGROUND,
      message: MessageConstant.MESSAGES_QUEUED_URL_CHECK,
    } as ChromeMessage;

    let insertPlayButtonMethod = jest
      .spyOn(solaceInstance, "insertPlayButton")
      .mockImplementation(() => Promise.resolve());
    chrome.runtime.onMessage.callListeners(message, {}, () => {});
    expect(insertPlayButtonMethod).toHaveBeenCalledTimes(1);
  });

  it("should execute loadConfig method on click event", () => {
    let loadConfigMethod = jest
      .spyOn(solaceInstance, "loadConfig")
      .mockImplementation(() => Promise.resolve());
    document.body.click();
    expect(loadConfigMethod).toHaveBeenCalledTimes(1);
  });

  it("should execute loadConfig without doing anything", () => {
    solaceInstance.configLoaded = true;
    solaceInstance.loadConfig();
    expect(solaceInstance.configLoaded).toBeTruthy();
  });

  it("should execute loadConfig and set solaceConfig", async () => {
    expect(solaceInstance.solaceConfig).toBeUndefined();
    let div = document.createElement("div");
    div.innerText = "test";
    jest.spyOn(document, "querySelector").mockReturnValue(div);

    let obj = {
      "solaceQueueViewerExtension.test.host": "host",
      "solaceQueueViewerExtension.test.password": "password",
      "solaceQueueViewerExtension.test.vpn": "vpn",
      "solaceQueueViewerExtension.test.username": "username",
    };

    jest.spyOn(chrome.storage.local, "get").mockImplementation((_keys) => {
      return obj;
    });

    await solaceInstance.loadConfig();
    expect(solaceInstance.solaceConfig).toBeDefined();
    expect(solaceInstance.solaceConfig.host).toEqual("host");
    expect(solaceInstance.solaceConfig.password).toEqual("password");
    expect(solaceInstance.solaceConfig.vpn).toEqual("vpn");
    expect(solaceInstance.solaceConfig.username).toEqual("username");
    expect(solaceInstance.configLoaded).toBeTruthy();
  });

  it("should execute insertPlayButton and just remove start button", () => {
    solaceInstance.startReceiving = document.createElement("button");
    let removerButtonMock = jest.spyOn(solaceInstance, "removeButton");

    solaceInstance.insertPlayButton();

    expect(solaceInstance.startReceiving).toBeNull();
    expect(removerButtonMock).toHaveBeenCalledTimes(1);
  });

  it("should execute insertPlayButton and insert buttons, no action yet", () => {
    let button = document.createElement("button");
    let i = document.createElement("i");
    let createElementMock = jest.spyOn(document, "createElement");
    createElementMock.mockImplementation((tagName) => {
      if (tagName === "button") {
        return button;
      }

      return i;
    });

    createElementMock.mockRestore();
    let actionPanel = document.createElement("ul");
    jest.spyOn(document, "querySelector").mockReturnValue(actionPanel);

    jest.useFakeTimers();
    solaceInstance.insertPlayButton();
    jest.runAllTimers();
    jest.useRealTimers();

    let resultButton = actionPanel.lastElementChild as HTMLButtonElement;
    expect(resultButton.nodeName).toEqual(button.nodeName);
    expect(getComputedStyle(resultButton).margin).toEqual("0px 5px 1px 5px");
    expect(getComputedStyle(resultButton).color).toEqual("rgb(0, 200, 149)");
    let iElem = resultButton.firstElementChild as HTMLElement;
    expect(iElem.classList.contains("material-icons")).toBeTruthy();
    expect(iElem.innerText).toEqual("play_arrow");
    expect(solaceInstance.startReceiving).not.toBeNull();
  });

  it("should execute insertPlayButton and insert buttons with click event two times", () => {
    let button = document.createElement("button");
    let i = document.createElement("i");
    let createElementMock = jest.spyOn(document, "createElement");
    createElementMock.mockImplementation((tagName) => {
      if (tagName === "button") {
        return button;
      }

      return i;
    });

    let establishConnectionMock = jest
      .spyOn(solaceInstance, "establishConnection")
      .mockImplementation(() => Promise.resolve());

    jest.useFakeTimers();
    solaceInstance.insertPlayButton();
    jest.runAllTimers();
    jest.useRealTimers();

    button.click();
    expect(i.innerText).toEqual("stop");
    expect(establishConnectionMock).toHaveBeenCalledTimes(1);

    let disconnectMock = jest
      .spyOn(solaceInstance, "disconnect")
      .mockImplementation(() => Promise.resolve());
    button.click();
    expect(i.innerText).toEqual("play_arrow");
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it("should execute establishConnection", () => {
    solaceInstance.solaceConfig = {
      host: "host",
      password: "password",
      vpn: "vpn",
      username: "username",
    };

    let callbackFunction: Function;
    let session = {
      connect: () => {},
      on: (_code: solace.SessionEventCode, callback) => {
        callbackFunction = callback;
      },
      emit: (_code: string) => {
        callbackFunction();
      },
    } as solace.Session;

    jest
      .spyOn(solace.SolclientFactory, "createSession")
      .mockReturnValue(session);

    solaceInstance.establishConnection();

    let startMessageBrowserMock = jest
      .spyOn(solaceInstance, "startMessageBrowser")
      .mockImplementation(() => Promise.resolve());

    session.emit("UP_NOTICE");

    expect(startMessageBrowserMock).toHaveBeenCalledTimes(1);
  });

  it("should execute startMessageBrowser and fire MESSAGE event", () => {
    let span = document.createElement("span");
    span.innerText = "test";
    let querySelectorMock = jest.spyOn(document, "querySelector");
    querySelectorMock.mockReturnValue(span);

    let callbackFunction: Function;
    let queueBrowser = {
      on: (code: solace.QueueBrowserEventName, callback) => {
        if (code === solace.QueueBrowserEventName.MESSAGE) {
          callbackFunction = callback;
        }
      },
      connect: () => {},
      emit: (_code: string, args: any) => {
        callbackFunction(args);
      },
    } as solace.QueueBrowser;

    solaceInstance.session = {
      createQueueBrowser: () => {
        return queueBrowser;
      },
    } as unknown as solace.Session;

    jest
      .spyOn(solaceInstance.session, "createQueueBrowser")
      .mockReturnValue(queueBrowser);

    let extractTableRowMock = jest
      .spyOn(solaceInstance, "extractTableRow")
      .mockImplementation(() => Promise.resolve());

    solaceInstance.startMessageBrowser();
    let destination = {
      getName: () => {
        return "test2";
      },
    } as solace.Destination;
    let message = {
      getBinaryAttachment: () => {
        return "{test";
      },
      getDestination: () => {
        return destination;
      },
      getReplicationGroupMessageId: () => {
        return "0-123";
      },
    } as unknown as solace.Message;

    expect(solaceInstance.messages.length).toEqual(0);
    queueBrowser.emit("MESSAGE", message);
    expect(extractTableRowMock).toHaveBeenCalledTimes(1);
    expect(solaceInstance.messages.length).toEqual(1);
    expect(solaceInstance.messages[0].message).toEqual("{test");
    expect(solaceInstance.messages[0].topic).toEqual("test2");
    expect(solaceInstance.messages[0].messageId).toEqual(291);
  });

  it("should execute extractTableRow with no listeners added yet", () => {
    let element =
      "<body>" +
      '<table class="table table-sm table-hover table-striped border-separate"><tbody><tr></tr></tbody></table>' +
      '<table class="table table-sm table-hover table-striped border-separate"><tbody><tr></tr></tbody></table>' +
      '<table class="table table-sm table-hover table-striped border-separate"><tbody><tr></tr></tbody></table>' +
      "</body>";
    let parser = new DOMParser();
    let doc = parser.parseFromString(element, "text/html");
    let nodeList = doc.body.querySelectorAll(
      "table.table.table-sm.table-hover.table-striped.border-separate tbody"
    );
    jest.spyOn(document, "querySelectorAll").mockReturnValue(nodeList);

    nodeList.forEach((node) => {
      expect(
        node.firstElementChild?.getAttribute("click-listener")
      ).not.toEqual("true");
    });

    solaceInstance.extractTableRow();

    expect(nodeList.length).toEqual(3);
    nodeList.forEach((node) => {
      expect(node.firstElementChild?.getAttribute("click-listener")).toEqual(
        "true"
      );
    });
  });

  it("should execute extractTableRow with some listeners added yet", () => {
    let element =
      "<body>" +
      '<table class="table table-sm table-hover table-striped border-separate"><tbody><tr></tr></tbody></table>' +
      '<table class="table table-sm table-hover table-striped border-separate"><tbody><tr click-listener="true"></tr></tbody></table>' +
      '<table class="table table-sm table-hover table-striped border-separate"><tbody><tr></tr></tbody></table>' +
      "</body>";
    let parser = new DOMParser();
    let doc = parser.parseFromString(element, "text/html");
    let nodeList = doc.body.querySelectorAll(
      "table.table.table-sm.table-hover.table-striped.border-separate tbody"
    );
    jest.spyOn(document, "querySelectorAll").mockReturnValue(nodeList);

    expect(
      nodeList[0].firstElementChild?.getAttribute("click-listener")
    ).not.toEqual("true");
    expect(
      nodeList[1].firstElementChild?.getAttribute("click-listener")
    ).toEqual("true");
    expect(
      nodeList[2].firstElementChild?.getAttribute("click-listener")
    ).not.toEqual("true");

    solaceInstance.extractTableRow();

    expect(nodeList.length).toEqual(3);
    nodeList.forEach((node) => {
      expect(node.firstElementChild?.getAttribute("click-listener")).toEqual(
        "true"
      );
    });
  });

  it("should execute extractTableRow with no listeners added yet and click on one element", () => {
    let element =
      "<body>" +
      '<table class="table table-sm table-hover table-striped border-separate"><tbody><tr></tr></tbody></table>' +
      '<table class="table table-sm table-hover table-striped border-separate"><tbody><tr></tr></tbody></table>' +
      '<table class="table table-sm table-hover table-striped border-separate"><tbody><tr></tr></tbody></table>' +
      "</body>";
    let parser = new DOMParser();
    let doc = parser.parseFromString(element, "text/html");
    let nodeList = doc.body.querySelectorAll(
      "table.table.table-sm.table-hover.table-striped.border-separate tbody"
    );
    jest.spyOn(document, "querySelectorAll").mockReturnValue(nodeList);
    let insertMessageIntoTableMock = jest
      .spyOn(solaceInstance, "insertMessageIntoTable")
      .mockImplementation(() => Promise.resolve());

    solaceInstance.extractTableRow();
    let tr = nodeList[0].firstElementChild as HTMLTableRowElement;
    tr.click();

    expect(insertMessageIntoTableMock).toHaveBeenCalledTimes(1);
  });

  it("should execute extractTableRow with no listeners added yet and click on all elements", () => {
    let element =
      "<body>" +
      '<table class="table table-sm table-hover table-striped border-separate"><tbody><tr></tr></tbody></table>' +
      '<table class="table table-sm table-hover table-striped border-separate"><tbody><tr></tr></tbody></table>' +
      '<table class="table table-sm table-hover table-striped border-separate"><tbody><tr></tr></tbody></table>' +
      "</body>";
    let parser = new DOMParser();
    let doc = parser.parseFromString(element, "text/html");
    let nodeList = doc.body.querySelectorAll(
      "table.table.table-sm.table-hover.table-striped.border-separate tbody"
    );
    jest.spyOn(document, "querySelectorAll").mockReturnValue(nodeList);
    let insertMessageIntoTableMock = jest
      .spyOn(solaceInstance, "insertMessageIntoTable")
      .mockImplementation(() => Promise.resolve());

    solaceInstance.extractTableRow();
    nodeList.forEach((node) => {
      let tr = node.firstElementChild as HTMLTableRowElement;
      tr.click();
    });

    expect(insertMessageIntoTableMock).toHaveBeenCalledTimes(3);
  });

  it("should execute insertMessageIntoTable with hideInput class", () => {
    let tbody = document.createElement("tbody");
    let tr = document.createElement("tr");
    tr.classList.add("hideInput");
    let td = document.createElement("td");
    tr.appendChild(td);
    tbody.appendChild(tr);

    let span = document.createElement("span");
    span.innerText = "123  ";
    solaceInstance.messages.push({
      message: "test",
      messageId: 123,
      topic: "test2",
    });
    jest.spyOn(tbody, "querySelector").mockReturnValue(span);

    let div = document.createElement("div");
    jest.spyOn(document, "createElement").mockReturnValue(div);

    solaceInstance.insertMessageIntoTable(tbody);

    expect(div.id).toEqual("messageDiv");
    expect(div.innerText).toEqual("Topic:\ntest2\nMessage:\ntest");
  });

  it("should execute insertMessageIntoTable with showInput class", () => {
    let tbody = document.createElement("tbody");
    let tr = document.createElement("tr");
    tr.classList.add("showInput");
    let td = document.createElement("td");
    tr.appendChild(td);
    tbody.appendChild(tr);

    let div = document.createElement("div");
    div.id = "messageDiv";
    td.appendChild(div);

    jest.spyOn(td, "querySelector").mockReturnValue(div);
    jest.spyOn(div, "remove");

    solaceInstance.insertMessageIntoTable(tbody);

    expect(div.remove).toHaveBeenCalledTimes(1);
    expect(td.children.length).toEqual(0);
  });

  it("should execute disconnect", () => {
    solaceInstance.queueBrowser = {
      disconnect: () => {},
    } as solace.QueueBrowser;
    solaceInstance.session = { disconnect: () => {} } as solace.Session;

    let disconnectQueueMock = jest.spyOn(
      solaceInstance.queueBrowser,
      "disconnect"
    );
    let disconnectSessionMock = jest.spyOn(
      solaceInstance.session,
      "disconnect"
    );

    solaceInstance.disconnect();

    expect(disconnectQueueMock).toHaveBeenCalledTimes(1);
    expect(disconnectSessionMock).toHaveBeenCalledTimes(1);
  });
});
