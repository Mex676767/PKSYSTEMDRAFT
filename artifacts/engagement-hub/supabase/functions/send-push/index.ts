// Delivers browser push notifications. Deploy with --no-verify-jwt (see
// supabase/PUSH-NOTIFICATIONS.md); it does its own auth:
//
//   GET                     -> { publicKey } for the browser to subscribe with
//   POST { notification_id } with header x-push-secret -> pushes that in-app
//                              notification to every device its recipient
//                              has subscribed. Called by the database trigger
//                              on notifications inserts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPush, type VapidKeys } from "../_shared/web-push.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID: VapidKeys = {
  publicKey: Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
  privateKey: Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
  subject: Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com",
};
const PUSH_WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TITLES: Record<string, string> = {
  comment: "New comment",
  reply: "New reply",
  reaction: "New reaction",
  challenge: "Challenge",
  dm: "New message",
  birthday: "Birthday 🎂",
  goal: "Goal completed 🎯",
  points: "Points earned",
  achievement: "Achievement unlocked 🏆",
};

// Paths are relative to the app's base URL; the service worker resolves them
// against its own scope. Keep in sync with TARGET_LINK in notification-bell.tsx.
const TARGET_PATH: Record<string, string> = {
  goal: "goals",
  birthday: "birthdays",
  post: "social",
  hof_record: "guinness-records",
  challenge: "challenges",
  dm: "messages",
  profile: "profile",
};

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    if (!VAPID.publicKey) return json({ error: "Push notifications aren't configured" }, 503);
    return json({ publicKey: VAPID.publicKey });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const secret = req.headers.get("x-push-secret") ?? "";
    if (!PUSH_WEBHOOK_SECRET || !timingSafeEqual(secret, PUSH_WEBHOOK_SECRET)) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (!VAPID.publicKey || !VAPID.privateKey) return json({ error: "VAPID keys aren't configured" }, 503);

    const { notification_id } = await req.json();
    if (typeof notification_id !== "string") return json({ error: "notification_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: n, error: nError } = await admin
      .from("notifications")
      .select("id, user_id, type, target_type, message")
      .eq("id", notification_id)
      .maybeSingle();
    if (nError) throw nError;
    if (!n) return json({ error: "Notification not found" }, 404);

    const { data: subs, error: subsError } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", n.user_id);
    if (subsError) throw subsError;
    if (!subs?.length) return json({ sent: 0, removed: 0 });

    const target = n.target_type ?? (n.type === "dm" ? "dm" : n.type);
    const payload = {
      title: TITLES[n.type] ?? "C9MYR Hub",
      body: String(n.message ?? "").slice(0, 300),
      path: TARGET_PATH[target] ?? "",
      tag: n.id,
    };

    const results = await Promise.allSettled(
      subs.map((s) => sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload, VAPID))
    );

    const gone = subs.filter((_, i) => {
      const r = results[i];
      return r.status === "fulfilled" && r.value.gone;
    });
    if (gone.length) {
      await admin.from("push_subscriptions").delete().in("id", gone.map((s) => s.id));
    }

    const sent = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
    const failures = results
      .map((r) => (r.status === "rejected" ? String(r.reason) : r.value.ok || r.value.gone ? null : `${r.value.status} ${r.value.body ?? ""}`))
      .filter(Boolean);
    return json({ sent, removed: gone.length, failures });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
