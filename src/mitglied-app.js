import { getSession } from './session.js';

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

const session = getSession();
const status = document.getElementById('mitglied-status');
const sperreCard = document.getElementById('mitglied-sperre-card');
const sperre = document.getElementById('mitglied-sperre');

if (status && session) {
  const p = document.createElement('p');
  p.textContent = `${session.name} ist als Mitglied angemeldet. Weitere Funktionen folgen in den nächsten Sprints.`;
  status.appendChild(p);
}

if (session?.lock?.blocked && sperreCard && sperre) {
  sperreCard.style.display = 'block';

  const p = document.createElement('p');
  p.className = 'hinweis hinweis-warn';
  p.textContent = session.lock.reason
    ? `Neue geförderte Wünsche und Lageranfragen sind derzeit gesperrt: ${session.lock.reason}`
    : 'Neue geförderte Wünsche und Lageranfragen sind derzeit gesperrt.';
  sperre.appendChild(p);

  if (session.lock.gesperrtBis) {
    const small = document.createElement('p');
    small.className = 'text-sm';
    small.style.color = 'var(--text-2)';
    small.style.marginTop = '8px';
    small.textContent = `Gesperrt bis: ${session.lock.gesperrtBis}`;
    sperre.appendChild(small);
  }
}
