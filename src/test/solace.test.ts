import {
  type ChromeMessage,
  ChromeMessageType,
  MessageConstant,
} from "../scripts/types";
import { Solace } from "../scripts/solace";
import solace from "solclientjs";
import {
  describe,
  beforeEach,
  afterEach,
  mock,
  test,
  expect,
  spyOn,
} from "bun:test";
import { chrome } from "./bunTestChrome";

describe("Solace", () => {
  let solaceInstance: Solace;

  beforeEach(async () => {
    // clearListeners is required here, because the manifest gets executed and so an instance of solace is started, but without having a reference to it
    chrome.runtime.onMessage.clearListeners();
    solaceInstance = new Solace();
  });

  afterEach(() => {
    mock.restore();
  });

  test.only("should create a new Solace instance", () => {
    expect(solaceInstance).toBeDefined();
  });

  test.only("should set startReceiving to null to false on invalid url", async () => {
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

  test.only("should execute insertPlayButton method on valid url", async () => {
    let message = {
      to: ChromeMessageType.SOLACE,
      from: ChromeMessageType.BACKGROUND,
      message: MessageConstant.MESSAGES_QUEUED_URL_CHECK,
    } as ChromeMessage;

    let insertPlayButtonMethod = spyOn(
      solaceInstance,
      "insertPlayButton"
    ).mockImplementation(() => Promise.resolve());
    chrome.runtime.onMessage.callListeners(message, {}, () => {});
    expect(insertPlayButtonMethod).toHaveBeenCalledTimes(1);
  });

  test.only("should execute loadConfig method on click event", () => {
    let loadConfigMethod = spyOn(
      solaceInstance,
      "loadConfig"
    ).mockImplementation(() => Promise.resolve());
    document.body.click();
    expect(loadConfigMethod).toHaveBeenCalledTimes(1);
  });

  test.only("should execute loadConfig without doing anything", () => {
    solaceInstance.configLoaded = true;
    solaceInstance.loadConfig();
    expect(solaceInstance.configLoaded).toBeTruthy();
  });

  test.only("should execute loadConfig and set solaceConfig", async () => {
    expect(solaceInstance.solaceConfig).toBeUndefined();
    let div = document.createElement("div");
    div.innerText = "test";
    spyOn(document, "querySelector").mockReturnValue(div);

    let obj = {
      "solaceQueueViewerExtension.test.host": "host",
      "solaceQueueViewerExtension.test.password": "password",
      "solaceQueueViewerExtension.test.vpn": "vpn",
      "solaceQueueViewerExtension.test.username": "username",
    };

    spyOn(chrome.storage.local, "get").mockImplementation(() => {
      return Promise.resolve(obj);
    });

    await solaceInstance.loadConfig();
    expect(solaceInstance.solaceConfig).toBeDefined();
    expect(solaceInstance.solaceConfig.host).toEqual("host");
    expect(solaceInstance.solaceConfig.password).toEqual("password");
    expect(solaceInstance.solaceConfig.vpn).toEqual("vpn");
    expect(solaceInstance.solaceConfig.username).toEqual("username");
    expect(solaceInstance.configLoaded).toBeTruthy();
  });

  test.only("should execute insertPlayButton and just remove start button", () => {
    solaceInstance.startReceiving = document.createElement("button");
    let removerButtonMock = spyOn(solaceInstance, "removeButton");

    solaceInstance.insertPlayButton();

    expect(solaceInstance.startReceiving).toBeNull();
    expect(removerButtonMock).toHaveBeenCalledTimes(1);
  });

  test.only("should execute insertPlayButton and insert buttons, no action yet", async () => {
    solaceInstance.insertPlayButtonTimeout = 0;
    const button = document.createElement("button");
    const i = document.createElement("i");
    const actionPanel = document.createElement("ul");
    button.innerText = "Test button";
    spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "button") {
        return button;
      }

      return i;
    });

    spyOn(document, "querySelector").mockReturnValue(actionPanel);

    solaceInstance.insertPlayButton();
    await new Promise((resolve) => setTimeout(resolve, 1));

    let resultButton = actionPanel.lastElementChild as HTMLButtonElement;
    expect(resultButton.nodeName).toEqual(button.nodeName);
    expect(resultButton.style.margin).toEqual("0px 5px 1px");
    expect(resultButton.style.color).toEqual("#00C895");
    let iElem = resultButton.firstElementChild as HTMLElement;
    expect(iElem.classList.contains("material-icons")).toBeTruthy();
    expect(iElem.innerText).toEqual("play_arrow");
    expect(solaceInstance.startReceiving).not.toBeNull();
  });

  test.only("should execute insertPlayButton and insert buttons with click event two times", async () => {
    solaceInstance.insertPlayButtonTimeout = 0;
    const button = document.createElement("button");
    const i = document.createElement("i");
    spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "button") {
        return button;
      }

      return i;
    });

    let establishConnectionMock = spyOn(
      solaceInstance,
      "establishConnection"
    ).mockImplementation(() => Promise.resolve());

    solaceInstance.insertPlayButton();
    await new Promise((resolve) => setTimeout(resolve, 1));

    button.click();
    expect(i.innerText).toEqual("stop");
    expect(establishConnectionMock).toHaveBeenCalledTimes(1);

    let disconnectMock = spyOn(solaceInstance, "disconnect").mockImplementation(
      () => Promise.resolve()
    );
    button.click();
    expect(i.innerText).toEqual("play_arrow");
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  test.only("should execute establishConnection", () => {
    solaceInstance.solaceConfig = {
      host: "host",
      password: "password",
      vpn: "vpn",
      username: "username",
    };

    let callbackFunction: Function;
    let session = {
      connect: () => {},
      on: (code: solace.SessionEventCode, callback) => {
        if (code === solace.SessionEventCode.UP_NOTICE)
          callbackFunction = callback;
      },
      emit: (_code: string) => {
        callbackFunction();
      },
    } as solace.Session;

    spyOn(solace.SolclientFactory, "createSession").mockReturnValue(session);

    solaceInstance.establishConnection();

    let startMessageBrowserMock = spyOn(
      solaceInstance,
      "startMessageBrowser"
    ).mockImplementation(() => Promise.resolve());

    session.emit("UP_NOTICE");

    expect(startMessageBrowserMock).toHaveBeenCalledTimes(1);
  });

  test.only("should execute establishConnection and have an error", () => {
    solaceInstance.solaceConfig = {
      host: "host",
      password: "password",
      vpn: "vpn",
      username: "username",
    };

    let callbackFunction: Function;
    let session = {
      connect: () => {},
      on: (code: solace.SessionEventCode, callback) => {
        if (code === solace.SessionEventCode.CONNECT_FAILED_ERROR)
          callbackFunction = callback;
      },
      emit: (_code: string) => {
        callbackFunction();
      },
    } as solace.Session;

    spyOn(solace.SolclientFactory, "createSession").mockReturnValue(session);

    solaceInstance.establishConnection();

    let connectionFailedMock = spyOn(
      chrome.runtime,
      "sendMessage"
    ).mockImplementation((_message: ChromeMessage) => Promise.resolve());

    session.emit("CONNECT_FAILED_ERROR");

    expect(connectionFailedMock).toHaveBeenCalledTimes(1);
    expect(connectionFailedMock).toHaveBeenCalledWith({
      from: ChromeMessageType.SOLACE,
      to: ChromeMessageType.BACKGROUND,
      message: MessageConstant.SOLACE_CONNECTION_FAILED,
    });
  });

  test.only("should execute startMessageBrowser and fire MESSAGE event", () => {
    let span = document.createElement("span");
    span.innerText = "test";
    let querySelectorMock = spyOn(document, "querySelector");
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

    spyOn(solaceInstance.session, "createQueueBrowser").mockReturnValue(
      queueBrowser
    );

    let extractTableRowMock = spyOn(
      solaceInstance,
      "extractTableRow"
    ).mockImplementation(() => Promise.resolve());

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

  test.only("should execute extractTableRow with no listeners added yet", () => {
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
    spyOn(document, "querySelectorAll").mockReturnValue(nodeList);

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

  test.only("should execute extractTableRow with some listeners added yet", () => {
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
    spyOn(document, "querySelectorAll").mockReturnValue(nodeList);

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

  test.only("should execute extractTableRow with no listeners added yet and click on one element", () => {
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
    spyOn(document, "querySelectorAll").mockReturnValue(nodeList);
    let insertMessageIntoTableMock = spyOn(
      solaceInstance,
      "insertMessageIntoTable"
    ).mockImplementation(() => Promise.resolve());

    solaceInstance.extractTableRow();
    let tr = nodeList[0].firstElementChild as HTMLTableRowElement;
    tr.click();

    expect(insertMessageIntoTableMock).toHaveBeenCalledTimes(1);
  });

  test.only("should execute extractTableRow with no listeners added yet and click on all elements", () => {
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
    spyOn(document, "querySelectorAll").mockReturnValue(nodeList);
    let insertMessageIntoTableMock = spyOn(
      solaceInstance,
      "insertMessageIntoTable"
    ).mockImplementation(() => Promise.resolve());

    solaceInstance.extractTableRow();
    nodeList.forEach((node) => {
      let tr = node.firstElementChild as HTMLTableRowElement;
      tr.click();
    });

    expect(insertMessageIntoTableMock).toHaveBeenCalledTimes(3);
  });

  test.only("should execute insertMessageIntoTable with hideInput class", () => {
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
    spyOn(tbody, "querySelector").mockReturnValue(span);

    let div = document.createElement("div");
    spyOn(document, "createElement").mockReturnValue(div);

    solaceInstance.insertMessageIntoTable(tbody);

    expect(div.id).toEqual("messageDiv");
    expect(div.innerText).toEqual("Topic:\ntest2\nMessage:\ntest");
  });

  test("should execute insertMessageIntoTable with showInput class", () => {
    let tbody = document.createElement("tbody");
    let tr = document.createElement("tr");
    tr.classList.add("showInput");
    let td = document.createElement("td");
    tr.appendChild(td);
    tbody.appendChild(tr);

    let div = document.createElement("div");
    div.id = "messageDiv";
    td.appendChild(div);

    spyOn(td, "querySelector").mockReturnValue(div);
    spyOn(div, "remove");

    solaceInstance.insertMessageIntoTable(tbody);

    expect(div.remove).toHaveBeenCalledTimes(1);
    expect(td.children.length).toEqual(0);
  });

  test("should execute disconnect", () => {
    solaceInstance.queueBrowser = {
      disconnect: () => {},
    } as solace.QueueBrowser;
    solaceInstance.session = { disconnect: () => {} } as solace.Session;

    let disconnectQueueMock = spyOn(solaceInstance.queueBrowser, "disconnect");
    let disconnectSessionMock = spyOn(solaceInstance.session, "disconnect");

    solaceInstance.disconnect();

    expect(disconnectQueueMock).toHaveBeenCalledTimes(1);
    expect(disconnectSessionMock).toHaveBeenCalledTimes(1);
  });
});
