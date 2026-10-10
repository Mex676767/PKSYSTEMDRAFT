#!/usr/bin/env bash
set -Eeuo pipefail

tenant="${1:-}"
case "$tenant" in
  c9|c6) ;;
  *)
    echo "Usage: $0 c9|c6" >&2
    exit 2
    ;;
esac

source_dir="/opt/employee-hub/$tenant/volumes/storage/stub/stub/post-images"
target_dir="/var/lib/employee-hub/$tenant/uploads/legacy/post-images"
if [[ ! -d "$source_dir" ]]; then
  echo "Expected local Supabase Storage directory was not found for $tenant." >&2
  exit 1
fi

install -d -o 1000 -g 1000 -m 0750 "$target_dir"
cp -a "$source_dir"/. "$target_dir"/

source_count="$(find "$source_dir" -type f -printf '.' | wc -c)"
target_count="$(find "$target_dir" -type f -printf '.' | wc -c)"
if [[ "$source_count" != "$target_count" ]]; then
  echo "Storage file count mismatch for $tenant: source=$source_count target=$target_count" >&2
  exit 1
fi
printf '%s storage files copied for %s.\n' "$target_count" "$tenant"
