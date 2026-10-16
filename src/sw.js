import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkOnly, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// Precache manifest - Workbox injects this automatically
precacheAndRoute(self.__WB_MANIFEST)

// Supabase API: network only, never cache
registerRoute(
  /supabase\.co/,
  new NetworkOnly()
)

// Images: cache first
registerRoute(
  /\.(?:png|jpg|jpeg|webp|svg|ico)$/,
  new CacheFirst({
    cacheName: 'quizbolt-images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
)

// JS/CSS: stale while revalidate
registerRoute(
  /\.(?:js|css)$/,
  new StaleWhileRevalidate({
    cacheName: 'quizbolt-assets',
  })
)

// Push notification handler
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { title: 'QuizBolt', body: event.data?.text() || '' }
  }

  const title = data.title || 'Reminder'
  const targetUrl = data.data?.url || data.url || '/'

  const options = {
    body: data.body || "You haven't taken a test today!",
    icon: data.icon || '/android-chrome-192x192.png',
    badge: data.badge || '/android-chrome-192x192.png',
    tag: data.tag || (data.type === 'chat' ? `chat-${data.connectionId || 'msg'}` : 'quizbolt-notification'),
    data: {
      url: targetUrl,
      type: data.type || 'general',
      connectionId: data.connectionId,
    },
  }

  // If this is a chat message, check if the recipient is currently viewing this exact chat.
  // If the chat with this person is currently open and visible on screen, suppress the push banner.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const isChatPush = data.type === 'chat' || targetUrl.startsWith('/messages/')

      if (isChatPush) {
        const isChatOpenAndVisible = clients.some((client) => {
          try {
            const clientPath = new URL(client.url).pathname
            const isMatch =
              clientPath === targetUrl ||
              (targetUrl !== '/messages' && clientPath.startsWith(targetUrl))
            return isMatch && client.visibilityState === 'visible'
          } catch {
            return false
          }
        })

        // Suppress push notification if recipient is actively in the chat
        if (isChatOpenAndVisible) {
          return
        }
      }

      return self.registration.showNotification(title, options)
    })
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // 1. Try to find a window already on the target URL
      for (const client of clients) {
        try {
          const clientPath = new URL(client.url).pathname
          if (clientPath === targetUrl && 'focus' in client) {
            return client.focus()
          }
        } catch {}
      }

      // 2. Try to find any open QuizBolt window and navigate it to target URL
      for (const client of clients) {
        if ('focus' in client && 'navigate' in client) {
          client.focus()
          return client.navigate(targetUrl)
        }
      }

      // 3. Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})

// Activate and claim clients immediately
self.skipWaiting()
self.addEventListener('activate', () => self.clients.claim())
