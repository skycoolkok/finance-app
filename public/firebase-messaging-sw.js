// BuildId: local
const CACHE_NAME = 'finance-app-cache-v1';
const ASSETS_TO_CACHE = ['/', '/index.html', '/manifest.webmanifest', '/vite.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then(response => {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clonedResponse));
          return response;
        })
        .catch(() => cachedResponse);
    }),
  );
});

try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

  firebase.initializeApp({"apiKey":"AIzaSyBcTfagYzYGD3ZS6EkxuyZ2SdlVSUFGIJc","authDomain":"finance-app-483fc.firebaseapp.com","projectId":"finance-app-483fc","storageBucket":"finance-app-483fc.firebasestorage.app","messagingSenderId":"467300077631","appId":"1:467300077631:web:66a3f4b384a70b4c83e88a"});

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(payload => {
    const notification = payload.notification || {};
    const title = notification.title || 'Finance App';
    const options = {
      body: notification.body,
      icon: notification.icon || '/vite.svg',
      data: payload.data,
    };

    self.registration.showNotification(title, options);
  });
} catch (error) {
  console.error('Failed to initialise Firebase messaging in service worker', error);
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.focus) {
          client.focus();
        }
        if (client.navigate) {
          return client.navigate(targetUrl);
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
