import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

// utils/db opens a MySQL pool and kicks off a retry loop the moment it is
// imported, and the manager modules pull it in via plain CommonJS require(),
// which Vitest's module mocking does not intercept. Seeding Node's require
// cache with a stub before anything else loads keeps the real module from
// ever running.
const dbPath = require.resolve(path.join(here, '..', 'utils', 'db.js'));

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  path: path.dirname(dbPath),
  loaded: true,
  children: [],
  paths: [],
  exports: {
    pool: null,
    dbInitialization: Promise.resolve(true),
    // Tests drive these by assigning to globalThis.__wiretapDb (see
    // tests/helpers/db.js); by default every lookup comes back empty.
    search: async (...args) => call('search', args, null),
    searchAll: async (...args) => call('searchAll', args, []),
    executeQuery: async (...args) => call('executeQuery', args, []),
    insert: async (...args) => call('insert', args, { affectedRows: 1 }),
    update: async (...args) => call('update', args, { affectedRows: 1 }),
    deleteFrom: async (...args) => call('deleteFrom', args, { affectedRows: 1 })
  }
};

function call(name, args, fallback) {
  const stub = globalThis.__wiretapDb && globalThis.__wiretapDb[name];
  return stub ? stub(...args) : fallback;
}
