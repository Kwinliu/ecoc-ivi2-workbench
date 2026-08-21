#!/usr/bin/env node

const assert = require("assert");
const { Client } = require("pg");
const { createWorkbenchStore } = require("../src/workbench-store");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("BEGIN");
  const store = createWorkbenchStore({
    env: {
      WORKBENCH_STORE: "postgres",
      DATABASE_URL: process.env.DATABASE_URL,
    },
    pool: client,
  });

  try {
    await store.ensure(() => ({ vehicles: [], revision: 1 }));
    await store.write({ vehicles: [{ id: "postgres-vehicle" }], revision: 2 });
    assert.deepEqual(await store.read(), {
      vehicles: [{ id: "postgres-vehicle" }],
      revision: 2,
    });
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }

  console.log("PostgreSQL workbench store integration test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
