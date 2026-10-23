// CoM²-Bench project page: hero video control, nav highlight, BibTeX copy, Trace Explorer.
(function () {
  'use strict';

  // ---------------------------------------------------------------- hero
  const hero = document.querySelector('.hero-video');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  function setPlaying(on) {
    if (!hero) return;
    if (on) hero.play().catch(() => {}); else hero.pause();
  }
  if (hero) {
    if (reduce.matches) { hero.removeAttribute('autoplay'); setPlaying(false); }
    reduce.addEventListener('change', e => setPlaying(!e.matches));
  }

  // one downward wheel in the hero jumps to the video section (touch uses CSS snap)
  const heroEl = document.querySelector('.hero');
  const videoSec = document.getElementById('video');
  let snapping = false;
  if (heroEl && videoSec) {
    addEventListener('wheel', e => {
      if (reduce.matches || e.ctrlKey || e.deltaY <= 0) return;
      if (snapping) { e.preventDefault(); return; }
      if (scrollY > heroEl.offsetHeight - 80) return;
      e.preventDefault();
      snapping = true;
      videoSec.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => { snapping = false; }, 900);
    }, { passive: false });
  }

  // ---------------------------------------------------------------- nav
  const links = [...document.querySelectorAll('.nav a')];
  const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => { a.classList.remove('on'); a.removeAttribute('aria-current'); });
      const a = byId.get(e.target.id);
      if (a) { a.classList.add('on'); a.setAttribute('aria-current', 'true'); }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section').forEach(s => spy.observe(s));

  // ---------------------------------------------------------------- bibtex
  const copy = document.getElementById('copy-bib');
  const bib = document.getElementById('bib-text');
  if (copy && bib) {
    copy.addEventListener('click', () => {
      const done = msg => { copy.textContent = msg; setTimeout(() => { copy.textContent = 'Copy'; }, 1800); };
      const selectText = () => {
        const range = document.createRange();
        range.selectNodeContents(bib);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        done('Press Ctrl+C');
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(bib.textContent).then(() => done('Copied'), selectText);
      } else {
        selectText();
      }
    });
  }

  // ---------------------------------------------------------------- trace explorer
  const root = document.getElementById('ex');
  const pick = document.getElementById('ex-pair');
  const filter = document.getElementById('ex-filter');
  if (!root || !pick || !filter) return;

  const TAG = { recovered: 'Gold chunk recovered', expanded: 'Window expanded', picked_partner: 'Picked the partner' };
  const ATTR = {
    subject: 'subject', core_action: 'core action', motion_state: 'motion', interaction_cause: 'interaction',
    context_setting: 'setting', visual_anchor: 'visual anchor', temporal_composition: 'temporal composition',
  };
  const MARK = { true: '✓', false: '✗', cutoff: '…' };
  const HOLDS = { true: 'holds', false: 'does not hold', cutoff: 'cut off at the window edge' };
  let pairs = [];
  let shown = [];
  let current = null;
  let role = 'target';
  let evidence = null;
  const buttons = {};

  // Build DOM with textContent only: notes come from model output.
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  const hms = s => {
    s = Math.max(0, Math.round(s));
    return `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  const span = w => `${hms(w[0])}–${hms(w[1])}`;
  const decisionLabel = d => (d === 'EMIT' ? 'accept' : d.toLowerCase());
  // Distance between paired moments, measured end of the earlier to start of the later (the paper's convention).
  const gapMin = (a, b) => Math.round(Math.max(0, (a[0] < b[0] ? b[0] - a[1] : a[0] - b[1])) / 60);

  function thumbs(list, caption) {
    const wrap = el('div');
    wrap.appendChild(el('div', 'thumbs-cap', caption));
    const box = el('div', 'thumbs');
    list.forEach(f => {
      const fig = el('figure');
      const img = el('img');
      img.src = f.src;
      img.alt = `Frame at ${hms(f.t)}`;
      img.loading = 'lazy';
      fig.append(img, el('figcaption', '', hms(f.t)));
      box.appendChild(fig);
    });
    wrap.appendChild(box);
    return wrap;
  }

  function timeline(p, q) {
    const dur = q.duration;
    const pct = t => `${(100 * Math.min(Math.max(t, 0), dur) / dur).toFixed(3)}%`;
    const t = p.queries.target, c = p.queries.confusable;
    const wrap = el('div', 'timeline');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label',
      `Movie timeline, 0:00:00 to ${hms(dur)}. Target ground truth ${span(t.gt)}, confusable ground truth ${span(c.gt)}, ` +
      `retriever top-5 chunks ${q.retriever_top5.map(x => '#' + x.chunk).join(', ')}, AWS output ${span(q.final.window)}.`);
    wrap.appendChild(el('div', 'track'));
    const seg = (w, cls, label) => {
      const s = el('div', 'seg ' + cls);
      s.style.left = pct(w[0]);
      s.style.width = `max(4px, ${pct(w[1] - w[0])})`;
      s.title = `${label}: ${span(w)}`;
      wrap.appendChild(s);
    };
    q.retriever_top5.forEach((x, i) => seg(x.window, 'cand', `retriever rank ${i + 1}, chunk #${x.chunk}`));
    seg(t.gt, 'gt-t', 'target ground truth');
    seg(c.gt, 'gt-c', 'confusable ground truth');
    seg(q.final.window, 'final' + (q.final.correct_chunk ? '' : ' miss'), 'AWS output window');
    const lbl = el('div', 'lbl', `${gapMin(t.gt, c.gt)} min gap`);
    lbl.style.left = pct((t.gt[0] + c.gt[0]) / 2);
    wrap.appendChild(lbl);
    const a = el('div', 'ends', '0:00:00');
    a.style.left = '0';
    const b = el('div', 'ends', hms(dur));
    b.style.right = '0';
    wrap.append(a, b);
    return wrap;
  }

  function legend() {
    const box = el('div', 'tl-legend');
    [['var(--target)', 'target GT'], ['var(--conf)', 'confusable GT'],
     ['transparent; border:2px solid var(--ok)', 'AWS output'], ['rgba(160,169,187,.08); border:1px dashed #6B7488', 'retriever top-5']]
      .forEach(([bg, text]) => {
        const s = el('span');
        const i = el('i');
        i.setAttribute('style', `background:${bg}`);
        s.append(i, document.createTextNode(text));
        box.appendChild(s);
      });
    return box;
  }

  function stepCard(step, subq) {
    const card = el('div', 'step-card');
    const top = el('div', 'step-top');
    const meta = el('div', 'meta');
    meta.append(document.createTextNode(`Candidate rank ${step.rank + 1} · chunk `), el('b', '', `#${step.chunk}`),
      document.createTextNode(` · ${span(step.window)}`));
    const res = step.result === 'SELECT' ? 'select' : decisionLabel(step.result);
    top.append(meta, el('span', 'badge ' + res, res));
    card.appendChild(top);
    if (step.result === 'SELECT') {
      card.appendChild(el('p', 'reason', 'All candidates were rejected, so a final Select call compared their summaries and returned this window.'));
    }
    step.looks.forEach(lk => {
      const look = el('div', 'look');
      const lt = el('div', 'look-top');
      lt.appendChild(el('span', 'badge ' + decisionLabel(lk.decision), decisionLabel(lk.decision)));
      let info = `window ${span(lk.window)}`;
      if (lk.decision === 'EXPAND' && lk.expand[0]) info += ` · extend ${lk.expand[1]} s to the ${lk.expand[0]}`;
      lt.appendChild(el('span', 'meta', info));
      look.append(lt, thumbs(lk.thumbs, 'Representative frames from this window'));
      const ul = el('ul', 'verdicts');
      lk.statements.forEach(s => {
        const li = el('li');
        const mark = el('span', 'mark ' + s.holds, MARK[s.holds] || '?');
        mark.setAttribute('aria-label', HOLDS[s.holds] || s.holds);
        li.appendChild(mark);
        const body = el('span');
        body.appendChild(el('span', 'stmt', subq.get(s.id) || s.id));
        if (s.note) body.appendChild(el('span', 'note', s.note));
        li.appendChild(body);
        ul.appendChild(li);
      });
      look.appendChild(ul);
      if (lk.reason) look.appendChild(el('p', 'reason', lk.reason));
      card.appendChild(look);
    });
    return card;
  }

  function outcomeBadges(q) {
    const box = el('div', 'outcome-badges');
    box.appendChild(el('span', 'badge ' + (q.final.correct_chunk ? 'gold' : 'miss'), q.final.correct_chunk ? 'gold chunk' : 'missed'));
    if (q.recovered) box.appendChild(el('span', 'badge neutral', 'top-1 was wrong'));
    if (q.expanded) box.appendChild(el('span', 'badge expanded', 'expanded'));
    if (q.picked_partner) box.appendChild(el('span', 'badge miss', 'picked partner'));
    return box;
  }

  function renderEvidence(animate) {
    const p = current;
    const q = p.queries[role];
    const subq = new Map(q.subqueries.map(s => [s.id, s.text]));
    const box = el('div', animate ? 'evidence-enter' : '');
    box.append(timeline(p, q), legend());
    box.appendChild(el('div', 'meta', 'Decompose → sub-queries'));
    const sq = el('ol', 'subq');
    q.subqueries.forEach(s => { const li = el('li'); li.append(el('b', '', s.id), document.createTextNode(s.text)); sq.appendChild(li); });
    box.appendChild(sq);
    box.appendChild(el('div', 'meta', 'Inspect candidates in retrieval order'));
    q.steps.forEach(s => box.appendChild(stepCard(s, subq)));
    const out = el('div', 'outcome');
    out.appendChild(document.createTextNode(`Retriever top-1 was ${q.top1_correct ? 'correct' : 'wrong'}. AWS selected ${span(q.final.window)}: `));
    out.appendChild(el('span', q.final.correct_chunk ? 'ok' : 'bad', q.final.correct_chunk ? 'the gold chunk' : 'not the gold chunk'));
    out.appendChild(document.createTextNode(`, covering ${Math.round(100 * q.final.gt_coverage)}% of the ground truth. The unchanged localizer then predicts the final interval inside this window (not shown).`));
    box.appendChild(out);
    if (evidence) evidence.replaceWith(box); else root.appendChild(box);
    evidence = box;
  }

  function selectRole(r) {
    role = r;
    Object.entries(buttons).forEach(([k, b]) => {
      b.classList.toggle('on', k === r);
      b.setAttribute('aria-pressed', String(k === r));
    });
    renderEvidence(true);
  }

  function renderPair() {
    root.replaceChildren();
    evidence = null;
    if (!current) { root.appendChild(el('p', 'meta', 'No pairs match this filter.')); return; }
    const p = current;
    const head = el('div', 'ex-head');
    head.appendChild(el('h3', '', p.title));
    const tags = el('div', 'ex-tags');
    tags.appendChild(el('span', 'meta', `differs in ${ATTR[p.contrast] || p.contrast}`));
    p.tags.forEach(t => tags.appendChild(el('span', 'badge neutral', TAG[t])));
    head.appendChild(tags);
    root.appendChild(head);

    const qs = el('div', 'queries');
    ['target', 'confusable'].forEach(r => {
      const d = p.queries[r];
      const btn = el('button', `q ${r}`);
      btn.type = 'button';
      btn.appendChild(el('span', 'role', `${r} query · GT ${span(d.gt)}`));
      btn.appendChild(document.createTextNode(d.sentence));
      btn.appendChild(outcomeBadges(d));
      const gt = el('div', 'gtthumbs');
      d.gt_thumbs.forEach(f => { const i = el('img'); i.src = f.src; i.alt = `${r} moment at ${hms(f.t)}`; i.loading = 'lazy'; gt.appendChild(i); });
      btn.appendChild(gt);
      btn.addEventListener('click', () => selectRole(r));
      buttons[r] = btn;
      qs.appendChild(btn);
    });
    root.appendChild(qs);
    selectRole('target');
  }

  function fill(tag) {
    shown = tag === 'all' ? pairs : pairs.filter(p => p.tags.includes(tag));
    pick.replaceChildren();
    shown.forEach((p, i) => pick.appendChild(new Option(`${p.title} · ${ATTR[p.contrast] || p.contrast}`, i)));
    current = shown[0] || null;
    renderPair();
  }

  filter.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    filter.querySelectorAll('button').forEach(x => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
    fill(b.dataset.tag);
  });
  pick.addEventListener('change', () => { current = shown[+pick.value]; renderPair(); });

  const valid = d => Array.isArray(d) && d.every(p => p.queries && p.queries.target && p.queries.confusable && Array.isArray(p.tags));
  fetch('assets/data/traces.json')
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(d => { if (!valid(d)) throw new Error('unexpected trace format'); pairs = d; fill('all'); })
    .catch(err => {
      console.error('Trace Explorer:', err);
      root.replaceChildren(el('p', 'meta', `Could not load traces (${err.message}).`));
    });
})();
