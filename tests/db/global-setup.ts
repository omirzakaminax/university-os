import { migrate } from "../../scripts/migrate";
import { TEST_ADMIN_URL } from "./urls";

/** Rebuild the test database from scratch (shim + all migrations) before the DB test project runs. */
export default async function setup() {
  await migrate({ url: TEST_ADMIN_URL, shim: true, reset: true, log: () => {} });
}
