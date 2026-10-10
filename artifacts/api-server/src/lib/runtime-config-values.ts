export type TenantId = "C9" | "C6";

type RuntimeEnvironment = {
  APP_TENANT?: string;
  TENANT_DATABASE_URL?: string;
  ALLOWED_ORIGINS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
};

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} environment variable is required.`);
  return normalized;
}

export function parseRuntimeConfig(environment: RuntimeEnvironment) {
  const tenantValue = required(environment.APP_TENANT, "APP_TENANT").toUpperCase();
  if (tenantValue !== "C9" && tenantValue !== "C6") {
    throw new Error('APP_TENANT must be either "C9" or "C6".');
  }

  const allowedOrigins = required(environment.ALLOWED_ORIGINS, "ALLOWED_ORIGINS")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (allowedOrigins.length === 0 || allowedOrigins.includes("*")) {
    throw new Error("ALLOWED_ORIGINS must contain explicit origins; wildcards are not allowed.");
  }
  for (const origin of allowedOrigins) {
    try {
      const parsed = new URL(origin);
      const localHttp = parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
      if (parsed.origin !== origin || (parsed.protocol !== "https:" && !localHttp)) throw new Error();
    } catch {
      throw new Error(`ALLOWED_ORIGINS contains an invalid origin: ${origin}`);
    }
  }

  const databaseUrl = required(environment.TENANT_DATABASE_URL, "TENANT_DATABASE_URL");
  let databaseName: string;
  try {
    const parsed = new URL(databaseUrl);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") throw new Error();
    const sslMode = parsed.searchParams.get("sslmode");
    const loopbackHost = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (!["require", "verify-ca", "verify-full"].includes(sslMode ?? "") && !(sslMode === "disable" && loopbackHost)) throw new Error();
    databaseName = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error("TENANT_DATABASE_URL must use SSL, except for a database bound to loopback with sslmode=disable.");
  }

  const expectedDatabaseName = tenantValue === "C9" ? "employee_hub_c9" : "employee_hub_c6";
  if (databaseName !== expectedDatabaseName) {
    throw new Error(`APP_TENANT=${tenantValue} requires the ${expectedDatabaseName} database.`);
  }

  const googleClientId = environment.GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = environment.GOOGLE_CLIENT_SECRET?.trim();
  const googleRedirectUri = environment.GOOGLE_REDIRECT_URI?.trim();
  const googleValues = [googleClientId, googleClientSecret, googleRedirectUri];
  if (googleValues.some(Boolean) && googleValues.some((value) => !value)) {
    throw new Error("Google OAuth settings must be provided together.");
  }
  if (googleRedirectUri) {
    try {
      const parsed = new URL(googleRedirectUri);
      if (parsed.protocol !== "https:" || parsed.pathname !== "/api/auth/google/callback" || parsed.search || parsed.hash) throw new Error();
    } catch {
      throw new Error("GOOGLE_REDIRECT_URI must be the HTTPS API Google callback URL.");
    }
  }

  return Object.freeze({
    tenant: tenantValue as TenantId,
    databaseUrl,
    databaseName,
    allowedOrigins: new Set(allowedOrigins),
    googleOAuth: googleClientId ? Object.freeze({ clientId: googleClientId, clientSecret: googleClientSecret!, redirectUri: googleRedirectUri! }) : null,
  });
}
