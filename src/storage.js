/**
 * storage.js
 * Einheitlicher Wrapper für localStorage.
 *
 * Öffentliche API:
 *   load(key)        → any | null
 *   save(key, value) → void
 *   remove(key)      → void
 */

export function load(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function remove(key) {
  localStorage.removeItem(key);
}