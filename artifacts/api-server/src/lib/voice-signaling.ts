export function validSignalAcknowledgments(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 100 && value.every((id) =>
    typeof id === "string" && /^[1-9][0-9]{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n,
  );
}

// Explicitly exclude acknowledgments: data-modifying CTEs and the SELECT see
// the same snapshot. Scope both deletion and reads to this tenant's caller.
export const exchangeVoiceSignalsSql = `
  with acknowledged as (
    delete from public.voice_signals
    where channel_id=$1 and to_user_id=$2 and id=any($3::bigint[])
  )
  select id::text,payload from public.voice_signals
  where channel_id=$1 and to_user_id=$2 and not (id=any($3::bigint[]))
    and created_at > now()-interval '60 seconds'
  order by voice_signals.id limit 100`;
