let _db = null;
let _storage = null;

export const setGlobalDb = (dbInstance) => {
  _db = dbInstance;
};

export const getGlobalDb = () => {
  if (!_db) {
    throw new Error("Global DB is not initialized. Call setGlobalDb(db) first in your app entry.");
  }
  return _db;
};

export const setGlobalStorage = (storageInstance) => {
  _storage = storageInstance;
};

export const getGlobalStorage = () => {
  if (!_storage) {
    throw new Error("Global Storage is not initialized. Call setGlobalStorage(storage) first.");
  }
  return _storage;
};
