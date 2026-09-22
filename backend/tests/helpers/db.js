/**
 * Point utils/db's stubbed `search` at a fixed set of rows for one test.
 *
 * `rows` is keyed by table, then by row id:
 *   setDbRows({ instances: { 'inst-1': {...} }, workshops: { 'ws-1': {...} } })
 */
export function setDbRows(rows) {
  globalThis.__wiretapDb = {
    search: async (table, column, value) => {
      const table_ = rows[table] || {};
      if (column === 'id') return table_[value] || null;
      return Object.values(table_).find(row => row[column] === value) || null;
    }
  };
}

export function clearDbRows() {
  delete globalThis.__wiretapDb;
}
