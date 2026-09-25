// The hub moved to https://c9.mextest67.workers.dev. This replaces the old
// address's push worker and removes itself, which also cancels this device's
// old push subscription (the server drops it the next time it tries to send),
// so nobody gets every notification twice after turning push on at the new
// address.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.registration.unregister()));
self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("C9MYR Hub has moved", {
      body: "Open c9.mextest67.workers.dev and turn notifications on again from the bell.",
      data: { url: "https://c9.mextest67.workers.dev" },
    }).then(() => self.registration.unregister())
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("https://c9.mextest67.workers.dev"));
});
