"use client"

// Sounds and desktop notifications for work that finishes while the person
// isn't watching: a bot's reply, or a background task.

const PREFERENCE_KEY = "arlo:notifications"
const PREFERENCE_EVENT = "arlo:notifications-change"

// On unless the person turned them off. Desktop popups also need the
// browser's permission, which is asked for from the user menu.
export function getNotificationsEnabled() {
  return localStorage.getItem(PREFERENCE_KEY) !== "off"
}

export function setNotificationsEnabled(enabled: boolean) {
  localStorage.setItem(PREFERENCE_KEY, enabled ? "on" : "off")
  window.dispatchEvent(new Event(PREFERENCE_EVENT))
}

// For useSyncExternalStore. "storage" covers changes from other tabs.
export function subscribeToNotificationsEnabled(onChange: () => void) {
  window.addEventListener(PREFERENCE_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(PREFERENCE_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

export function canShowDesktopNotifications() {
  return "Notification" in window
}

export function desktopPermission(): NotificationPermission {
  return canShowDesktopNotifications() ? Notification.permission : "denied"
}

export async function requestDesktopPermission() {
  if (!canShowDesktopNotifications()) return "denied"
  return Notification.requestPermission()
}

// Hidden behind another tab or window, or the window isn't focused
export function isAway() {
  return document.visibilityState === "hidden" || !document.hasFocus()
}

let audio: AudioContext | undefined

// A soft two-note chime, made in the browser so there's no file to load
export function playChime() {
  try {
    audio ??= new AudioContext()
    // Browsers suspend audio until the page has been interacted with
    void audio.resume()
    const start = audio.currentTime
    for (const [i, frequency] of [880, 1320].entries()) {
      const at = start + i * 0.12
      const tone = audio.createOscillator()
      const volume = audio.createGain()
      tone.type = "sine"
      tone.frequency.value = frequency
      volume.gain.setValueAtTime(0, at)
      volume.gain.linearRampToValueAtTime(0.15, at + 0.01)
      volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.5)
      tone.connect(volume).connect(audio.destination)
      tone.start(at)
      tone.stop(at + 0.5)
    }
  } catch (error) {
    console.error("Failed to play notification sound", error)
  }
}

// With the app open in several tabs, each one hears about the same event.
// The first to claim its key notifies; the lock keeps the check and the claim
// together.
const CLAIM_PREFIX = "arlo:notified:"
const CLAIM_TTL = 24 * 60 * 60 * 1000

async function claim(key: string) {
  const storageKey = `${CLAIM_PREFIX}${key}`
  const check = () => {
    pruneClaims()
    if (localStorage.getItem(storageKey)) return false
    localStorage.setItem(storageKey, String(Date.now()))
    return true
  }
  if (!("locks" in navigator)) return check()
  return navigator.locks.request(storageKey, check)
}

// Events are only heard about while they're fresh, so old claims can go
function pruneClaims() {
  const now = Date.now()
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (!key?.startsWith(CLAIM_PREFIX)) continue
    if (now - Number(localStorage.getItem(key)) > CLAIM_TTL) {
      localStorage.removeItem(key)
    }
  }
}

export type Notice = {
  // The same event always has the same key, so it's notified once
  key: string
  title: string
  body?: string
  // Opens what finished, when the desktop notification is clicked
  onClick?: () => void
}

// Plays the chime, and shows a desktop notification if the person is away
// and allowed them. Returns whether it notified at all.
export async function notify({ key, title, body, onClick }: Notice) {
  if (!getNotificationsEnabled()) return false
  if (!(await claim(key))) return false

  playChime()
  if (isAway() && desktopPermission() === "granted") {
    const notification = new Notification(title, {
      body,
      tag: key,
      icon: "/logo.png",
    })
    notification.onclick = () => {
      window.focus()
      onClick?.()
      notification.close()
    }
  }
  return true
}
