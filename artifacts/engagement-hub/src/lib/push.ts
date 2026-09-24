import { supabase } from "@/lib/supabase";

export const PUSH_SW_FILE = "push-sw.js";

export type PushState = "unsupported" | "denied" | "off" | "on";

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function swUrl() {
  return `${import.meta.env.BASE_URL}${PUSH_SW_FILE}`;
}

async function pushRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  const regs = await navigator.serviceWorker.getRegistrations();
  return regs.find((r) => [r.active, r.waiting, r.installing].some((w) => w?.scriptURL.endsWith(`/${PUSH_SW_FILE}`)));
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await pushRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "===".slice((base64.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function fetchVapidPublicKey(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("send-push", { method: "GET" });
  if (error) throw new Error("Push notifications aren't set up on the server yet.");
  if (!data?.publicKey) throw new Error("Push notifications aren't set up on the server yet.");
  return data.publicKey as string;
}

/** Asks for permission, subscribes this browser and saves it for the signed-in user. */
export async function enablePush(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const reg = (await pushRegistration()) ?? (await navigator.serviceWorker.register(swUrl(), { scope: import.meta.env.BASE_URL }));
  await navigator.serviceWorker.ready;
  const publicKey = await fetchVapidPublicKey();

  let sub = await reg.pushManager.getSubscription();
  // A subscription made with a different server key can't receive our pushes.
  const currentKey = sub?.options.applicationServerKey;
  if (sub && currentKey) {
    const a = new Uint8Array(currentKey);
    const b = urlBase64ToUint8Array(publicKey);
    if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });

  const json = sub.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", {
    endpoint_param: sub.endpoint,
    p256dh_param: json.keys?.p256dh ?? "",
    auth_param: json.keys?.auth ?? "",
    user_agent_param: navigator.userAgent.slice(0, 300),
  });
  if (error) throw error;
  return "on";
}

/** Stops push on this browser (e.g. on sign-out, so the next person doesn't get them). */
export async function disablePush(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  const reg = await pushRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
  return Notification.permission === "denied" ? "denied" : "off";
}
