/**
 * dom.js
 * Sichere DOM-Hilfsfunktionen — kein innerHTML mit Nutzerdaten.
 */

const RAW_HTML = Symbol('rawHtml');

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

export function raw(html) {
  return { [RAW_HTML]: String(html ?? '') };
}

export function html(strings, ...values) {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) out += renderHtmlValue(values[i]);
  }
  return raw(out);
}

export function setHTML(element, markup) {
  if (markup != null && typeof markup === 'object' && markup[RAW_HTML] != null) {
    element.innerHTML = markup[RAW_HTML];
  } else {
    element.innerHTML = String(markup ?? '');
  }
}

function renderHtmlValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(renderHtmlValue).join('');
  if (typeof value === 'object' && value[RAW_HTML] != null) return value[RAW_HTML];
  return esc(value);
}
