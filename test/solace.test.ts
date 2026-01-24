import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  mock,
  setSystemTime,
  spyOn,
  test,
} from "bun:test";
import {
  Message,
  OperationError,
  QueueBrowser,
  QueueBrowserEventName,
  Session,
  SessionEventCode,
  SolclientFactory,
} from "solclientjs";
import { Solace } from "../src/solace";
import type { SolaceButton, SolaceMessage } from "../src/types";

let solace: Solace;

beforeEach(() => {
  solace = new Solace();
});

afterEach(() => {
  mock.restore();
});

describe("init", () => {
  test("test if methods would get executed", () => {
    spyOn(solace, "addListeners").mockImplementation(() => {});
    spyOn(solace, "initSolaceProperties").mockImplementation(() => {});

    solace.init();

    expect(solace.addListeners).toHaveBeenCalledTimes(1);
    expect(solace.initSolaceProperties).toHaveBeenCalledTimes(1);
  });
});

describe("addListeners", () => {
  let loadListener: (event: Event) => any;
  let popstateListener: (event: Event) => any;

  beforeEach(() => {
    spyOn(window, "addEventListener").mockImplementation(
      (type: string, callback: any, options?: any) => {
        if (typeof callback !== "function") return;
        if (type === "load") loadListener = callback;
        if (type === "popstate") popstateListener = callback;
      },
    );
  });

  test("test if listeners get added", () => {
    solace.addListeners();

    expect(window.addEventListener).toHaveBeenCalledTimes(2);
    expect(window.addEventListener).toHaveBeenNthCalledWith(
      1,
      "load",
      expect.any(Function),
    );
    expect(window.addEventListener).toHaveBeenNthCalledWith(
      2,
      "popstate",
      expect.any(Function),
    );
  });

  test("test with load event", () => {
    spyOn(solace, "loadCredentials").mockImplementation(() =>
      Promise.resolve(),
    );
    spyOn(solace, "detectButton").mockImplementation(() => {});
    window.location.href = "https://solace.com/test";

    solace.addListeners();
    loadListener(new Event("load"));

    expect(solace.loadCredentials).toHaveBeenCalledTimes(1);
    expect(solace.loadCredentials).toHaveBeenCalledWith("https://solace.com");
    expect(solace.detectButton).toHaveBeenCalledTimes(1);
    expect(solace.detectButton).toHaveBeenCalledWith("https://solace.com/test");
  });

  test("test with popstate event", () => {
    spyOn(solace, "detectButton").mockImplementation(() => {});
    window.location.href = "https://solace.com/test";

    solace.addListeners();
    popstateListener(new Event("popstate"));

    expect(solace.detectButton).toHaveBeenCalledTimes(1);
    expect(solace.detectButton).toHaveBeenCalledWith("https://solace.com/test");
  });
});

describe("initSolaceProperties", () => {
  test("test if properties get initialized", () => {
    spyOn(SolclientFactory, "init").mockImplementation(() => SolclientFactory);

    solace.initSolaceProperties();

    expect(SolclientFactory.init).toHaveBeenCalledTimes(1);
  });
});

describe("detectButton", () => {
  const li = document.createElement("li");

  beforeEach(() => {
    spyOn(solace, "insertButton").mockImplementation(() => {});
  });

  test("test if method returns, when url is not right", () => {
    spyOn(document, "querySelector");

    solace.detectButton("https://solace.com/queues/test");
    solace.detectButton("https://solace.com/messages/test");
    solace.detectButton("https://solace.com/topics/test");

    expect(document.querySelector).toHaveBeenCalledTimes(0);
  });

  test("test if insertButton is called, when content is already loaded", () => {
    const url = "https://solace.com/queues/messages/test";
    spyOn(document, "querySelector").mockImplementation(() => li);

    solace.detectButton(url);

    expect(document.querySelector).toHaveBeenCalledTimes(1);
    expect(solace.insertButton).toHaveBeenCalledTimes(1);
    expect(solace.insertButton).toHaveBeenCalledWith(li, url);
  });

  test("test if dom update happens, but content is not loaded yet", async () => {
    const url = "https://solace.com/queues/messages/test";

    solace.detectButton(url);
    document.body.appendChild(document.createElement("div"));

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(solace.insertButton).toHaveBeenCalledTimes(0);
  });

  test("test if dom update happens and content is loaded", async () => {
    const url = "https://solace.com/queues/messages/test";

    solace.detectButton(url);
    spyOn(document, "querySelector").mockImplementation(() => li);
    document.body.appendChild(document.createElement("div"));

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(solace.insertButton).toHaveBeenCalledTimes(1);
    expect(solace.insertButton).toHaveBeenCalledWith(li, url);
  });
});

describe("insertButton", () => {
  const url = "https://solace.com/queues/messages/test";
  let li: HTMLLIElement;
  let button: HTMLButtonElement;
  let listener: (event: Event) => any = () => {};

  beforeEach(() => {
    li = document.createElement("li");
    button = document.createElement("button");

    spyOn(solace, "addClickListenerForTable").mockImplementation(() => {});
    spyOn(HTMLButtonElement.prototype, "addEventListener").mockImplementation(
      (_type: any, callback: any) => {
        if (typeof callback !== "function") return;
        listener = callback;
      },
    );
    spyOn(solace, "detectButton").mockImplementation(() => {});
  });

  test("test if style and stop button get added the first time method is called, button is clicked, queue name undefiend", () => {
    spyOn(document, "createElement").mockReturnValue(button);
    spyOn(solace, "extractQueueName").mockReturnValue(undefined);
    spyOn(solace, "createQueueBrowser");

    expect(li.style.flex).toBe("");
    expect(solace.currentIcon).toBe("play_arrow");

    solace.insertButton(li, url);

    expect(li.style.display).toBe("flex");
    expect(button.innerHTML).toBe(
      `<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="300 -780 480 600"><path d="M320-200v-560l440 280-440 280Z"></path></svg>`,
    );

    listener(new Event("click"));

    expect(solace.currentIcon).toBe("stop");
    expect(solace.extractQueueName).toHaveBeenCalledTimes(1);
    expect(solace.createQueueBrowser).toHaveBeenCalledTimes(0);
  });

  test("test if stop button gets added, button is clicked, queue name is defined", () => {
    const querySelectorMock = spyOn(li, "querySelector").mockImplementation(
      () => button,
    );
    spyOn(button, "remove");
    spyOn(solace, "extractQueueName").mockReturnValue("test");
    spyOn(solace, "createQueueBrowser").mockImplementation(() => {});

    expect(solace.currentIcon).toBe("play_arrow");

    solace.insertButton(li, url);

    expect(button.remove).toHaveBeenCalledTimes(1);
    querySelectorMock.mockRestore();
    button = li.querySelector("button") as HTMLButtonElement;
    expect(button.innerHTML).toBe(
      `<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="300 -780 480 600"><path d="M320-200v-560l440 280-440 280Z"></path></svg>`,
    );

    listener(new Event("click"));

    expect(solace.currentIcon).toBe("stop");
    expect(solace.extractQueueName).toHaveBeenCalledTimes(1);
    expect(solace.createQueueBrowser).toHaveBeenCalledTimes(1);
    expect(solace.createQueueBrowser).toHaveBeenCalledWith("test");
    expect(solace.detectButton).toHaveBeenCalledTimes(1);
    expect(solace.detectButton).toHaveBeenCalledWith(url);
  });

  test("test if play button gets added, button is clicked", () => {
    solace.currentIcon = "stop";

    const querySelectorMock = spyOn(li, "querySelector").mockImplementation(
      () => button,
    );
    spyOn(button, "remove");
    spyOn(solace, "disconnect").mockImplementation(() => {});

    expect(solace.currentIcon).toBe("stop");

    solace.insertButton(li, url);

    expect(button.remove).toHaveBeenCalledTimes(1);
    querySelectorMock.mockRestore();
    button = li.querySelector("button") as HTMLButtonElement;
    expect(button.innerHTML).toBe(
      `<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="300 -780 480 600"><path d="M240-240v-480h480v480H240Z"></path></svg>`,
    );

    listener(new Event("click"));

    // TS does not think, currentIcon will be changed, but it will inside the listener
    expect(solace.currentIcon as SolaceButton).toBe("play_arrow");
    expect(solace.disconnect).toHaveBeenCalledTimes(1);
    expect(solace.detectButton).toHaveBeenCalledTimes(1);
    expect(solace.detectButton).toHaveBeenCalledWith(url);
  });
});

describe("extractQueueName", () => {
  const date = new Date();

  beforeEach(() => {
    spyOn(solace, "sendMessage").mockImplementation(() => {});
    setSystemTime(date);
  });

  afterAll(() => {
    setSystemTime();
  });

  test("test with non existent queue element", () => {
    solace.extractQueueName();

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendError",
      content: `[${date.toLocaleTimeString()}] Could not extract queue element`,
    });
  });

  test("test with non existent queue name", () => {
    const queueElement = document.createElement("span");
    spyOn(document, "querySelector").mockImplementation(() => queueElement);

    solace.extractQueueName();

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendError",
      content: `[${date.toLocaleTimeString()}] Could not extract queue name`,
    });
  });

  test("test with queue name", () => {
    const queueElement = document.createElement("span");
    queueElement.textContent = "Queue | test";
    spyOn(document, "querySelector").mockImplementation(() => queueElement);

    const queueName = solace.extractQueueName();

    expect(queueName).toBe("test");
  });
});

describe("loadCredentials", () => {
  const date = new Date();

  beforeEach(() => {
    spyOn(chrome.storage.local, "get").mockImplementation(
      (
        keys: string | string[] | Record<string, any>,
        _callback?: (items: any) => void | Promise<void>,
      ) => {
        if (
          typeof keys === "object" &&
          keys instanceof Array &&
          !keys[0].includes("cluster")
        )
          return Promise.resolve({});
        return Promise.resolve({
          "cluster.password": "password",
          "cluster.url": "url",
          "cluster.userName": "username",
          "cluster.vpn": "vpn",
        });
      },
    );
    spyOn(solace, "sendMessage").mockImplementation(() => {});
    setSystemTime(date);
  });

  afterAll(() => {
    setSystemTime();
  });

  test("test if error message gets sent on invalid credentials", async () => {
    await solace.loadCredentials("");

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendError",
      content: `[${date.toLocaleTimeString()}] Connection URL not set`,
    });
  });

  test("test if createSession is called", async () => {
    spyOn(solace, "createSession").mockImplementation(() => {});

    await solace.loadCredentials("cluster");

    expect(solace.createSession).toHaveBeenCalledTimes(1);
  });
});

describe("createSession", () => {
  const date = new Date();

  beforeEach(() => {
    setSystemTime(date);
    spyOn(solace, "sendMessage").mockImplementation(() => {});
  });

  afterEach(() => {
    setSystemTime();
  });

  test("test if createSession throws an error", () => {
    spyOn(SolclientFactory, "createSession").mockImplementation(() => {
      const error = {
        subcode: 20,
        message: "error",
      };
      Object.setPrototypeOf(error, OperationError.prototype);
      throw error;
    });

    solace.createSession();

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendError",
      content: `[${date.toLocaleTimeString()}] Invalid connection parameter types: error`,
    });
  });

  test("test if connect throws error, when already connected", () => {
    spyOn(SolclientFactory, "createSession").mockImplementation(() => {
      return {
        connect: () => {
          const error = {
            subcode: 3,
            message: "error",
          };
          Object.setPrototypeOf(error, OperationError.prototype);
          throw error;
        },
        on: mock(),
      } as unknown as Session;
    });

    solace.createSession();

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendError",
      content: `[${date.toLocaleTimeString()}] Session is disposed, already connected or connecting: error`,
    });
  });

  test("test if connect throws error, when underlying transport cannot be established", () => {
    spyOn(SolclientFactory, "createSession").mockImplementation(() => {
      return {
        connect: () => {
          const error = {
            subcode: 44,
            message: "error",
          };
          Object.setPrototypeOf(error, OperationError.prototype);
          throw error;
        },
        on: mock(),
      } as unknown as Session;
    });

    solace.createSession();

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendError",
      content: `[${date.toLocaleTimeString()}] Connection could not be established: error`,
    });
  });

  test("test if connection is successful", () => {
    let listener: () => void = () => {};

    spyOn(SolclientFactory, "createSession").mockImplementation(() => {
      return {
        connect: mock(),
        on: (event: SessionEventCode, callback: () => void) => {
          if (event === SessionEventCode.UP_NOTICE) {
            listener = callback;
          }
        },
      } as unknown as Session;
    });
    spyOn(solace, "sendMessage").mockImplementation(() => {});

    solace.createSession();
    listener();

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendInfo",
      content: "Successfully connected to session",
    });
  });

  test("test if disconnection is successful", () => {
    let listener: () => void = () => {};

    spyOn(SolclientFactory, "createSession").mockImplementation(() => {
      return {
        connect: mock(),
        on: (event: SessionEventCode, callback: () => void) => {
          if (event === SessionEventCode.DISCONNECTED) {
            listener = callback;
          }
        },
      } as unknown as Session;
    });
    spyOn(solace, "sendMessage").mockImplementation(() => {});

    solace.createSession();
    listener();

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendInfo",
      content: "Successfully disconnected from session",
    });
  });
});

describe("createQueueBrowser", () => {
  let date: Date;

  beforeEach(() => {
    date = new Date();
    setSystemTime(date);
  });

  afterEach(() => {
    setSystemTime();
  });

  test("test with undefined session", () => {
    spyOn(solace, "sendMessage").mockImplementation(() => {});

    solace.createQueueBrowser("test");

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendError",
      content: `[${date.toLocaleTimeString()}] Session not created yet (should not have happened)`,
    });
  });

  test("test with error in createQueueBrowser", () => {
    solace.session = {
      createQueueBrowser: () => {
        const error = {
          subcode: 20,
          message: "error",
        };
        Object.setPrototypeOf(error, OperationError.prototype);
        throw error;
      },
    } as unknown as Session;
    spyOn(solace, "sendMessage").mockImplementation(() => {});

    solace.createQueueBrowser("test");

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendError",
      content: `[${date.toLocaleTimeString()}] Queue browser error: error`,
    });
  });

  test("test with error in connect", () => {
    solace.session = {
      createQueueBrowser: () => {
        return {
          connect: () => {
            const error = {
              subcode: 3,
              message: "error",
            };
            Object.setPrototypeOf(error, OperationError.prototype);
            throw error;
          },
          on: mock(),
        } as unknown as QueueBrowser;
      },
    } as unknown as Session;
    spyOn(solace, "sendMessage").mockImplementation(() => {});

    solace.createQueueBrowser("test");

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendError",
      content: `[${date.toLocaleTimeString()}] Consumer is not supported by router for this client: error`,
    });
  });

  test("test with Up Event firing", () => {
    let listener: () => void = () => {};

    solace.session = {
      createQueueBrowser: () => {
        return {
          connect: mock(),
          on: (event: QueueBrowserEventName, callback: () => void) => {
            if (event === QueueBrowserEventName.UP) {
              listener = callback;
            }
          },
        } as unknown as QueueBrowser;
      },
    } as unknown as Session;
    spyOn(solace, "addClickListenerForTable").mockImplementation(() => {});
    spyOn(solace, "sendMessage").mockImplementation(() => {});

    solace.createQueueBrowser("test");
    listener();

    expect(solace.addClickListenerForTable).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendInfo",
      content: "Successfully connected to queue",
    });
  });

  test("test with Down Event firing", () => {
    let listener: () => void = () => {};

    solace.session = {
      createQueueBrowser: () => {
        return {
          connect: mock(),
          on: (event: QueueBrowserEventName, callback: () => void) => {
            if (event === QueueBrowserEventName.DOWN) {
              listener = callback;
            }
          },
        } as unknown as QueueBrowser;
      },
    } as unknown as Session;
    spyOn(solace, "sendMessage").mockImplementation(() => {});

    solace.createQueueBrowser("test");
    listener();

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendInfo",
      content: "Successfully disconnected from queue",
    });
  });

  test("test with Message Event firing, but no id", () => {
    let listener: (message: Message) => void = () => {};

    solace.session = {
      createQueueBrowser: () => {
        return {
          connect: mock(),
          on: (event: QueueBrowserEventName, callback: () => void) => {
            if (event === QueueBrowserEventName.MESSAGE) {
              listener = callback;
            }
          },
        } as unknown as QueueBrowser;
      },
    } as unknown as Session;
    spyOn(solace, "sendMessage").mockImplementation(() => {});

    solace.createQueueBrowser("test");
    listener({
      getReplicationGroupMessageId: () => null,
    } as Message);

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendError",
      content: `[${date.toLocaleTimeString()}] Message ID not set`,
    });
  });

  test("test with Message Event firing without destination", () => {
    let listener: (message: Message) => void = () => {};

    solace.session = {
      createQueueBrowser: () => {
        return {
          connect: mock(),
          on: (event: QueueBrowserEventName, callback: () => void) => {
            if (event === QueueBrowserEventName.MESSAGE) {
              listener = callback;
            }
          },
        } as unknown as QueueBrowser;
      },
    } as unknown as Session;

    solace.createQueueBrowser("test");
    listener({
      getReplicationGroupMessageId: () => {
        return {
          toString: () => "1",
        };
      },
      getBinaryAttachment: () => {
        return new TextEncoder().encode("test");
      },
      getDestination: () => null,
    } as unknown as Message);

    expect(solace.messages).toHaveLength(1);
    expect(solace.messages.get("1")?.topic).toBeUndefined();
    expect(solace.messages.get("1")?.message).toBe("test");
  });

  test("test with Message Event firing with all properties", () => {
    let listener: (message: Message) => void = () => {};

    solace.session = {
      createQueueBrowser: () => {
        return {
          connect: mock(),
          on: (event: QueueBrowserEventName, callback: () => void) => {
            if (event === QueueBrowserEventName.MESSAGE) {
              listener = callback;
            }
          },
        } as unknown as QueueBrowser;
      },
    } as unknown as Session;

    solace.createQueueBrowser("test");
    listener({
      getReplicationGroupMessageId: () => {
        return {
          toString: () => "1",
        };
      },
      getBinaryAttachment: () => {
        return new TextEncoder().encode("message");
      },
      getDestination: () => {
        return {
          getName: () => "topic",
        };
      },
    } as unknown as Message);

    expect(solace.messages).toHaveLength(1);
    expect(solace.messages.get("1")?.topic).toBe("topic");
    expect(solace.messages.get("1")?.message).toBe("message");
  });
});

describe("addClickListenerForTable", () => {
  let date: Date;

  beforeEach(() => {
    date = new Date();
    setSystemTime(date);
  });

  afterEach(() => {
    setSystemTime();
  });

  test("test if table cannot be found", () => {
    spyOn(solace, "sendMessage");

    solace.addClickListenerForTable();

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendError",
      content: `[${date.toLocaleTimeString()}] Table not found`,
    });
  });

  test("test if table is found and clicked, but no valid target", async () => {
    let listener: (ev: Event) => Promise<any> = () => Promise.resolve();
    const table = document.createElement("table");
    spyOn(document, "querySelector").mockReturnValue(table);
    spyOn(table, "addEventListener").mockImplementation(
      (_type: "click", callback: (ev: Event) => any) => {
        listener = callback;
      },
    );
    spyOn(Element.prototype, "closest");

    solace.addClickListenerForTable();
    await listener(new Event("click"));

    expect(Element.prototype.closest).toHaveBeenCalledTimes(0);
  });

  test("test if table is found and clicked, but target is no element", async () => {
    let listener: (ev: Event) => Promise<any> = () => Promise.resolve();
    const table = document.createElement("table");
    spyOn(document, "querySelector").mockReturnValue(table);
    spyOn(table, "addEventListener").mockImplementation(
      (_type: "click", callback: (ev: Event) => any) => {
        listener = callback;
      },
    );
    spyOn(Element.prototype, "closest");

    solace.addClickListenerForTable();
    await listener({
      target: {} as string,
    } as unknown as Event);

    expect(Element.prototype.closest).toHaveBeenCalledTimes(0);
  });

  test("test if table is found and clicked, but invalid row", async () => {
    let listener: (ev: Event) => Promise<any> = () => Promise.resolve();
    const table = document.createElement("table");
    const row = {
      closest: () => {
        return { nextElementSibling: null };
      },
      querySelectorAll: mock(),
    } as unknown as HTMLTableRowElement;
    Object.setPrototypeOf(row, HTMLTableRowElement.prototype);
    spyOn(document, "querySelector").mockReturnValue(table);
    spyOn(table, "addEventListener").mockImplementation(
      (_type: "click", callback: (ev: Event) => any) => {
        listener = callback;
      },
    );
    spyOn(row, "querySelectorAll");

    solace.addClickListenerForTable();
    await listener({
      target: row,
    } as unknown as Event);

    expect(row.querySelectorAll).toHaveBeenCalledTimes(0);
  });

  test("test if table is found and clicked, but no spans", async () => {
    let listener: (ev: Event) => Promise<any> = () => Promise.resolve();
    const table = document.createElement("table");
    const secondRow = document.createElement("tr");
    const row = {
      closest: () => {
        return { nextElementSibling: secondRow };
      },
      querySelectorAll: mock(),
    } as unknown as HTMLTableRowElement;
    Object.setPrototypeOf(row, HTMLTableRowElement.prototype);
    spyOn(document, "querySelector").mockReturnValue(table);
    spyOn(table, "addEventListener").mockImplementation(
      (_type: "click", callback: (ev: Event) => any) => {
        listener = callback;
      },
    );
    spyOn(solace, "sendMessage");

    solace.addClickListenerForTable();
    await listener({
      target: row,
    } as unknown as Event);

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendError",
      content: `[${date.toLocaleTimeString()}] Message ID not found`,
    });
  });

  test("test if table is found and clicked, but invalid id", async () => {
    let listener: (ev: Event) => Promise<any> = () => Promise.resolve();
    const table = document.createElement("table");
    const row = document.createElement("tr");
    const secondRow = document.createElement("tr");
    const spanText = document.createElement("span");
    spanText.textContent = "Replication Group Message ID:";
    secondRow.appendChild(spanText);
    row.closest = mock(() => {
      return { nextElementSibling: secondRow };
    });
    spyOn(document, "querySelector").mockReturnValue(table);
    spyOn(table, "addEventListener").mockImplementation(
      (_type: "click", callback: (ev: Event) => any) => {
        listener = callback;
      },
    );
    spyOn(solace, "sendMessage");

    solace.addClickListenerForTable();
    await listener({
      target: row,
    } as unknown as Event);

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendError",
      content: `[${date.toLocaleTimeString()}] Message ID not found`,
    });
  });

  test("test if table is found and clicked, but invalid message", async () => {
    let listener: (ev: Event) => Promise<any> = () => Promise.resolve();
    const table = document.createElement("table");
    const row = document.createElement("tr");
    const secondRow = document.createElement("tr");
    const spanText = document.createElement("span");
    spanText.textContent = "Replication Group Message ID:";
    secondRow.appendChild(spanText);
    const spanId = document.createElement("span");
    spanId.textContent = "1";
    secondRow.appendChild(spanId);
    row.closest = mock(() => {
      return { nextElementSibling: secondRow };
    });
    spyOn(document, "querySelector").mockReturnValue(table);
    spyOn(table, "addEventListener").mockImplementation(
      (_type: "click", callback: (ev: Event) => any) => {
        listener = callback;
      },
    );
    spyOn(solace.messages, "get").mockReturnValue(undefined);
    spyOn(solace, "sendMessage");

    solace.addClickListenerForTable();
    await listener({
      target: row,
    } as unknown as Event);

    expect(solace.sendMessage).toHaveBeenCalledTimes(1);
    expect(solace.sendMessage).toHaveBeenCalledWith({
      type: "sendError",
      content: `[${date.toLocaleTimeString()}] Message not saved before. Is the process running?`,
    });
  });

  test("test with success", async () => {
    let listener: (ev: Event) => Promise<any> = () => Promise.resolve();
    const table = document.createElement("table");
    const row = document.createElement("tr");
    const secondRow = document.createElement("tr");
    const spanText = document.createElement("span");
    spanText.textContent = "Replication Group Message ID:";
    secondRow.appendChild(spanText);
    const spanId = document.createElement("span");
    spanId.textContent = "1";
    secondRow.appendChild(spanId);
    row.closest = mock(() => {
      return { nextElementSibling: secondRow };
    });
    const message: SolaceMessage = {
      topic: "topic",
      message: "message",
    };
    spyOn(document, "querySelector").mockReturnValue(table);
    spyOn(table, "addEventListener").mockImplementation(
      (_type: "click", callback: (ev: Event) => any) => {
        listener = callback;
      },
    );
    spyOn(solace.messages, "get").mockReturnValue(message);
    spyOn(solace, "insertMessage").mockImplementation(() => {});

    solace.addClickListenerForTable();
    await listener({
      target: row,
    } as unknown as Event);

    expect(solace.insertMessage).toHaveBeenCalledTimes(1);
    expect(solace.insertMessage).toHaveBeenCalledWith(secondRow, message, "1");
  });
});

describe("insertMessage", () => {
  test("test with no compose element", () => {
    const row = document.createElement("tr");
    const message: SolaceMessage = {
      topic: "topic",
      message: "message",
    };
    const id = "1";
    spyOn(String.prototype, "substring");

    solace.insertMessage(row, message, id);

    expect(String.prototype.substring).toHaveBeenCalledTimes(0);
  });

  test("test with compose, but no lastDiv element", () => {
    const row = document.createElement("tr");
    const compose = document.createElement("div");
    const message: SolaceMessage = {
      topic: "topic",
      message: "message",
    };
    const id = "1";

    spyOn(row, "querySelector").mockReturnValue(compose);
    spyOn(String.prototype, "substring");

    solace.insertMessage(row, message, id);

    expect(String.prototype.substring).toHaveBeenCalledTimes(0);
  });

  test("test with compose, lastDiv element and removal", () => {
    const row = document.createElement("tr");
    const compose = document.createElement("div");
    const firstDiv = document.createElement("div");
    const lastDiv = document.createElement("div");
    compose.appendChild(firstDiv);
    compose.appendChild(lastDiv);
    const message: SolaceMessage = {
      topic: "topic",
      message: '{"message": "message"}',
    };
    const id = "1";

    spyOn(row, "querySelector").mockReturnValue(compose);
    spyOn(lastDiv, "remove");
    spyOn(solace, "updateInfoText").mockImplementation(() => {});

    solace.insertMessage(row, message, id);

    expect(lastDiv.remove).toHaveBeenCalledTimes(1);
  });

  test("test with compose, lastDiv element, no removal and insertion of new div", () => {
    const row = document.createElement("tr");
    const compose = document.createElement("div");
    const lastDiv = document.createElement("div");
    const infoContainer = document.createElement("div");
    const icons = document.createElement("div");
    const copyButton = document.createElement("button");
    const formatButton = document.createElement("button");
    const downloadButton = document.createElement("button");
    const infoText = document.createElement("div");
    let divIndex = 0;
    let buttonIndex = 0;
    let copyCb = (event: Event) => {};
    let formatCb = (event: Event) => {};
    let downloadCb = (event: Event) => {};
    compose.appendChild(lastDiv);
    const message: SolaceMessage = {
      topic: "topic",
      message: '{"message": "message"}',
    };
    const id = "1";

    spyOn(row, "querySelector").mockReturnValue(compose);
    spyOn(lastDiv, "remove");
    spyOn(copyButton, "addEventListener").mockImplementation(
      (_type: string, callback: (event: Event) => void) => {
        copyCb = callback;
      },
    );
    spyOn(formatButton, "addEventListener").mockImplementation(
      (_type: string, callback: (event: Event) => void) => {
        formatCb = callback;
      },
    );
    spyOn(downloadButton, "addEventListener").mockImplementation(
      (_type: string, callback: (event: Event) => void) => {
        downloadCb = callback;
      },
    );
    spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "div") {
        if (divIndex === 0) {
          divIndex++;
          return infoContainer;
        } else if (divIndex === 1) {
          divIndex++;
          return icons;
        } else {
          return infoText;
        }
      } else {
        if (buttonIndex === 0) {
          buttonIndex++;
          return copyButton;
        } else if (buttonIndex === 1) {
          buttonIndex++;
          return formatButton;
        } else {
          buttonIndex++;
          return downloadButton;
        }
      }
    });
    spyOn(solace, "updateInfoText");
    spyOn(navigator.clipboard, "writeText");
    spyOn(solace, "addTooltip").mockImplementation(() => {});
    spyOn(solace, "displayToast").mockImplementation(() => {});

    solace.insertMessage(row, message, id);
    copyCb(new Event("click"));

    expect(lastDiv.remove).toHaveBeenCalledTimes(0);
    expect(document.createElement).toHaveBeenCalledTimes(6);
    expect(copyButton.addEventListener).toHaveBeenCalledTimes(1);
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(icons.childNodes.length).toBe(3);

    formatCb(new Event("click"));

    expect(solace.updateInfoText).toHaveBeenCalledTimes(2);
    expect(solace.updateInfoText).toHaveBeenNthCalledWith(
      1,
      infoText,
      '{"message": "message"}',
      "topic",
    );
    expect(solace.updateInfoText).toHaveBeenNthCalledWith(
      2,
      infoText,
      '{"message": "message"}',
      "topic",
      true,
    );

    spyOn(document.body, "appendChild");
    downloadCb(new Event("click"));

    expect(document.body.appendChild).toHaveBeenCalledTimes(1);
  });
});

describe("disconnect", () => {
  test("test if queue browser is not set", () => {
    spyOn(QueueBrowser.prototype, "disconnect");

    solace.disconnect();

    expect(QueueBrowser.prototype.disconnect).toHaveBeenCalledTimes(0);
  });

  test("test if queue browser is set", () => {
    solace.queueBrowser = {
      disconnect: mock(),
    } as unknown as QueueBrowser;

    solace.disconnect();

    expect(solace.queueBrowser.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("updateInfoText", () => {
  test("test if text will be unformatted nad has no topic", () => {
    const infoText = document.createElement("div");
    const message = '{"message": "message"}';

    expect(infoText.innerHTML).toBe("");

    solace.updateInfoText(infoText, message, undefined);

    expect(infoText.innerHTML).toContain("Topic</strong>: -");
    expect(infoText.innerHTML).toContain(
      `Message</strong>: {\n  \"message\": \"message\"\n}\n`,
    );
  });

  test("test if text will be formatted and has a topic", () => {
    const infoText = document.createElement("div");
    const message = '{"message": "message"}';

    expect(infoText.innerHTML).toBe("");

    solace.updateInfoText(infoText, message, "topic", true);

    expect(infoText.innerHTML).toContain("Topic</strong>: topic");
    expect(infoText.innerHTML).toContain(
      'Message</strong>: <pre style="font-family: inherit; font-size: inherit">{\n  \"message\": \"message\"\n}</pre>',
    );
  });
});

describe("addTooltip", () => {
  test("test with no class", () => {
    const button = document.createElement("button");
    spyOn(document, "createElement");

    solace.addTooltip(button);

    expect(document.createElement).toHaveBeenCalledTimes(0);
  });

  test("test with valid class", () => {
    const button = document.createElement("button");
    button.classList.add("test");

    solace.addTooltip(button);

    expect(button.childElementCount).toBe(1);
    const style = button.querySelector("style");
    expect(style?.textContent).toContain("position: relative;");
  });
});

describe("displayToast", () => {
  afterAll(() => {
    jest.useRealTimers();
  });

  test("test displaying toast for the first time", () => {
    const message = "test";
    spyOn(document, "createElement");
    jest.useFakeTimers();

    solace.displayToast(message);

    expect(document.createElement).toHaveBeenCalledTimes(2);
    const toastContainer = document.querySelector(".toast-container");
    expect(toastContainer?.firstElementChild?.classList[0]).toBe(
      "custom-toast",
    );
    jest.advanceTimersToNextTimer();
    expect(toastContainer?.firstElementChild).toBeNull();
  });

  test("test displaying toast when one is already displayed", () => {
    const message = "test";
    const toastContainer = document.createElement("div");
    const oldToast = document.createElement("div");
    oldToast.classList.add("custom-toast");
    spyOn(document, "createElement");
    spyOn(document, "querySelector").mockImplementation((selector: string) => {
      if (selector === ".toast-container") return toastContainer;
      return oldToast;
    });
    spyOn(oldToast, "remove");
    jest.useFakeTimers();

    solace.displayToast(message);

    expect(document.createElement).toHaveBeenCalledTimes(1);
    expect(oldToast.remove).toHaveBeenCalledTimes(1);
    const toast = toastContainer.firstElementChild as HTMLDivElement;
    spyOn(toast, "remove");
    expect(toast.remove).toHaveBeenCalledTimes(0);
    jest.advanceTimersToNextTimer();
    expect(toast.remove).toHaveBeenCalledTimes(1);
  });
});

describe("sendMessage", () => {
  test("test if sendMessage is called", () => {
    spyOn(chrome.runtime, "sendMessage");

    solace.sendMessage({
      type: "sendInfo",
      content: "test",
    });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "sendInfo",
      content: "test",
    });
  });
});

describe("extractBaseColor", () => {
  test("test with i not found", () => {
    const ele = document.createElement("li");

    expect(solace.baseColor).toBe("#00c895");

    solace.extractBaseColor(ele);

    expect(solace.baseColor).toBe("#00c895");
  });

  test("test with i found", () => {
    const ele = document.createElement("li");
    const i = document.createElement("i");
    i.style.color = "#ff0000";
    ele.appendChild(i);

    expect(solace.baseColor).toBe("#00c895");

    spyOn(window, "getComputedStyle").mockReturnValue({
      color: "rgb(255, 0, 0)",
    } as CSSStyleDeclaration);

    solace.extractBaseColor(ele);

    expect(solace.baseColor).toBe("rgb(255, 0, 0)");
  });
});
