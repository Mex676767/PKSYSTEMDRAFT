// Push-only service worker: shows notifications sent by the send-push edge
// function. It deliberately does no caching or fetch handling (the app's
// ServiceWorkerCleanup clears caches and removes every other worker).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const url = new URL(data.path || "", self.registration.scope).href;
  event.waitUntil(
    self.registration.showNotification(data.title || "C9MYR Hub", {
      body: data.body || "",
      icon: new URL("icon-192.png", self.registration.scope).href,
      badge: new URL("favicon-32.png", self.registration.scope).href,
      tag: data.tag,
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((w) => w.url.startsWith(self.registration.scope));
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate(url).catch(() => {});
        return;
      }
      await self.clients.openWindow(url);
    })()
  );
});
