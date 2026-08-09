declare global {
  var verifierStore: {
    dumps: any[];
  };
}

if (!global.verifierStore) {
  global.verifierStore = { dumps: [] };
}

export const store = global.verifierStore;
