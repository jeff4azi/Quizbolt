import { supabase } from '../supabaseClient'

// Push notification state is split into three independent layers:
//   1. intent   — does this user want push? (per-user, localStorage)
//   2. browser  — the PushManager subscription (per install)
//   3. database — one row per (user_id, device_id)
//
// Read paths here are deliberately PURE. They never unsubscribe the browser on
// an inconclusive answer (offline, network error, expired session) — doing that
// is what caused the toggle to silently switch itself off.

const INTENT_KEY_PREFIX = 'quizbolt_notifications_enabled'
const DEVICE_ID_KEY = 'quizbolt_device_id'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

// ── Device identity ───────────────────────────────────────────────────────────

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return 'unknown-device'
  }
}

function getDeviceMeta() {
  const ua = navigator.userAgent || ''
  const platform = /android/i.test(ua)
    ? 'Android'
    : /iphone|ipad|ipod/i.test(ua)
      ? 'iOS'
      : /windows/i.test(ua)
        ? 'Windows'
        : /macintosh|mac os/i.test(ua)
          ? 'macOS'
          : /linux/i.test(ua)
            ? 'Linux'
            : 'Unknown'

  let browser = 'Browser'
  if (/edg/i.test(ua)) browser = 'Edge'
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome'
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox'
  else if (/safari/i.test(ua)) browser = 'Safari'

  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true

  return {
    platform,
    label: `${platform} · ${browser}${standalone ? ' (App)' : ''}`,
  }
}

// ── Per-user intent ───────────────────────────────────────────────────────────

const intentKey = (userId) =>
  userId ? `${INTENT_KEY_PREFIX}:${userId}` : INTENT_KEY_PREFIX

export function getNotificationsIntent(userId) {
  try {
    return localStorage.getItem(intentKey(userId)) === 'true'
  } catch {
    return false
  }
}

export function setNotificationsIntent(userId, enabled) {
  try {
    localStorage.setItem(intentKey(userId), String(enabled))
  } catch {
    // ignore
  }
}

// Local read — getSession() reads the persisted session, it does not hit the
// network, so it is safe to call while offline.
async function getCurrentUserId() {
  try {
    const { data } = await supabase.auth.getSession()
    return data?.session?.user?.id ?? null
  } catch {
    return null
  }
}

// ── Pure read ─────────────────────────────────────────────────────────────────

export async function getPushState() {
  if (!isPushSupported()) {
    return {
      supported: false,
      permission: 'unsupported',
      hasBrowserSubscription: false,
      intent: false,
    }
  }

  const permission =
    typeof Notification !== 'undefined' ? Notification.permission : 'default'

  let hasBrowserSubscription = false
  if (permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = registration
        ? await registration.pushManager.getSubscription()
        : null
      hasBrowserSubscription = !!subscription
    } catch {
      // ignore — treat as no subscription
    }
  }

  const userId = await getCurrentUserId()
  return {
    supported: true,
    permission,
    hasBrowserSubscription,
    intent: getNotificationsIntent(userId),
  }
}

// ── Server registration ───────────────────────────────────────────────────────

async function registerSubscription(subscription) {
  const subJson = subscription.toJSON()
  const { platform, label } = getDeviceMeta()

  const { error } = await supabase.rpc('register_push_subscription', {
    p_device_id: getDeviceId(),
    p_endpoint: subJson.endpoint,
    p_p256dh: subJson.keys.p256dh,
    p_auth: subJson.keys.auth,
    p_device_label: label,
    p_platform: platform,
  })

  if (error) throw error
}

// ── Explicit enable / disable (user action) ───────────────────────────────────

export async function enablePush() {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser')
  }

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    throw new Error('Push notifications are not configured')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked. Enable them in your browser settings.'
        : 'Notification permission was dismissed',
    )
  }

  const userId = await getCurrentUserId()
  if (!userId) throw new Error('You need to be signed in to enable notifications')

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }

  // If this throws the browser subscription is kept on purpose — reconcilePush()
  // will re-register it on the next load instead of silently dropping it.
  await registerSubscription(subscription)

  setNotificationsIntent(userId, true)
  return subscription
}

export async function disablePush() {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('device_id', getDeviceId())
    } catch (err) {
      console.error('Failed to remove device subscription:', err)
    }
  }

  if (isPushSupported()) {
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = registration
        ? await registration.pushManager.getSubscription()
        : null
      if (subscription) await subscription.unsubscribe()
    } catch (err) {
      console.error('Failed to unsubscribe browser subscription:', err)
    }
  }

  setNotificationsIntent(userId, false)
}

// ── Logout: detach only this device ───────────────────────────────────────────

export async function detachDeviceOnLogout(userId) {
  if (!userId) return

  try {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', getDeviceId())
  } catch (err) {
    console.error('Failed to detach device subscription on logout:', err)
  }

  // The browser subscription is intentionally left in place: it belongs to the
  // install, and another account on this device may still be using it. Keeping
  // it also means re-enabling later needs no new permission prompt. Intent is
  // preserved too, so signing back in restores push automatically.
}

// ── Self-healing reconcile (non-destructive) ──────────────────────────────────

let inFlight = null

export function reconcilePush() {
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      if (!isPushSupported()) return

      const userId = await getCurrentUserId()
      if (!userId) return

      // Only reconcile when the user has opted in.
      if (!getNotificationsIntent(userId)) return

      if (typeof Notification === 'undefined') return
      if (Notification.permission === 'denied') {
        // Permission revoked outside the app — intent can no longer be honoured.
        setNotificationsIntent(userId, false)
        return
      }
      if (Notification.permission !== 'granted') return

      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) return

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
              import.meta.env.VITE_VAPID_PUBLIC_KEY,
            ),
          })
        } catch (err) {
          // Usually offline. Keep intent and try again next time.
          console.warn('[push] reconcile could not create subscription:', err)
          return
        }
      }

      // Re-assert the endpoint (refreshes last_seen_at, repairs a rotated
      // endpoint). Failures are swallowed so we never touch browser state.
      await registerSubscription(subscription)
    } catch (err) {
      console.warn('[push] reconcile failed, will retry later:', err)
    }
  })().finally(() => {
    inFlight = null
  })

  return inFlight
}

// ── Device management ─────────────────────────────────────────────────────────

export async function getSubscribedDevices() {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, device_id, device_label, platform, last_seen_at')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false })

  if (error) throw error

  const deviceId = getDeviceId()
  return (data || []).map((row) => ({
    ...row,
    isThisDevice: row.device_id === deviceId,
  }))
}

export async function removeDevice(id) {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('id', id)

  if (error) throw error
}
