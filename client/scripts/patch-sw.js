const fs = require('fs');
const path = require('path');

const outDir = process.argv[2] || 'dist/client/browser';
const workerPath = path.join(outDir, 'ngsw-worker.js');

const MARKER = '/* gst-portal push handlers */';

const handlers = `
/* gst-portal push handlers */
self.addEventListener('push', (event) => {
  let data = { title: 'GST Portal', body: 'You have a new update.', url: '/' };
  try {
    const payload = event.data ? event.data.json() : null;
    if (payload) {
      data = Object.assign(data, {
        title: payload.title || data.title,
        body: payload.body || data.body,
        url: payload.url || data.url,
      });
    }
  } catch (e) {
    data.body = event.data ? event.data.text() : data.body;
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icons/icon-192x192.png',
      badge: 'icons/icon-96x96.png',
      data: { url: data.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'NOTIFY_NAVIGATE', url: targetUrl });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});
`;

if (!fs.existsSync(workerPath)) {
  console.error(`patch-sw: worker not found at ${workerPath}`);
  process.exit(1);
}

const source = fs.readFileSync(workerPath, 'utf-8');
if (source.includes(MARKER)) {
  console.log('patch-sw: already patched, skipping.');
} else {
  fs.writeFileSync(workerPath, source + handlers, 'utf-8');
  console.log(`patch-sw: appended push handlers to ${workerPath}`);
}
