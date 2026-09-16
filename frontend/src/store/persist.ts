// Local-storage backed persistence for the frontend demo store.
// Every entity array in AppStore is loaded from and saved to localStorage
// under the `essolar:v1:<key>` namespace. This lets the whole app run
// against a single source of truth in the browser so a developer/backend
// engineer can see exactly which state each screen reads and writes,
// without any hardcoded in-memory mock arrays.

const NAMESPACE = 'essolar:v1:'

export function loadState<T>(key: string, seedData: T): T {
  if (typeof window === 'undefined') return seedData
  try {
    const raw = window.localStorage.getItem(NAMESPACE + key)
    if (raw === null) {
      // First run: seed localStorage with the realistic demo dataset so the
      // app is populated, then treat localStorage as the source of truth
      // from that point on.
      window.localStorage.setItem(NAMESPACE + key, JSON.stringify(seedData))
      return seedData
    }
    return JSON.parse(raw) as T
  } catch (err) {
    console.error(`[essolar] Failed to load "${key}" from localStorage, falling back to seed data.`, err)
    return seedData
  }
}

export function saveState<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(NAMESPACE + key, JSON.stringify(value))
  } catch (err) {
    console.error(`[essolar] Failed to persist "${key}" to localStorage.`, err)
  }
}

/** Clears every persisted entity and restores the original seed data on next load. */
export function resetAllPersistedState(): void {
  if (typeof window === 'undefined') return
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(NAMESPACE))
    .forEach((k) => window.localStorage.removeItem(k))
}

export const STORAGE_NAMESPACE = NAMESPACE
