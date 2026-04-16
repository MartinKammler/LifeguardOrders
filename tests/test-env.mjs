import { webcrypto } from 'node:crypto';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value) {
  return String(value).replace(/<[^>]*>/g, '');
}

class StyleDeclaration {
  constructor() {
    this.cssText = '';
  }
}

export class HTMLElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.className = '';
    this.title = '';
    this.style = new StyleDeclaration();
    this.dataset = {};
    this._id = '';
    this._textContent = '';
    this._innerHTML = '';
    this._ownerDocument = null;
  }

  get id() {
    return this._id;
  }

  set id(value) {
    this._id = String(value || '');
    if (this._ownerDocument && this._id) {
      this._ownerDocument.__elements.set(this._id, this);
    }
  }

  get textContent() {
    if (this._textContent) return this._textContent;
    if (this.children.length) {
      return this.children.map(child => child.textContent).join('');
    }
    return '';
  }

  set textContent(value) {
    this._textContent = value == null ? '' : String(value);
    this._innerHTML = escapeHtml(this._textContent);
    this.children = [];
  }

  get innerHTML() {
    if (this.children.length) {
      return this.children.map(child => child.outerHTML ?? escapeHtml(child.textContent)).join('');
    }
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = value == null ? '' : String(value);
    this._textContent = stripHtml(this._innerHTML);
    this.children = [];
  }

  get outerHTML() {
    const attrs = this.id ? ` id="${escapeHtml(this.id)}"` : '';
    return `<${this.tagName.toLowerCase()}${attrs}>${this.innerHTML}</${this.tagName.toLowerCase()}>`;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }
}

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(String(key), String(value));
  }

  removeItem(key) {
    this.map.delete(String(key));
  }

  clear() {
    this.map.clear();
  }
}

class TestDocument {
  constructor(seedElements = []) {
    this.__elements = new Map();
    this.body = this.createElement('body');

    for (const { tagName, id } of seedElements) {
      const element = this.createElement(tagName);
      element.id = id;
      this.body.appendChild(element);
    }
  }

  createElement(tagName) {
    const element = new HTMLElement(tagName);
    element._ownerDocument = this;
    return element;
  }

  getElementById(id) {
    return this.__elements.get(String(id)) || null;
  }

  snapshot() {
    return {
      elements: Object.fromEntries(
        [...this.__elements.entries()].map(([id, element]) => [
          id,
          {
            tagName: element.tagName,
            textContent: element.textContent,
            innerHTML: element.innerHTML,
            className: element.className,
          },
        ])
      ),
    };
  }
}

export function installTestDom(seedElements = []) {
  const document = new TestDocument(seedElements);

  defineGlobal('HTMLElement', HTMLElement);
  defineGlobal('document', document);
  defineGlobal('window', globalThis);
  defineGlobal('localStorage', new MemoryStorage());
  defineGlobal('sessionStorage', new MemoryStorage());
  defineGlobal('navigator', { clipboard: { writeText: async () => {} } });
  defineGlobal('alert', () => {});
  defineGlobal('confirm', () => true);
  defineGlobal('atob', (value) => Buffer.from(String(value), 'base64').toString('binary'));
  defineGlobal('btoa', (value) => Buffer.from(String(value), 'binary').toString('base64'));
  defineGlobal('crypto', globalThis.crypto || webcrypto);
  defineGlobal('__htmlTestHarness__', {
    snapshot: () => document.snapshot(),
  });
}

function defineGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}
