import { useEffect } from "react";
import { PUSH_SW_FILE } from "@/lib/push";

export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Remove any stale caching workers, but keep the push-only worker.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        const isPush = [registration.active, registration.waiting, registration.installing].some((w) =>
          w?.scriptURL.endsWith(`/${PUSH_SW_FILE}`)
        );
        if (!isPush) registration.unregister();
      }
    });
    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const key of keys) caches.delete(key);
      });
    }
  }, []);

  return null;
}
