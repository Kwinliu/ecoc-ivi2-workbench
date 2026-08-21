const fs = require("fs/promises");
const path = require("path");

const SCHEMA_PATH = path.resolve(__dirname, "..", "db", "postgres", "001_workbench_state.sql");
const LOCAL_DATABASE_URL = "postgres://ecoc_ivi:ecoc_ivi_dev@127.0.0.1:5433/ecoc_ivi_workbench";

function createJsonStore({ dataDir }) {
  const dbPath = path.join(dataDir, "db.json");

  return {
    kind: "json",

    async ensure(initialState) {
      await fs.mkdir(dataDir, { recursive: true });
      try {
        await fs.access(dbPath);
      } catch {
        await this.write(initialState());
      }
    },

    async read() {
      return JSON.parse(await fs.readFile(dbPath, "utf8"));
    },

    async write(state) {
      await fs.mkdir(dataDir, { recursive: true });
      const temporaryPath = `${dbPath}.tmp-${process.pid}`;
      await fs.writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
      await fs.rename(temporaryPath, dbPath);
    },

    async close() {},
  };
}

function createPostgresStore({ env, pool }) {
  const databaseUrl = String(env.DATABASE_URL || LOCAL_DATABASE_URL).trim();

  let ownedPool = null;
  const getPool = () => {
    if (pool) return pool;
    if (!ownedPool) {
      const { Pool } = require("pg");
      ownedPool = new Pool({ connectionString: databaseUrl });
    }
    return ownedPool;
  };

  return {
    kind: "postgres",

    async ensure(initialState) {
      const schema = await fs.readFile(SCHEMA_PATH, "utf8");
      const client = getPool();
      await client.query(schema);
      await client.query(
        `INSERT INTO workbench_state (id, state)
         VALUES (1, $1::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify(initialState())]
      );
    },

    async read() {
      const result = await getPool().query("SELECT state FROM workbench_state WHERE id = 1");
      if (result.rowCount !== 1) throw new Error("PostgreSQL workbench state is not initialized");
      return result.rows[0].state;
    },

    async write(state) {
      await getPool().query(
        `INSERT INTO workbench_state (id, state, updated_at)
         VALUES (1, $1::jsonb, now())
         ON CONFLICT (id) DO UPDATE
         SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at`,
        [JSON.stringify(state)]
      );
    },

    async close() {
      if (ownedPool) await ownedPool.end();
    },
  };
}

function createWorkbenchStore(options = {}) {
  const env = options.env || process.env;
  const dataDir = options.dataDir || path.resolve(process.cwd(), "data");
  const driver = String(env.WORKBENCH_STORE || "postgres").trim().toLowerCase();

  if (["json", "file"].includes(driver)) return createJsonStore({ dataDir });
  if (["postgres", "pg"].includes(driver)) return createPostgresStore({ env, pool: options.pool });
  throw new Error(`Unsupported WORKBENCH_STORE driver: ${driver || "(blank)"}`);
}

module.exports = { createWorkbenchStore };
