/* =========================================================
   Jardim Encantado - parte pública do site
   ========================================================= */
(function () {
  const JE = window.JE;
  const db = JE.db;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------- Utilidades compartilhadas ---------- */
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const parseDate = (s) => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
  const fmtDate = (s) => { const d = parseDate(s); return d ? d.toLocaleDateString('pt-BR') : ''; };
  const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const initials = (name) => (name || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

  const EVENT_TYPES = {
    'Formatura': ['#8e4bc4', '#f0e3fb'],
    'Natal': ['#c0322f', '#fde2e1'],
    'Dia das Mães': ['#e2417a', '#fde4ee'],
    'Dia dos Pais': ['#2e86d6', '#e1f0fd'],
    'Dia das Crianças': ['#e8890f', '#fff0d9'],
    'Páscoa': ['#b0790a', '#fff4cc'],
    'Festa Junina': ['#d2561b', '#ffe6d6'],
    'Aniversário': ['#d1418f', '#fbe1f0'],
    'Reunião de pais': ['#1f6b3a', '#e3f3df'],
    'Passeio': ['#2a9d8f', '#dcf3f0'],
    'Matrículas': ['#1f6b3a', '#e3f3df'],
    'Feriado': ['#5d5a4a', '#efebdf'],
    'Ensaio fotográfico': ['#d1418f', '#fbe1f0'],
    'Outro': ['#5d5a4a', '#efebdf']
  };
  const typeColor = (t) => EVENT_TYPES[t] || EVENT_TYPES['Outro'];

  const PACKAGES = [
    { name: 'Margarida', group: 'parcial', hours: 4, ex: 'Manhã, das 7h30 às 11h30', enroll: 800, fee: 480, c: '#e2417a', cs: '#fde4ee', note: 'Não inclui alimentação' },
    { name: 'Tulipa', group: 'parcial', hours: 4, ex: 'Tarde, das 14h às 18h', enroll: 800, fee: 440, c: '#8e4bc4', cs: '#f0e3fb', note: 'Não inclui alimentação' },
    { name: 'Alecrim', group: 'integral', hours: 5, ex: 'Por exemplo, das 8h às 13h', enroll: 1066.67, fee: 800, c: '#2f8f4e', cs: '#e3f3df' },
    { name: 'Bambu', group: 'integral', hours: 6, ex: 'Por exemplo, das 8h às 14h', enroll: 1306.8, fee: 980, c: '#b0790a', cs: '#fff4cc' },
    { name: 'Cactus', group: 'integral', hours: 7, ex: 'Por exemplo, das 8h às 15h', enroll: 1600, fee: 1200, c: '#d1418f', cs: '#fbe1f0' },
    { name: 'Dente-de-Leão', group: 'integral', hours: 8, ex: 'Por exemplo, das 8h às 16h', enroll: 1750, fee: 1312.5, c: '#2e86d6', cs: '#e1f0fd' },
    { name: 'Erva-Doce', group: 'integral', hours: 9, ex: 'Por exemplo, das 8h às 17h', enroll: 1900, fee: 1425, c: '#8e4bc4', cs: '#f0e3fb' },
    { name: 'Flor-de-Lis', group: 'integral', hours: 10, ex: 'Por exemplo, das 8h às 18h', enroll: 2000, fee: 1500, c: '#c0322f', cs: '#fde2e1' }
  ];

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg; t.classList.toggle('err', !!isErr); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  /* ---------- Modal ---------- */
  let modalOnClose = null;
  function openModal(title, html, opts) {
    opts = opts || {};
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    $('.modal-box').classList.toggle('wide', !!opts.wide);
    $('#modal').hidden = false;
    modalOnClose = opts.onClose || null;
    db.hydrate($('#modalBody'));
    const first = $('#modalBody input, #modalBody select, #modalBody textarea, #modalBody button');
    if (first && !opts.noFocus) setTimeout(() => first.focus(), 30);
    return $('#modalBody');
  }
  function closeModal() {
    $('#modal').hidden = true;
    $$('#modalBody video').forEach((v) => v.pause());
    const cb = modalOnClose; modalOnClose = null;
    if (cb) cb();
  }
  $$('#modal [data-close]').forEach((b) => b.addEventListener('click', closeModal));

  /** Confirmação dentro da página (o site não usa a janela confirm() do navegador). */
  function confirmBox(message, okLabel) {
    return new Promise((resolve) => {
      const prevClose = modalOnClose;
      const body = openModal('Confirmar', `<p>${esc(message)}</p>
        <div class="form-actions"><button class="btn btn-ghost" data-r="0" type="button">Cancelar</button>
        <button class="btn btn-pink" data-r="1" type="button">${esc(okLabel || 'Excluir')}</button></div>`, { noFocus: true });
      modalOnClose = () => resolve(false);
      $$('[data-r]', body).forEach((b) => b.addEventListener('click', () => {
        modalOnClose = null; closeModal(); resolve(b.dataset.r === '1');
      }));
      void prevClose;
    });
  }

  /* ---------- Lightbox (ver foto/vídeo grande) ---------- */
  let lbItems = [], lbIndex = 0;
  async function showLb() {
    const it = lbItems[lbIndex];
    const stage = $('#lbStage');
    stage.innerHTML = '';
    const u = await db.url(it.src);
    if (it.type === 'video') {
      const v = document.createElement('video');
      v.controls = true; v.playsInline = true; v.src = u;
      if (it.poster) v.poster = await db.url(it.poster);
      stage.appendChild(v);
    } else {
      const im = document.createElement('img'); im.src = u; im.alt = it.caption || 'Foto';
      stage.appendChild(im);
    }
    $('#lbCap').textContent = (it.caption ? it.caption + ' · ' : '') + (lbIndex + 1) + ' de ' + lbItems.length;
    $('#lbPrev').hidden = $('#lbNext').hidden = lbItems.length < 2;
  }
  function openLightbox(items, index) {
    lbItems = items; lbIndex = index || 0;
    $('#lightbox').hidden = false; showLb();
  }
  function closeLb() { $$('#lbStage video').forEach((v) => v.pause()); $('#lightbox').hidden = true; $('#lbStage').innerHTML = ''; }
  $('#lbClose').addEventListener('click', closeLb);
  $('#lbPrev').addEventListener('click', () => { lbIndex = (lbIndex - 1 + lbItems.length) % lbItems.length; showLb(); });
  $('#lbNext').addEventListener('click', () => { lbIndex = (lbIndex + 1) % lbItems.length; showLb(); });
  document.addEventListener('keydown', (e) => {
    if (!$('#lightbox').hidden) {
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowLeft') $('#lbPrev').click();
      if (e.key === 'ArrowRight') $('#lbNext').click();
    } else if (!$('#modal').hidden && e.key === 'Escape') closeModal();
  });

  /* ---------- Menu celular ---------- */
  $('#menuToggle').addEventListener('click', () => {
    const open = $('#mainNav').classList.toggle('open');
    $('#menuToggle').setAttribute('aria-expanded', String(open));
  });
  $$('#mainNav a').forEach((a) => a.addEventListener('click', () => $('#mainNav').classList.remove('open')));

  /* ---------- Copiar telefone ---------- */
  $$('.copy').forEach((b) => b.addEventListener('click', () => {
    const txt = b.dataset.copy;
    const done = () => toast('Número copiado: ' + txt);
    try {
      navigator.clipboard.writeText(txt).then(done, () => { selectText(b.previousElementSibling.previousElementSibling); toast('Selecione e copie o número'); });
    } catch (e) { toast('Selecione e copie o número'); }
  }));
  function selectText(el) { try { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* ok */ } }

  /* ---------- Carrossel ---------- */
  let carIdx = 0, carTimer = null, carCount = 0;
  async function renderCarousel() {
    const slides = await db.get('slides', []);
    carCount = slides.length;
    const track = $('#carouselTrack'), dots = $('#carDots');
    track.innerHTML = slides.map((s, i) => `
      <div class="slide${i === 0 ? ' on' : ''}" aria-hidden="${i === 0 ? 'false' : 'true'}">
        <div class="bg" data-bg="${esc(s.src)}"></div>
        <img data-src="${esc(s.src)}" alt="${esc(s.caption || 'Foto ' + (i + 1))}">
        ${s.caption ? `<p class="cap">${esc(s.caption)}</p>` : ''}
      </div>`).join('');
    dots.innerHTML = slides.map((_, i) => `<button role="tab" aria-label="Foto ${i + 1}" class="${i === 0 ? 'on' : ''}" data-i="${i}"></button>`).join('');
    $('#carEmpty').hidden = slides.length > 0;
    $('#carPrev').hidden = $('#carNext').hidden = slides.length < 2;
    await db.hydrate(track);
    await Promise.all($$('[data-bg]', track).map(async (el) => { el.style.backgroundImage = `url("${await db.url(el.dataset.bg)}")`; }));
    $$('button', dots).forEach((b) => b.addEventListener('click', () => { goSlide(+b.dataset.i); restartCar(); }));
    carIdx = 0; restartCar();
  }
  function goSlide(i) {
    if (!carCount) return;
    carIdx = (i + carCount) % carCount;
    $$('#carouselTrack .slide').forEach((s, k) => { s.classList.toggle('on', k === carIdx); s.setAttribute('aria-hidden', k === carIdx ? 'false' : 'true'); });
    $$('#carDots button').forEach((d, k) => d.classList.toggle('on', k === carIdx));
  }
  function restartCar() {
    clearInterval(carTimer);
    if (carCount > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) carTimer = setInterval(() => goSlide(carIdx + 1), 5000);
  }
  $('#carPrev').addEventListener('click', () => { goSlide(carIdx - 1); restartCar(); });
  $('#carNext').addEventListener('click', () => { goSlide(carIdx + 1); restartCar(); });
  let touchX = null;
  $('#carousel').addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  $('#carousel').addEventListener('touchend', (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) > 40) { goSlide(carIdx + (dx < 0 ? 1 : -1)); restartCar(); }
  });

  /* ---------- Pacotes ---------- */
  function renderPackages() {
    const card = (p) => `<article class="pk" style="--c:${p.c};--cs:${p.cs}">
      <h4>Pacote ${esc(p.name)}</h4>
      <span class="hrs">${p.hours} horas de permanência</span>
      <p class="ex">${esc(p.ex)}${p.note ? '. ' + esc(p.note) + '.' : ''}</p>
      <dl><dt>Matrícula</dt><dd>${money(p.enroll)}</dd>
      <dt>Mensalidade 2027</dt><dd class="big">${money(p.fee)}</dd></dl>
    </article>`;
    $('#pkPartial').innerHTML = PACKAGES.filter((p) => p.group === 'parcial').map(card).join('');
    $('#pkFull').innerHTML = PACKAGES.filter((p) => p.group === 'integral').map(card).join('');
  }

  /* ---------- Galeria ---------- */
  async function renderAlbums() {
    const albums = (await db.get('albums', [])).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const grid = $('#albumsGrid');
    if (!albums.length) { grid.innerHTML = '<p class="empty">Os álbuns de fotos e vídeos dos eventos aparecem aqui.</p>'; return; }
    grid.innerHTML = albums.map((a) => {
      const cover = a.cover || (a.items.find((i) => i.type === 'image') || {}).src || (a.items[0] && (a.items[0].poster || '')) || '';
      const nImg = a.items.filter((i) => i.type === 'image').length, nVid = a.items.length - nImg;
      const parts = [];
      if (nImg) parts.push(nImg + (nImg === 1 ? ' foto' : ' fotos'));
      if (nVid) parts.push(nVid + (nVid === 1 ? ' vídeo' : ' vídeos'));
      return `<button class="album" data-id="${a.id}" type="button">
        <div class="cover">${cover ? `<img data-src="${esc(cover)}" alt="">` : ''}</div>
        <h3>${esc(a.title)}</h3>
        <small>${a.date ? fmtDate(a.date) + ' · ' : ''}${parts.join(' e ') || 'Álbum vazio'}</small>
      </button>`;
    }).join('');
    db.hydrate(grid);
    $$('.album', grid).forEach((b) => b.addEventListener('click', () => openAlbum(b.dataset.id)));
  }
  async function openAlbum(id) {
    const a = (await db.get('albums', [])).find((x) => x.id === id);
    if (!a) return;
    const body = openModal(a.title, `
      ${a.description ? `<p class="hint">${esc(a.description)}</p>` : ''}
      ${a.items.length ? `<div class="album-grid">${a.items.map((it, i) => `
        <button class="thumb" data-i="${i}" type="button" aria-label="Abrir ${esc(it.caption || 'item ' + (i + 1))}">
          ${it.type === 'video' ? (it.poster ? `<img data-src="${esc(it.poster)}" alt="">` : `<video data-src="${esc(it.src)}" muted preload="metadata"></video>`) + '<span class="play-badge"></span>' : `<img data-src="${esc(it.src)}" alt="${esc(it.caption || '')}">`}
        </button>`).join('')}</div>` : '<p class="empty">Este álbum ainda não tem fotos.</p>'}`, { wide: true, noFocus: true });
    $$('.thumb', body).forEach((t) => t.addEventListener('click', () => openLightbox(a.items, +t.dataset.i)));
  }

  /* ---------- Agenda (calendário no estilo do panfleto) ---------- */
  const PASTEL = [['#fde68a', '#7a5b00'], ['#fbc8d4', '#9b1d47'], ['#c8eea0', '#2f6b12'], ['#bfdcf5', '#174f80'], ['#dcc8f5', '#5a2a8f'], ['#ffd2a8', '#8a4300']];
  const TYPE_ICON = {
    'Formatura': '🎓', 'Natal': '🎄', 'Dia das Mães': '💐', 'Dia dos Pais': '👔', 'Dia das Crianças': '🎈',
    'Páscoa': '🐰', 'Festa Junina': '🌽', 'Aniversário': '🎂', 'Reunião de pais': '👪', 'Passeio': '🚌',
    'Matrículas': '📝', 'Feriado': '🕊️', 'Ensaio fotográfico': '📷', 'Outro': '⭐'
  };
  const iconFor = (t) => TYPE_ICON[t] || '⭐';
  JE.PASTEL = PASTEL;
  let calMonth = new Date(); calMonth.setDate(1);
  let openEventId = null;

  async function renderAgenda() {
    const events = (await db.get('events', [])).slice().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    const albums = await db.get('albums', []);
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const prefix = y + '-' + String(m + 1).padStart(2, '0');
    const monthEvents = events.filter((e) => e.date && e.date.startsWith(prefix));
    const dayColor = {};
    monthEvents.forEach((e) => {
      const d = Number(e.date.slice(8, 10));
      if (d in dayColor) return;
      const chosen = e.color !== undefined && e.color !== '' && PASTEL[Number(e.color)];
      dayColor[d] = chosen || PASTEL[Object.keys(dayColor).length % PASTEL.length];
    });

    $('#calTitle').textContent = MONTHS[m].replace(/^./, (c) => c.toUpperCase()) + '/' + y;
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const today = todayISO();
    const DOW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    let cells = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => `<span class="ch" title="${DOW[i]}">${d}</span>`).join('');
    for (let i = 0; i < first; i++) cells += '<span class="cd blank"></span>';
    for (let d = 1; d <= days; d++) {
      const iso = prefix + '-' + String(d).padStart(2, '0');
      const c = dayColor[d];
      const cls = 'cd' + (c ? ' ev' : '') + (iso === today ? ' today' : '');
      cells += c
        ? `<button type="button" class="${cls}" data-d="${d}" style="--pc:${c[0]};--pt:${c[1]}" aria-label="${d} de ${MONTHS[m]}, ver evento"><b>${d}</b></button>`
        : `<span class="${cls}"><b>${d}</b></span>`;
    }
    const tail = (7 - ((first + days) % 7)) % 7;
    for (let i = 0; i < tail; i++) cells += '<span class="cd blank"></span>';
    $('#calendar').innerHTML = cells;

    $('#eventList').innerHTML = monthEvents.length ? monthEvents.map((e) => {
      const d = Number(e.date.slice(8, 10)); const c = dayColor[d];
      const album = e.albumId && albums.find((a) => a.id === e.albumId);
      const open = openEventId === e.id;
      return `<li class="lg${open ? ' open' : ''}" data-day="${d}">
        <button type="button" class="lg-row" data-id="${e.id}" aria-expanded="${open}">
          <span class="lg-day" style="--pc:${c[0]};--pt:${c[1]}">${String(d).padStart(2, '0')}</span>
          <span class="lg-title">${esc(e.title)}</span>
          <span class="lg-ic" aria-hidden="true">${iconFor(e.type)}</span>
        </button>
        <div class="lg-more" ${open ? '' : 'hidden'}>
          <p><strong>${esc(e.type || 'Evento')}</strong> · ${fmtDate(e.date)}${e.time ? ' às ' + esc(e.time) : ''}</p>
          ${e.description ? `<p>${esc(e.description)}</p>` : ''}
          ${album ? `<p><button class="link" data-album="${album.id}" type="button">Ver fotos do evento</button></p>` : ''}
        </div></li>`;
    }).join('') : '<li class="lg-empty">Nenhum evento neste mês. Use as setas para ver outros meses.</li>';

    $$('#eventList .lg-row').forEach((b) => b.addEventListener('click', () => { openEventId = openEventId === b.dataset.id ? null : b.dataset.id; renderAgenda(); }));
    $$('#eventList [data-album]').forEach((b) => b.addEventListener('click', () => openAlbum(b.dataset.album)));
    $$('#calendar .cd.ev').forEach((b) => b.addEventListener('click', () => {
      const ev = monthEvents.find((e) => Number(e.date.slice(8, 10)) === Number(b.dataset.d));
      if (!ev) return;
      openEventId = ev.id;
      renderAgenda().then(() => { const li = $(`#eventList .lg[data-day="${b.dataset.d}"]`); if (li) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
    }));
  }
  $('#calPrev').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() - 1); openEventId = null; renderAgenda(); });
  $('#calNext').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() + 1); openEventId = null; renderAgenda(); });

  /* ---------- Equipe ---------- */
  async function renderStaff() {
    const staff = await db.get('staff', []);
    const grid = $('#staffGrid');
    grid.innerHTML = staff.length ? staff.map((p) => `<article class="person">
      <div class="ph">${p.photo ? `<img data-src="${esc(p.photo)}" alt="Foto de ${esc(p.name)}">` : esc(initials(p.name))}</div>
      <h3>${esc(p.name)}</h3><span class="role">${esc(p.role)}</span>
      ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}</article>`).join('')
      : '<p class="empty">Em breve você vai conhecer aqui as professoras, auxiliares e toda a equipe da Jardim Encantado.</p>';
    db.hydrate(grid);
  }

  async function renderAll() {
    await Promise.all([renderCarousel(), renderAlbums(), renderAgenda(), renderStaff()]);
  }

  Object.assign(JE, {
    $, $$, esc, money, fmtDate, parseDate, todayISO, initials, MONTHS, EVENT_TYPES, PACKAGES,
    toast, openModal, closeModal, confirmBox, openLightbox, renderAll,
    renderCarousel, renderAlbums, renderAgenda, renderStaff
  });

  renderPackages();
  db.init().then(renderAll).catch((e) => { console.error(e); toast('Não foi possível carregar os dados salvos.', true); });
})();
