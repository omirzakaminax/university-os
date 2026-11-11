// Defaults match the local dev cluster in README.md; override in CI with TEST_DATABASE_URL / TEST_DATABASE_ADMIN_URL.
export const TEST_ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://postgres@localhost:54329/university_os_test";
export const TEST_APP_URL = process.env.TEST_DATABASE_URL ?? "postgres://app_server:app_server@localhost:54329/university_os_test";
