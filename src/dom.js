/**
 * dom.js
 * Sichere DOM-Hilfsfunktionen — kein innerHTML mit Nutzerdaten.
 */

export function esc(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function el(tag, opts = {}) {
  const element = document.createElement(tag);
  if (opts.text      != null) element.textContent = String(opts.text);
  if (opts.className != null) element.className   = opts.className;
  if (opts.style     != null) element.style.cssText = opts.style;
  if (opts.title     != null) element.title = opts.title;
  return element;
}

export function setText(element, value) {
  element.textContent = value != null ? String(value) : '';
}