#!/usr/bin/env bash
set -Eeuo pipefail

tenant="${1:-}"
case "$tenant" in
  c9)
    source_container="c9-supabase-db-1"
    target_container="employee-hub-c9-db"
    target_database="employee_hub_c9"
    ;;
  c6)
    source_container="c6-supabase-db-1"
    target_container="employee-hub-c6-db"
    target_database="employee_hub_c6"
    ;;
  *)
    echo "Usage: $0 c9|c6" >&2
    exit 2
    ;;
esac

if ! docker inspect "$source_container" >/dev/null 2>&1 || ! docker inspect "$target_container" >/dev/null 2>&1; then
  echo "Both the source and target tenant databases must be running." >&2
  exit 1
fi

existing_rows="$(docker exec "$target_container" psql -X -A -t -U postgres -d "$target_database" -c \
  "select (select count(*) from public.profiles), (select count(*) from public.api_password_credentials), (select count(*) from public.api_oauth_identities)")"
if [[ "$existing_rows" != "0|0|0" ]]; then
  echo "Target already contains profile or identity data; refusing to overwrite or duplicate it." >&2
  exit 1
fi

docker exec "$source_container" pg_dump -U supabase_admin -d postgres \
  --data-only --schema=public --no-owner --no-privileges --disable-triggers \
  | docker exec -i "$target_container" psql -X -v ON_ERROR_STOP=1 --single-transaction -U postgres -d "$target_database"

docker exec "$source_container" psql -X -q -A -t -U supabase_admin -d postgres -c \
  "COPY (SELECT id, encrypted_password FROM auth.users WHERE nullif(encrypted_password, '') IS NOT NULL) TO STDOUT WITH CSV" \
  | docker exec -i "$target_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$target_database" -c \
  '\copy public.api_password_credentials (user_id, password_hash) FROM STDIN WITH CSV'

docker exec "$source_container" psql -X -q -A -t -U supabase_admin -d postgres -c \
  "COPY (SELECT user_id, 'google', provider_id FROM auth.identities WHERE provider = 'google' AND provider_id IS NOT NULL) TO STDOUT WITH CSV" \
  | docker exec -i "$target_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$target_database" -c \
  '\copy public.api_oauth_identities (user_id, provider, provider_subject) FROM STDIN WITH CSV'

docker exec "$target_container" psql -X -A -t -U postgres -d "$target_database" -c \
  "select (select count(*) from public.profiles) as profiles, (select count(*) from public.api_password_credentials) as email_passwords, (select count(*) from public.api_oauth_identities where provider = 'google') as google_identities"
