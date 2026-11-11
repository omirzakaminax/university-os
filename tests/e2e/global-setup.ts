import { migrate } from "../../scripts/migrate";

export default async function globalSetup() {
  await migrate({ url: process.env.E2E_DATABASE_ADMIN_URL ?? "postgres://postgres@localhost:54329/university_os_e2e", shim: true, reset: true, log: () => {} });
}
