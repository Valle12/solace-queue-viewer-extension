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
  },
  storage: {
    local: {
      get: mock(),
      set: mock(),
    },
  },
};

Object.assign(globalThis, { chrome: chromeMock });

// env variables
beforeEach(() => {
  Bun.env.NODE_ENV = "test";
});
