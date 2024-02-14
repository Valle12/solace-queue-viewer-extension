import * as chrome from "jest-chrome";

const chromeAddon = {
  storage: {
    local: {
      set: async (data) => data,
      get: async () => {
        throw new Error("Not implemented");
      },
    },
  },
};

Object.assign(global, chrome);
Object.assign(global.chrome, chromeAddon);
