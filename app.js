'use strict';

/* ───────────────────────── Storage ───────────────────────── */
const STORE_KEY = 'mandarin-deck-v1';
const SESSION_SIZE = 20;
const INTERVALS = [0, 1, 3, 7, 16]; // days until due, indexed by (box - 1)

const defaultState = () => ({ progress: {}, totals: { got: 0, miss: 0 } });

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    if (!s.progress) s.progress = {};
    if (!s.totals) s.totals = { got: 0, miss: 0 };
    return s;
  } catch (e) {
    return defaultState();
  }
}
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Could not save — storage may be full or blocked.'); }
}

let state = loadState();
let CARDS = [];
let CATS = {};

/* ───────────────────────── Helpers ───────────────────────── */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const now = () => Date.now();
const DAY = 86400000;

function prog(id) {
  if (!state.progress[id]) state.progress[id] = { box: 1, got: 0, miss: 0, last: 0 };
  return state.progress[id];
}
function isDue(id) {
  const p = state.progress[id];
  if (!p || !p.last) return true;                 // never studied → due
  return now() >= p.last + INTERVALS[p.box - 1] * DAY;
}
function shuffle(arr) {                            // Fisher–Yates
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ───────────────────────── Session state ───────────────────────── */
let selectedCat = 'all';
let direction = 'pinyin';   // 'pinyin' = pinyin→english ; 'english' = english→pinyin
let deck = [];
let pos = 0;
let flipped = false;
let roundGot = 0, roundMiss = 0;
let roundMissedCards = [];

/* ───────────────────────── Views ───────────────────────── */
function show(id) {
  $$('.view').forEach(v => v.classList.toggle('is-active', v.id === id));
  if (id === 'home') renderHome();
  if (id === 'stats') renderStats();
  window.scrollTo(0, 0);
}

/* ───────────────────────── Home ───────────────────────── */
function setOf(cat) {
  return cat === 'all' ? CARDS : CARDS.filter(c => c.category === cat);
}
function renderHome() {
  const due = CARDS.filter(c => isDue(c.id)).length;
  const mastered = CARDS.filter(c => (state.progress[c.id]?.box || 1) >= 5).length;
  const { got, miss } = state.totals;
  $('#dash-due').textContent = due;
  $('#dash-mastered').textContent = mastered;
  $('#dash-acc').textContent = (got + miss) ? Math.round(got / (got + miss) * 100) + '%' : '—';

  const chips = $('#cat-chips');
  if (!chips.dataset.built) {
    const make = (key, label, count) => {
      const b = document.createElement('button');
      b.className = 'chip' + (key === selectedCat ? ' is-on' : '');
      b.dataset.cat = key;
      b.innerHTML = `${label}<small>${count}</small>`;
      b.addEventListener('click', () => {
        selectedCat = key;
        $$('.chip', chips).forEach(c => c.classList.toggle('is-on', c.dataset.cat === key));
      });
      return b;
    };
    chips.appendChild(make('all', 'All', CARDS.length));
    Object.entries(CATS).forEach(([key, label]) => {
      const n = CARDS.filter(c => c.category === key).length;
      if (n) chips.appendChild(make(key, label, n));
    });
    chips.dataset.built = '1';
  }
}

/* ───────────────────────── Build & run a session ───────────────────────── */
function startSession() {
  const set = setOf(selectedCat);
  if (!set.length) { toast('That set is empty.'); return; }

  const dueCards = set.filter(c => isDue(c.id));
  let chosen = dueCards;
  if (chosen.length < SESSION_SIZE) {            // top up with lowest-box cards so it's never thin
    const rest = set
      .filter(c => !isDue(c.id))
      .sort((a, b) => (state.progress[a.id]?.box || 1) - (state.progress[b.id]?.box || 1));
    chosen = chosen.concat(rest.slice(0, SESSION_SIZE - chosen.length));
  }
  deck = shuffle(chosen).slice(0, SESSION_SIZE);  // random order
  pos = 0; roundGot = 0; roundMiss = 0; roundMissedCards = [];
  show('study');
  renderCard();
}

function renderCard() {
  const card = deck[pos];
  flipped = false;
  $('#card').classList.remove('is-flipped');
  $('#actions').classList.remove('is-ready');
  $('#study-count').textContent = `${pos + 1}/${deck.length}`;
  $('#sbar').style.width = (pos / deck.length * 100) + '%';

  const frontText = $('#front-text');
  const frontTag = $('#front-tag');
  frontTag.textContent = CATS[card.category] || '';

  if (direction === 'pinyin') {
    frontText.textContent = card.front;
    frontText.classList.remove('is-han');
    $('#back-text').textContent = card.back;
    $('#back-sub').textContent = '';
  } else {
    frontText.textContent = card.back;
    frontText.classList.remove('is-han');
    $('#back-text').textContent = card.front;
    $('#back-sub').textContent = '';
  }

  // box pips
  const box = state.progress[card.id]?.box || 1;
  const pips = $('#back-pips');
  pips.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const d = document.createElement('span');
    d.className = 'pip' + (i <= box ? (box >= 5 ? ' gold' : ' on') : '');
    pips.appendChild(d);
  }
}

function flipCard() {
  flipped = !flipped;
  $('#card').classList.toggle('is-flipped', flipped);
  $('#actions').classList.toggle('is-ready', flipped);
}

/* ── Grade feedback animations ────────── */
let grading = false;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let confettiLayer;

function celebrate(originEl) {
  if (reduceMotion() || !originEl) return;
  if (!confettiLayer) {
    confettiLayer = document.createElement('div');
    confettiLayer.className = 'confetti-layer';
    document.body.appendChild(confettiLayer);
  }
  const r = originEl.getBoundingClientRect();
  const ox = r.left + r.width / 2;
  const oy = r.top + r.height / 2;
  const colors = ['#2E8B72', '#3FA98C', '#C8341B', '#C39A4A', '#F6F2E9'];
  const N = 18;
  for (let i = 0; i < N; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const size = 6 + Math.random() * 6;
    piece.style.width = size + 'px';
    piece.style.height = (size * (0.55 + Math.random() * 0.7)).toFixed(1) + 'px';
    piece.style.left = ox + 'px';
    piece.style.top = oy + 'px';
    piece.style.background = colors[i % colors.length];
    piece.style.borderRadius = Math.random() < 0.5 ? '2px' : '50%';
    confettiLayer.appendChild(piece);

    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * Math.PI * 0.9; // mostly upward
    const dist = 55 + Math.random() * 95;
    const dx = Math.cos(angle) * dist;
    const peak = Math.sin(angle) * dist;            // negative = rises
    const fall = 110 + Math.random() * 130;
    const rot = (Math.random() - 0.5) * 720;
    const dur = 700 + Math.random() * 500;
    const anim = piece.animate([
      { transform: 'translate(-50%,-50%) translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(-50%,-50%) translate(${dx * 0.6}px, ${peak}px) rotate(${rot * 0.5}deg)`, opacity: 1, offset: 0.35 },
      { transform: `translate(-50%,-50%) translate(${dx}px, ${fall}px) rotate(${rot}deg)`, opacity: 0 }
    ], { duration: dur, easing: 'cubic-bezier(.18,.7,.32,1)' });
    anim.onfinish = () => piece.remove();
  }
}

function pop(btn) {
  if (reduceMotion() || !btn) return;
  btn.classList.remove('is-pop'); void btn.offsetWidth; btn.classList.add('is-pop');
  setTimeout(() => btn.classList.remove('is-pop'), 380);
}

function gloom(btn) {
  if (reduceMotion() || !btn) return;
  btn.classList.remove('is-gloom'); void btn.offsetWidth; btn.classList.add('is-gloom');
  setTimeout(() => btn.classList.remove('is-gloom'), 780);
}

function grade(result) {
  if (!flipped || grading) return;
  grading = true;
  const card = deck[pos];
  const p = prog(card.id);
  const gotBtn = $('.grade-got');
  const missBtn = $('.grade-miss');

  if (result === 'got') {
    p.box = Math.min(5, p.box + 1); p.got++; state.totals.got++; roundGot++;
    pop(gotBtn); celebrate(gotBtn);
  } else {
    p.box = 1; p.miss++; state.totals.miss++; roundMiss++; roundMissedCards.push(card);
    gloom(missBtn);
  }
  p.last = now();
  saveState();

  const delay = reduceMotion() ? 0 : (result === 'got' ? 420 : 560);
  setTimeout(() => {
    grading = false;
    if (!$('#study').classList.contains('is-active')) return; // user navigated away
    pos++;
    if (pos >= deck.length) finishSession();
    else renderCard();
  }, delay);
}

function finishSession() {
  $('#sbar').style.width = '100%';
  const total = roundGot + roundMiss;
  $('#done-got').textContent = roundGot;
  $('#done-miss').textContent = roundMiss;
  $('#done-rate').textContent = total ? Math.round(roundGot / total * 100) + '%' : '0%';

  const block = $('#missed-block');
  const list = $('#missed-list');
  list.innerHTML = '';
  if (roundMissedCards.length) {
    roundMissedCards.forEach(c => {
      const li = document.createElement('li');
      li.className = 'missed-item';
      const f = document.createElement('span');
      f.className = 'm-front'; f.textContent = c.front;
      const b = document.createElement('span');
      b.className = 'm-back'; b.textContent = c.back;
      li.appendChild(f); li.appendChild(b);
      list.appendChild(li);
    });
    block.hidden = false;
  } else {
    block.hidden = true;
  }
  show('done');
}

/* ───────────────────────── Stats ───────────────────────── */
function renderStats() {
  const counts = [0, 0, 0, 0, 0];
  let seen = 0;
  CARDS.forEach(c => {
    const p = state.progress[c.id];
    const box = p?.box || 1;
    counts[box - 1]++;
    if (p && p.last) seen++;
  });
  const boxes = $('#boxes');
  boxes.innerHTML = '';
  counts.forEach((n, i) => {
    const el = document.createElement('div');
    el.className = 'box' + (i === 4 && n ? ' b5' : (n ? ' bhas' : ''));
    el.innerHTML = `<span class="box-n">${n}</span><span class="box-l">box ${i + 1}</span>`;
    boxes.appendChild(el);
  });
  const { got, miss } = state.totals;
  $('#s-total').textContent = CARDS.length;
  $('#s-seen').textContent = seen;
  $('#s-acc').textContent = (got + miss) ? Math.round(got / (got + miss) * 100) + '%' : '—';
}

/* ───────────────────────── Backup ───────────────────────── */
function exportProgress() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url; a.download = `mandarin-progress-${stamp}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Progress exported.');
}
function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object' || !data.progress) throw new Error('bad');
      state = { progress: data.progress, totals: data.totals || { got: 0, miss: 0 } };
      saveState();
      toast('Progress restored.');
      renderStats();
    } catch (e) {
      toast('That file could not be read.');
    }
  };
  reader.readAsText(file);
}
function resetAll() {
  if (!confirm('Erase all progress and box positions? This cannot be undone.')) return;
  state = defaultState();
  saveState();
  toast('Progress reset.');
  renderStats();
}

/* ───────────────────────── Toast ───────────────────────── */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ───────────────────────── Wire up ───────────────────────── */
function bind() {
  $$('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));

  $('#dir-seg').addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn'); if (!btn) return;
    direction = btn.dataset.dir;
    $$('.seg-btn', $('#dir-seg')).forEach(b => b.classList.toggle('is-on', b === btn));
  });

  $('#start-btn').addEventListener('click', startSession);
  $('#again-btn').addEventListener('click', startSession);

  const card = $('#card');
  card.addEventListener('click', flipCard);
  card.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipCard(); }
  });

  $('#actions').addEventListener('click', e => {
    const btn = e.target.closest('.grade'); if (!btn) return;
    grade(btn.dataset.grade);
  });

  // keyboard shortcuts (handy when testing on desktop)
  document.addEventListener('keydown', e => {
    if (!$('#study').classList.contains('is-active')) return;
    if (e.key === 'ArrowLeft')  grade('miss');
    if (e.key === 'ArrowRight') grade('got');
  });

  $('#export-btn').addEventListener('click', exportProgress);
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', e => {
    if (e.target.files[0]) importProgress(e.target.files[0]);
    e.target.value = '';
  });
  $('#reset-btn').addEventListener('click', resetAll);
}

/* ───────────────────────── Boot ───────────────────────── */
async function boot() {
  try {
    const res = await fetch('cards.json', { cache: 'no-cache' });
    const data = await res.json();
    CARDS = data.cards || [];
    CATS = data.categories || {};
  } catch (e) {
    toast('Could not load cards.json.');
    return;
  }
  bind();
  renderHome();
  show('home');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {/* offline still fine after first load */});
  });
}

boot();
