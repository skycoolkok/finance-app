const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

const envFiles = [path.resolve(__dirname, '../.env.local'), path.resolve(__dirname, '../.env')]

envFiles.forEach(file => {
  if (fs.existsSync(file)) {
    dotenv.config({ path: file, override: false })
  }
})

const requiredKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

function ensureConfig() {
  const missing = requiredKeys.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `Missing required Firebase environment variables: ${missing.join(', ')}. ` +
        'Please define them in .env / .env.local or the deployment environment.',
    )
  }

  return {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  }
}

function createServiceWorker(config) {
  return `const CACHE_NAME = 'finance-app-cache-v1';
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

  firebase.initializeApp(${JSON.stringify(config)});

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
`
}

function main() {
  const config = ensureConfig()
  const swContent = createServiceWorker(config)
  const outputPath = path.resolve(__dirname, '../public/firebase-messaging-sw.js')
  fs.writeFileSync(outputPath, swContent, 'utf8')
  console.log(`Generated firebase-messaging-sw.js at ${outputPath}`)
}

main()
