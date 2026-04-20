import { downloadAlsJson } from './defaults.js';
import { syncHinweisText } from './sync.js';

let toastRoot = null;
let dialogRoot = null;

function ensureToastRoot() {
  if (toastRoot && document.body.contains(toastRoot)) return toastRoot;
  toastRoot = document.createElement('div');
  toastRoot.className = 'app-toast-root';
  document.body.appendChild(toastRoot);
  return toastRoot;
}

function ensureDialogRoot() {
  if (dialogRoot && document.body.contains(dialogRoot)) return dialogRoot;
  dialogRoot = document.createElement('div');
  dialogRoot.className = 'app-dialog-backdrop';
  dialogRoot.innerHTML = `
    <div class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title">
      <h2 id="app-dialog-title" class="app-dialog-title"></h2>
      <div class="app-dialog-body"></div>
      <div class="app-dialog-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-dialog-cancel>Abbrechen</button>
        <button type="button" class="btn btn-primary btn-sm" data-dialog-confirm>OK</button>
      </div>
    </div>`;
  document.body.appendChild(dialogRoot);
  return dialogRoot;
}

export function toast(message, type = 'info', timeoutMs = 4200) {
  const root = ensureToastRoot();
  const el = document.createElement('div');
  el.className = `app-toast app-toast-${type}`;
  el.textContent = message;
  root.appendChild(el);
  const remove = () => {
    if (el.parentNode) el.parentNode.removeChild(el);
  };
  const timer = window.setTimeout(remove, timeoutMs);
  el.addEventListener('click', () => {
    window.clearTimeout(timer);
    remove();
  });
  return { remove };
}

export function confirmDialog({
  title = 'Bitte bestätigen',
  body = '',
  confirmText = 'OK',
  cancelText = 'Abbrechen',
  confirmTone = 'primary',
} = {}) {
  const root = ensureDialogRoot();
  const titleEl = root.querySelector('.app-dialog-title');
  const bodyEl = root.querySelector('.app-dialog-body');
  const cancelBtn = root.querySelector('[data-dialog-cancel]');
  const confirmBtn = root.querySelector('[data-dialog-confirm]');

  titleEl.textContent = title;
  bodyEl.textContent = body;
  cancelBtn.textContent = cancelText;
  confirmBtn.textContent = confirmText;
  confirmBtn.className = `btn btn-${confirmTone} btn-sm`;
  root.classList.add('open');

  return new Promise(resolve => {
    const cleanup = result => {
      root.classList.remove('open');
      cancelBtn.removeEventListener('click', onCancel);
      confirmBtn.removeEventListener('click', onConfirm);
      root.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKeyDown);
      resolve(result);
    };
    const onCancel = () => cleanup(false);
    const onConfirm = () => cleanup(true);
    const onBackdrop = event => {
      if (event.target === root) cleanup(false);
    };
    const onKeyDown = event => {
      if (event.key === 'Escape') cleanup(false);
    };

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
    root.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKeyDown);
    confirmBtn.focus();
  });
}

export function renderSyncBanner({
  target,
  status,
  label = 'Daten',
  onReload = null,
  exportData = null,
  exportFilename = 'lokale-kopie.json',
}) {
  if (!target) return;
  if (!status || status.mode === 'synced') {
    target.innerHTML = '';
    target.style.display = 'none';
    return;
  }

  const klass = status.mode === 'conflict'
    ? 'hinweis hinweis-warn'
    : status.mode === 'offline-readonly'
      ? 'hinweis hinweis-error'
      : 'hinweis hinweis-warn';

  target.className = klass;
  target.style.display = '';
  target.innerHTML = '';

  const text = document.createElement('div');
  text.textContent = syncHinweisText(status, label);
  target.appendChild(text);

  if (status.lastError) {
    const detail = document.createElement('div');
    detail.className = 'text-sm';
    detail.style.marginTop = '6px';
    detail.textContent = status.lastError;
    target.appendChild(detail);
  }

  const actions = document.createElement('div');
  actions.className = 'app-sync-actions';

  if (onReload) {
    const reloadBtn = document.createElement('button');
    reloadBtn.type = 'button';
    reloadBtn.className = 'btn btn-ghost btn-sm';
    reloadBtn.textContent = status.mode === 'conflict' ? 'Remote neu laden' : 'Erneut prüfen';
    reloadBtn.addEventListener('click', onReload);
    actions.appendChild(reloadBtn);
  }

  if (exportData && status.mode === 'conflict') {
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'btn btn-ghost btn-sm';
    exportBtn.textContent = 'Lokale Kopie exportieren';
    exportBtn.addEventListener('click', () => {
      const data = typeof exportData === 'function' ? exportData() : exportData;
      downloadAlsJson(data, exportFilename);
      toast('Lokale Kopie exportiert.', 'info');
    });
    actions.appendChild(exportBtn);
  }

  if (actions.childNodes.length) {
    target.appendChild(actions);
  }
}
