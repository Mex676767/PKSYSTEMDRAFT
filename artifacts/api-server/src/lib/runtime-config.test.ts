import assert from "node:assert/strict";
import test from "node:test";
import { parseRuntimeConfig } from "./runtime-config-values.ts";

const base = {
  APP_TENANT: "C9",
  TENANT_DATABASE_URL: "postgresql://employee:private@db.example:25060/employee_hub_c9?sslmode=require",
  ALLOWED_ORIGINS: "https://c9.example.com",
};

test("tenant config binds C9 API to the C9 database", () => {
  const config = parseRuntimeConfig(base);
  assert.equal(config.tenant, "C9");
  assert.equal(config.databaseName, "employee_hub_c9");
});

test("tenant config rejects a C6 database on the C9 API", () => {
  assert.throws(
    () => parseRuntimeConfig({ ...base, TENANT_DATABASE_URL: base.TENANT_DATABASE_URL.replace("employee_hub_c9", "employee_hub_c6") }),
    /requires the employee_hub_c9 database/,
  );
});

test("tenant config requires SSL and explicit origins", () => {
  assert.throws(() => parseRuntimeConfig({ ...base, TENANT_DATABASE_URL: base.TENANT_DATABASE_URL.replace("?sslmode=require", "") }), /SSL enabled/);
  assert.throws(() => parseRuntimeConfig({ ...base, ALLOWED_ORIGINS: "*" }), /wildcards are not allowed/);
  assert.throws(() => parseRuntimeConfig({ ...base, ALLOWED_ORIGINS: "https://c9.example.com/path" }), /invalid origin/);
});

test("Google OAuth settings must use the tenant API callback", () => {
  assert.equal(parseRuntimeConfig({
    ...base,
    GOOGLE_CLIENT_ID: "c9-client-id",
    GOOGLE_CLIENT_SECRET: "server-only-secret",
    GOOGLE_REDIRECT_URI: "https://api-c9.example.com/api/auth/google/callback",
  }).googleOAuth?.redirectUri, "https://api-c9.example.com/api/auth/google/callback");
  assert.throws(() => parseRuntimeConfig({ ...base, GOOGLE_CLIENT_ID: "partial" }), /provided together/);
  assert.throws(() => parseRuntimeConfig({
    ...base,
    GOOGLE_CLIENT_ID: "c9-client-id",
    GOOGLE_CLIENT_SECRET: "server-only-secret",
    GOOGLE_REDIRECT_URI: "http://api-c9.example.com/api/auth/google/callback",
  }), /HTTPS API Google callback/);
});
