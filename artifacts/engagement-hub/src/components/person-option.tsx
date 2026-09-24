import { UserAvatar } from "@/components/user-avatar";
import { colorForId, initialsForUsername } from "@/hooks/use-auth";
import type { SelectOption } from "@/components/searchable-select";

type PersonLike = {
  id: string;
  username: string | null;
  avatar_url?: string | null;
  active_border?: string | null;
  active_accessory?: string | null;
  role?: string | null;
  department?: string | null;
};

/** A dropdown option for a person: small avatar, @username, role · department. */
export function personOption(p: PersonLike): SelectOption {
  const name = p.username ?? "unknown";
  const description = [p.role, p.department].filter(Boolean).join(" · ") || undefined;
  return {
    value: p.id,
    label: `@${name}`,
    description,
    keywords: [name],
    leading: (
      <UserAvatar
        user={{ name, initials: initialsForUsername(name), color: colorForId(p.id) }}
        photoUrl={p.avatar_url ?? null}
        className="w-6 h-6 text-[9px] border"
      />
    ),
  };
}
