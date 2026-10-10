#!/bin/sh
set -eu

: "${TENANT_DATABASE_NAME:?TENANT_DATABASE_NAME is required}"
: "${TENANT_DATABASE_USER:?TENANT_DATABASE_USER is required}"
: "${TENANT_DATABASE_PASSWORD:?TENANT_DATABASE_PASSWORD is required}"

psql --set=ON_ERROR_STOP=1 \
  --set=tenant_user="$TENANT_DATABASE_USER" \
  --set=tenant_password="$TENANT_DATABASE_PASSWORD" \
  --set=tenant_database="$TENANT_DATABASE_NAME" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS PASSWORD %L', :'tenant_user', :'tenant_password') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'tenant_database', :'tenant_user') \gexec
SELECT format('GRANT service_role TO %I', :'tenant_user') \gexec
SQL

unset TENANT_DATABASE_PASSWORD
