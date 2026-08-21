#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { createWorkbenchStore } = require("../src/workbench-store");

async function main() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "kwin-store-"));
  try {
    const store = createWorkbenchStore({ env: { WORKBENCH_STORE: "json" }, dataDir });
    assert.equal(store.kind, "json");
    assert.deepEqual(Object.keys(store).sort(), ["close", "ensure", "kind", "read", "write"]);

    await store.ensure(() => ({ vehicles: [], revision: 1 }));
    assert.deepEqual(await store.read(), { vehicles: [], revision: 1 });

    await store.write({ vehicles: [{ id: "vehicle-1" }], revision: 2 });
    await store.ensure(() => ({ vehicles: [], revision: 999 }));
    assert.deepEqual(await store.read(), { vehicles: [{ id: "vehicle-1" }], revision: 2 });
    await store.close();

    const defaultStore = createWorkbenchStore({ env: {}, dataDir });
    assert.equal(defaultStore.kind, "postgres");
    await defaultStore.close();
    assert.throws(
      () => createWorkbenchStore({ env: { WORKBENCH_STORE: "unsupported" }, dataDir }),
      /Unsupported WORKBENCH_STORE driver/
    );
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
  }

  console.log("Workbench store interface tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
