/* =========================================================
   Jardim Encantado - área do administrador
   ========================================================= */
(function () {
  const JE = window.JE;
  const db = JE.db;
  const { $, $$, esc, money, fmtDate, parseDate, todayISO, initials, MONTHS, EVENT_TYPES, PACKAGES, toast, openModal, closeModal, confirmBox } = JE;
  const MAX_SLIDES = 30;
  let currentTab = 'carrossel';
  let openAlbumId = null;

  /* ---------- Sessão (Firebase Authentication) ---------- */
  const isLogged = () => db.isAdmin();
  function updateAdminBtn() { $('#btnAdminLabel').textContent = isLogged() ? 'Painel' : 'Administrador'; }
  db.onAuth(() => { updateAdminBtn(); if (!isLogged()) { $('#admin').hidden = true; document.body.style.overflow = ''; } });

  window.addEventListener('unhandledrejection', (e) => {
    console.error(e.reason);
    const code = (e.reason && e.reason.code) || '';
    if (code === 'cloudinary/not-configured') { toast('O envio de fotos ainda não foi configurado (Cloudinary).', true); return; }
    if (code === 'cloudinary/upload-failed') { toast('O Cloudinary recusou o arquivo: ' + e.reason.message, true); return; }
    toast(code.includes('permission') ? 'Sem permissão para salvar. Entre de novo como administrador.' : 'Não foi possível salvar. Confira a internet e tente de novo.', true);
  });

  $('#btnAdmin').addEventListener('click', () => (isLogged() ? openAdmin() : showLogin()));
  $('#adminClose').addEventListener('click', () => { $('#admin').hidden = true; document.body.style.overflow = ''; });
  $('#adminLogout').addEventListener('click', async () => { await db.logout(); $('#admin').hidden = true; document.body.style.overflow = ''; JE.renderAll(); toast('Você saiu da área do administrador.'); });

  const AUTH_MSG = {
    'auth/invalid-credential': 'E-mail ou senha incorretos. Confira e tente de novo.',
    'auth/wrong-password': 'E-mail ou senha incorretos. Confira e tente de novo.',
    'auth/user-not-found': 'E-mail ou senha incorretos. Confira e tente de novo.',
    'auth/invalid-email': 'Esse e-mail não parece válido.',
    'auth/too-many-requests': 'Muitas tentativas. Espere alguns minutos e tente de novo.',
    'auth/network-request-failed': 'Sem internet. Confira a conexão e tente de novo.',
    'auth/unauthorized-domain': 'Este endereço do site ainda não foi autorizado no Firebase (Authentication > Configurações > Domínios autorizados).'
  };

  function showLogin() {
    if (!db.isOnline()) { toast('Não foi possível conectar ao Firebase. Confira a internet e recarregue a página.', true); return; }
    const body = openModal('Entrar como administrador', `
      <form class="form" id="loginForm">
        <div class="field"><label for="lgUser">E-mail</label><input id="lgUser" type="email" autocomplete="username" required></div>
        <div class="field"><label for="lgPass">Senha</label><input id="lgPass" type="password" autocomplete="current-password" required></div>
        <p class="hint" id="lgErr" hidden style="color:#b02a27"></p>
        <div class="form-actions"><button class="btn btn-ghost sm" type="button" id="lgForgot">Esqueci a senha</button><button class="btn btn-green" type="submit">Entrar</button></div>
      </form>`);
    const showErr = (m) => { $('#lgErr').textContent = m; $('#lgErr').hidden = false; };
    $('#lgForgot', body).addEventListener('click', async () => {
      const email = $('#lgUser').value.trim();
      if (!email) { showErr('Digite seu e-mail acima e clique de novo em “Esqueci a senha”.'); return; }
      try { await db.sendReset(email); showErr('Se esse e-mail for do administrador, chegará uma mensagem para criar uma nova senha.'); }
      catch (err) { showErr(AUTH_MSG[err.code] || 'Não foi possível enviar o e-mail agora.'); }
    });
    $('#loginForm', body).addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#loginForm button[type=submit]'); btn.disabled = true; btn.textContent = 'Entrando...';
      try {
        await db.login($('#lgUser').value.trim(), $('#lgPass').value);
        closeModal(); openAdmin(); JE.renderAll(); toast('Bem-vindo ao painel!');
      } catch (err) {
        console.error(err); showErr(AUTH_MSG[err.code] || 'Não foi possível entrar agora. Tente de novo.');
        btn.disabled = false; btn.textContent = 'Entrar';
      }
    });
  }

  function openAdmin() {
    $('#admin').hidden = false;
    document.body.style.overflow = 'hidden';
    renderTab();
  }

  $$('#adminTabs button').forEach((b) => b.addEventListener('click', () => {
    currentTab = b.dataset.tab; openAlbumId = null;
    $$('#adminTabs button').forEach((x) => x.classList.toggle('on', x === b));
    renderTab();
  }));

  async function renderTab() {
    const p = $('#adminPanel');
    const fn = { carrossel: tabSlides, albuns: tabAlbums, eventos: tabEvents, equipe: tabStaff, turmas: tabClasses, alunos: tabStudents, config: tabConfig }[currentTab];
    await fn(p);
    db.hydrate(p);
  }
  async function refresh() { await renderTab(); JE.renderAll(); }

  /* ---------- Ajudantes ---------- */
  function pickFiles(accept, multiple) {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = accept; inp.multiple = !!multiple;
      // fica fora da tela (e não com display:none), porque alguns celulares ignoram o clique em campo escondido
      inp.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
      inp.addEventListener('change', () => { resolve(Array.from(inp.files || [])); setTimeout(() => inp.remove(), 0); });
      document.body.appendChild(inp);
      try { inp.click(); } catch (e) { toast('Este navegador não abriu a escolha de arquivos.', true); resolve([]); }
    });
  }
  const mini = (src, name, isVideo) => `<div class="mini">${src ? (isVideo ? `<video data-src="${esc(src)}" muted preload="metadata"></video>` : `<img data-src="${esc(src)}" alt="">`) : esc(initials(name))}</div>`;
  const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  function photoField(id, current, label) {
    return `<div class="field"><label>${esc(label || 'Foto')}</label><div class="photo-pick">
      <div class="pv" id="${id}Pv">${current ? `<img data-src="${esc(current)}" alt="">` : 'Sem foto'}</div>
      <button class="btn btn-ghost sm" type="button" id="${id}Btn">Escolher foto</button>
      ${current ? `<button class="btn btn-danger sm" type="button" id="${id}Rm">Remover foto</button>` : ''}
      <input type="hidden" id="${id}" value="${esc(current || '')}"></div></div>`;
  }
  function wirePhotoField(id) {
    const newOnes = [];
    $('#' + id + 'Btn').addEventListener('click', async () => {
      const [f] = await pickFiles('image/*');
      if (!f) return;
      let src;
      try { ({ src } = await db.saveUpload(f, 900)); }
      catch (e) { console.error(e); toast(e.code === 'cloudinary/not-configured' ? 'O envio de fotos ainda não foi configurado (Cloudinary).' : 'Não foi possível enviar a foto. Confira a internet e tente de novo.', true); return; }
      newOnes.push(src);
      $('#' + id).value = src;
      $('#' + id + 'Pv').innerHTML = `<img src="${await db.url(src)}" alt="">`;
    });
    const rm = $('#' + id + 'Rm');
    if (rm) rm.addEventListener('click', () => { $('#' + id).value = ''; $('#' + id + 'Pv').textContent = 'Sem foto'; });
    return newOnes; // fotos novas (para apagar se o formulário for cancelado)
  }
  function formModal(title, html, onSave, opts) {
    let saved = false;
    let cleanup = [];
    const body = openModal(title, `<form class="form" id="fm">${html}
      <div class="form-actions"><button class="btn btn-ghost" type="button" data-cancel>Cancelar</button>
      <button class="btn btn-green" type="submit">Salvar</button></div></form>`, Object.assign({}, opts, {
      onClose: () => { if (!saved) cleanup.forEach((src) => db.delMedia(src)); }
    }));
    $('[data-cancel]', body).addEventListener('click', closeModal);
    $('#fm', body).addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const ok = await onSave();
        if (ok === false) return;
        saved = true; closeModal(); await refresh(); toast('Salvo!');
      } catch (err) { console.error(err); toast('Não foi possível salvar. Confira a internet e tente de novo.', true); }
    });
    return { body, track: (arr) => { cleanup = arr; } };
  }

  /* =======================================================
     CARROSSEL
     ======================================================= */
  async function tabSlides(p) {
    const slides = await db.get('slides', []);
    const full = slides.length >= MAX_SLIDES;
    p.innerHTML = `
      <div class="panel-head"><h3>Fotos do carrossel</h3><span class="counter">${slides.length} de ${MAX_SLIDES}</span>
        <button class="btn btn-pink" id="slAdd" type="button" ${full ? 'disabled' : ''}>Adicionar fotos</button></div>
      <p class="hint">Estas fotos passam no topo do site. Use as setas para mudar a ordem, “Trocar” para substituir uma foto e escreva uma legenda se quiser.${full ? ' <strong>O limite de 30 fotos foi atingido.</strong>' : ''}</p>
      <div class="slides-admin">${slides.map((s, i) => `
        <div class="slide-card" data-id="${s.id}">
          <div class="im"><img data-src="${esc(s.src)}" alt=""><span class="n">${i + 1}</span></div>
          <input class="capin" value="${esc(s.caption || '')}" placeholder="Legenda (opcional)" aria-label="Legenda da foto ${i + 1}" data-cap>
          <div class="bar">
            <button type="button" data-mv="-1" aria-label="Mover para a esquerda" ${i === 0 ? 'disabled' : ''}>←</button>
            <button type="button" data-mv="1" aria-label="Mover para a direita" ${i === slides.length - 1 ? 'disabled' : ''}>→</button>
            <button type="button" data-swap>Trocar</button>
            <button type="button" class="del" data-del>Excluir</button>
          </div></div>`).join('') || '<p class="empty">Nenhuma foto no carrossel ainda.</p>'}</div>`;

    $('#slAdd', p).addEventListener('click', async () => {
      const files = await pickFiles('image/*', true);
      if (!files.length) return;
      const list = await db.get('slides', []);
      const room = MAX_SLIDES - list.length;
      const use = files.slice(0, room);
      for (const f of use) { const { src } = await db.saveUpload(f, 1800); list.push({ id: db.uid('s'), src, caption: '' }); }
      await db.set('slides', list);
      await refresh();
      toast(files.length > room ? `Adicionei ${use.length} foto(s). O carrossel aceita no máximo 30.` : `${use.length} foto(s) adicionada(s).`, files.length > room);
    });
    $$('.slide-card', p).forEach((card) => {
      const id = card.dataset.id;
      const mutate = async (fn) => { const list = await db.get('slides', []); const i = list.findIndex((x) => x.id === id); if (i < 0) return; await fn(list, i); await db.set('slides', list); };
      $('[data-cap]', card).addEventListener('change', async (e) => { await mutate((l, i) => { l[i].caption = e.target.value.trim(); }); JE.renderCarousel(); toast('Legenda salva.'); });
      $$('[data-mv]', card).forEach((b) => b.addEventListener('click', async () => {
        await mutate((l, i) => { const j = i + Number(b.dataset.mv); if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; });
        refresh();
      }));
      $('[data-swap]', card).addEventListener('click', async () => {
        const [f] = await pickFiles('image/*'); if (!f) return;
        const { src } = await db.saveUpload(f, 1800);
        await mutate(async (l, i) => { await db.delMedia(l[i].src); l[i].src = src; });
        refresh(); toast('Foto trocada.');
      });
      $('[data-del]', card).addEventListener('click', async () => {
        if (!(await confirmBox('Excluir esta foto do carrossel?'))) return;
        await mutate(async (l, i) => { await db.delMedia(l[i].src); l.splice(i, 1); });
        refresh(); toast('Foto excluída.');
      });
    });
  }

  /* =======================================================
     ÁLBUNS
     ======================================================= */
  async function tabAlbums(p) {
    if (openAlbumId) return albumDetail(p, openAlbumId);
    const albums = (await db.get('albums', [])).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const events = await db.get('events', []);
    p.innerHTML = `
      <div class="panel-head"><h3>Álbuns de fotos e vídeos</h3><button class="btn btn-pink" id="alNew" type="button">Novo álbum</button></div>
      <div class="list">${albums.map((a) => {
        const cover = a.cover || (a.items.find((i) => i.type === 'image') || {}).src || (a.items[0] && a.items[0].poster) || '';
        const ev = events.find((e) => e.id === a.eventId);
        return `<div class="item" data-id="${a.id}">${mini(cover, a.title)}
          <div><h4>${esc(a.title)}</h4><p>${a.date ? fmtDate(a.date) + ' · ' : ''}${a.items.length} item(ns)${ev ? ' · Evento: ' + esc(ev.title) : ''}</p></div>
          <div class="acts"><button class="btn btn-green sm" data-open type="button">Fotos e vídeos</button>
          <button class="btn btn-ghost sm" data-edit type="button">Editar</button>
          <button class="btn btn-danger sm" data-del type="button">Excluir</button></div></div>`;
      }).join('') || '<p class="empty">Nenhum álbum ainda. Clique em “Novo álbum”.</p>'}</div>`;
    $('#alNew', p).addEventListener('click', () => albumForm());
    $$('.item', p).forEach((it) => {
      const id = it.dataset.id;
      $('[data-open]', it).addEventListener('click', () => { openAlbumId = id; renderTab(); });
      $('[data-edit]', it).addEventListener('click', () => albumForm(id));
      $('[data-del]', it).addEventListener('click', async () => {
        const list = await db.get('albums', []); const a = list.find((x) => x.id === id);
        if (!(await confirmBox(`Excluir o álbum “${a.title}” e todas as suas ${a.items.length} fotos e vídeos?`))) return;
        for (const i of a.items) await db.delMedia(i.src);
        await db.set('albums', list.filter((x) => x.id !== id));
        const evs = await db.get('events', []); evs.forEach((e) => { if (e.albumId === id) e.albumId = ''; }); await db.set('events', evs);
        refresh(); toast('Álbum excluído.');
      });
    });
  }

  async function albumForm(id, presetEventId) {
    const albums = await db.get('albums', []);
    const events = (await db.get('events', [])).slice().sort((a, b) => a.date.localeCompare(b.date));
    const a = albums.find((x) => x.id === id) || { title: '', date: todayISO(), eventId: presetEventId || '', description: '', items: [] };
    if (!id && presetEventId) { const ev = events.find((e) => e.id === presetEventId); if (ev) { a.title = ev.title; a.date = ev.date; } }
    formModal(id ? 'Editar álbum' : 'Novo álbum', `
      <div class="field"><label for="alTitle">Nome do álbum</label><input id="alTitle" required value="${esc(a.title)}" placeholder="Ex.: Formatura 2026"></div>
      <div class="row"><div class="field"><label for="alDate">Data</label><input id="alDate" type="date" value="${esc(a.date)}"></div>
      <div class="field"><label for="alEvent">Evento da agenda (opcional)</label><select id="alEvent"><option value="">Nenhum</option>
        ${events.map((e) => `<option value="${e.id}" ${e.id === a.eventId ? 'selected' : ''}>${esc(e.title)} (${fmtDate(e.date)})</option>`).join('')}</select></div></div>
      <div class="field"><label for="alDesc">Descrição</label><textarea id="alDesc">${esc(a.description)}</textarea></div>`,
    async () => {
      const list = await db.get('albums', []);
      const data = { title: val('alTitle'), date: val('alDate'), eventId: val('alEvent'), description: val('alDesc') };
      let albumId = id;
      if (id) Object.assign(list.find((x) => x.id === id), data);
      else { albumId = db.uid('a'); list.push(Object.assign({ id: albumId, items: [] }, data)); }
      await db.set('albums', list);
      if (data.eventId) { const evs = await db.get('events', []); const ev = evs.find((e) => e.id === data.eventId); if (ev) { ev.albumId = albumId; await db.set('events', evs); } }
      if (!id) { openAlbumId = albumId; currentTab = 'albuns'; $$('#adminTabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === 'albuns')); }
    });
  }

  async function albumDetail(p, id) {
    const a = (await db.get('albums', [])).find((x) => x.id === id);
    if (!a) { openAlbumId = null; return tabAlbums(p); }
    p.innerHTML = `
      <div class="panel-head"><button class="btn btn-ghost sm" id="alBack" type="button">← Voltar aos álbuns</button></div>
      <div class="panel-head"><h3>${esc(a.title)}</h3><span class="counter">${a.items.length} item(ns)</span>
        <button class="btn btn-pink" id="alUp" type="button">Adicionar fotos e vídeos</button></div>
      <p class="hint">Escolha várias fotos e vídeos de uma vez. As fotos são reduzidas automaticamente para ocupar menos espaço.</p>
      <div class="slides-admin">${a.items.map((it, i) => `
        <div class="slide-card" data-id="${it.id}">
          <div class="im">${it.type === 'video' ? (it.poster ? `<img data-src="${esc(it.poster)}" alt="">` : `<video data-src="${esc(it.src)}" muted preload="metadata"></video>`) + '<span class="play-badge"></span>' : `<img data-src="${esc(it.src)}" alt="">`}<span class="n">${i + 1}</span></div>
          <input class="capin" value="${esc(it.caption || '')}" placeholder="Legenda (opcional)" aria-label="Legenda do item ${i + 1}" data-cap>
          <div class="bar">
            <button type="button" data-view>Ver</button>
            ${it.type === 'image' ? `<button type="button" data-cover ${a.cover === it.src ? 'disabled' : ''}>${a.cover === it.src ? 'Capa' : 'Usar como capa'}</button>` : ''}
            <button type="button" class="del" data-del>Excluir</button>
          </div></div>`).join('') || '<p class="empty">Álbum vazio. Clique em “Adicionar fotos e vídeos”.</p>'}</div>`;
    $('#alBack', p).addEventListener('click', () => { openAlbumId = null; renderTab(); });
    const mutate = async (fn) => { const list = await db.get('albums', []); const al = list.find((x) => x.id === id); await fn(al); await db.set('albums', list); };
    $('#alUp', p).addEventListener('click', async () => {
      const files = await pickFiles('image/*,video/*', true);
      if (!files.length) return;
      const big = files.filter((f) => f.type.startsWith('video/') && f.size > 100 * 1024 * 1024);
      const use = files.filter((f) => !big.includes(f));
      toast('Salvando ' + use.length + ' arquivo(s)...');
      try {
        const added = [];
        let n = 0;
        for (const f of use) {
          n++;
          const r = await db.saveUpload(f, 1800, (pct) => toast(`Enviando ${n} de ${use.length}... ${Math.round(pct * 100)}%`));
          added.push({ id: db.uid('i'), type: r.type, src: r.src, caption: '' });
        }
        await mutate((al) => { al.items.push(...added); });
        await refresh();
        toast(big.length ? `Salvei ${added.length}. ${big.length} vídeo(s) com mais de 100 MB ficaram de fora.` : `${added.length} arquivo(s) adicionado(s).`, !!big.length);
      } catch (e) { console.error(e); toast('Não foi possível salvar. Confira a internet e tente de novo.', true); }
    });
    $$('.slide-card', p).forEach((card) => {
      const iid = card.dataset.id;
      $('[data-cap]', card).addEventListener('change', async (e) => { await mutate((al) => { al.items.find((x) => x.id === iid).caption = e.target.value.trim(); }); JE.renderAlbums(); toast('Legenda salva.'); });
      $('[data-view]', card).addEventListener('click', () => JE.openLightbox(a.items, a.items.findIndex((x) => x.id === iid)));
      const cv = $('[data-cover]', card);
      if (cv) cv.addEventListener('click', async () => { await mutate((al) => { al.cover = al.items.find((x) => x.id === iid).src; }); refresh(); toast('Capa do álbum atualizada.'); });
      $('[data-del]', card).addEventListener('click', async () => {
        if (!(await confirmBox('Excluir esta foto/vídeo do álbum?'))) return;
        await mutate(async (al) => { const it = al.items.find((x) => x.id === iid); if (al.cover === it.src) al.cover = ''; await db.delMedia(it.src); al.items = al.items.filter((x) => x.id !== iid); });
        refresh(); toast('Excluído.');
      });
    });
  }

  /* =======================================================
     AGENDA / EVENTOS
     ======================================================= */
  async function tabEvents(p) {
    const events = (await db.get('events', [])).slice().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    const albums = await db.get('albums', []);
    p.innerHTML = `
      <div class="panel-head"><h3>Agenda de eventos</h3><button class="btn btn-pink" id="evNew" type="button">Novo evento</button></div>
      <div class="list">${events.map((e) => {
        const [c, cs] = JE.EVENT_TYPES[e.type] || JE.EVENT_TYPES['Outro'];
        const d = parseDate(e.date);
        const al = albums.find((x) => x.id === e.albumId);
        return `<div class="item" data-id="${e.id}">
          <div class="mini" style="background:${cs};color:${c};display:grid;text-align:center;line-height:1"><div><b style="font-size:1.4rem">${d.getDate()}</b><br><small style="font-size:.7rem;font-weight:800">${MONTHS[d.getMonth()].slice(0, 3).toUpperCase()} ${String(d.getFullYear()).slice(2)}</small></div></div>
          <div><h4>${esc(e.title)}</h4><p><span class="tag" style="--ec:${c};--ec-soft:${cs}">${esc(e.type)}</span>${fmtDate(e.date)}${e.time ? ' às ' + esc(e.time) : ''}${al ? ' · Álbum: ' + esc(al.title) : ''}</p></div>
          <div class="acts">${al ? '' : '<button class="btn btn-green sm" data-album type="button">Criar álbum</button>'}
          <button class="btn btn-ghost sm" data-edit type="button">Editar</button>
          <button class="btn btn-danger sm" data-del type="button">Excluir</button></div></div>`;
      }).join('') || '<p class="empty">Nenhum evento cadastrado.</p>'}</div>`;
    $('#evNew', p).addEventListener('click', () => eventForm());
    $$('.item', p).forEach((it) => {
      const id = it.dataset.id;
      $('[data-edit]', it).addEventListener('click', () => eventForm(id));
      const ab = $('[data-album]', it); if (ab) ab.addEventListener('click', () => albumForm(null, id));
      $('[data-del]', it).addEventListener('click', async () => {
        const list = await db.get('events', []); const e = list.find((x) => x.id === id);
        if (!(await confirmBox(`Excluir o evento “${e.title}”? O álbum de fotos, se houver, continua na galeria.`))) return;
        await db.set('events', list.filter((x) => x.id !== id));
        const als = await db.get('albums', []); als.forEach((a) => { if (a.eventId === id) a.eventId = ''; }); await db.set('albums', als);
        refresh(); toast('Evento excluído.');
      });
    });
  }

  async function eventForm(id) {
    const events = await db.get('events', []);
    const albums = await db.get('albums', []);
    const e = events.find((x) => x.id === id) || { title: '', type: 'Formatura', date: todayISO(), time: '', description: '', albumId: '' };
    formModal(id ? 'Editar evento' : 'Novo evento', `
      <div class="row"><div class="field"><label for="evType">Tipo</label><select id="evType">${Object.keys(EVENT_TYPES).map((t) => `<option ${t === e.type ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label for="evTitle">Nome do evento</label><input id="evTitle" required value="${esc(e.title)}" placeholder="Ex.: Formatura do Jardim 2"></div></div>
      <div class="row"><div class="field"><label for="evDate">Data</label><input id="evDate" type="date" required value="${esc(e.date)}"></div>
      <div class="field"><label for="evTime">Horário</label><input id="evTime" type="time" value="${esc(e.time)}"></div></div>
      <div class="field"><label for="evDesc">Descrição</label><textarea id="evDesc" placeholder="Local, o que levar, roupa da criança...">${esc(e.description)}</textarea></div>
      <div class="field"><label for="evAlbum">Álbum de fotos do evento</label><select id="evAlbum"><option value="">Nenhum</option>
        ${albums.map((a) => `<option value="${a.id}" ${a.id === e.albumId ? 'selected' : ''}>${esc(a.title)}</option>`).join('')}</select>
        <p class="hint">Depois do evento, crie um álbum na aba Álbuns ou pelo botão “Criar álbum” na lista.</p></div>`,
    async () => {
      const list = await db.get('events', []);
      const data = { title: val('evTitle'), type: val('evType'), date: val('evDate'), time: val('evTime'), description: val('evDesc'), albumId: val('evAlbum') };
      let eid = id;
      if (id) Object.assign(list.find((x) => x.id === id), data); else { eid = db.uid('e'); list.push(Object.assign({ id: eid }, data)); }
      await db.set('events', list);
      if (data.albumId) { const als = await db.get('albums', []); const a = als.find((x) => x.id === data.albumId); if (a) { a.eventId = eid; await db.set('albums', als); } }
    });
    const typeSel = $('#evType'), title = $('#evTitle');
    typeSel.addEventListener('change', () => { if (!title.value || Object.keys(EVENT_TYPES).includes(title.value)) title.value = typeSel.value === 'Outro' ? '' : typeSel.value; });
  }

  /* =======================================================
     FUNCIONÁRIOS
     ======================================================= */
  const ROLES = ['Diretora', 'Coordenadora pedagógica', 'Professora', 'Professor', 'Auxiliar de classe', 'Cuidadora', 'Secretária', 'Cozinheira', 'Serviços gerais', 'Porteiro'];
  async function tabStaff(p) {
    const staff = await db.get('staff', []);
    p.innerHTML = `
      <div class="panel-head"><h3>Funcionários</h3><button class="btn btn-pink" id="stNew" type="button">Cadastrar funcionário</button></div>
      <p class="hint">Foto, nome e função aparecem na seção “Nossa equipe” do site, nesta ordem.</p>
      <div class="list">${staff.map((s, i) => `<div class="item" data-id="${s.id}">${mini(s.photo, s.name)}
        <div><h4>${esc(s.name)}</h4><p>${esc(s.role)}</p></div>
        <div class="acts"><button class="btn btn-ghost sm" data-mv="-1" type="button" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
        <button class="btn btn-ghost sm" data-mv="1" type="button" ${i === staff.length - 1 ? 'disabled' : ''} aria-label="Descer">↓</button>
        <button class="btn btn-ghost sm" data-edit type="button">Editar</button>
        <button class="btn btn-danger sm" data-del type="button">Excluir</button></div></div>`).join('') || '<p class="empty">Nenhum funcionário cadastrado ainda.</p>'}</div>`;
    $('#stNew', p).addEventListener('click', () => staffForm());
    $$('.item', p).forEach((it) => {
      const id = it.dataset.id;
      $('[data-edit]', it).addEventListener('click', () => staffForm(id));
      $$('[data-mv]', it).forEach((b) => b.addEventListener('click', async () => {
        const l = await db.get('staff', []); const i = l.findIndex((x) => x.id === id); const j = i + Number(b.dataset.mv);
        if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; await db.set('staff', l); refresh();
      }));
      $('[data-del]', it).addEventListener('click', async () => {
        const l = await db.get('staff', []); const s = l.find((x) => x.id === id);
        if (!(await confirmBox(`Excluir ${s.name} da equipe?`))) return;
        await db.delMedia(s.photo); await db.set('staff', l.filter((x) => x.id !== id)); refresh(); toast('Funcionário excluído.');
      });
    });
  }
  async function staffForm(id) {
    const s = (await db.get('staff', [])).find((x) => x.id === id) || { name: '', role: '', photo: '', bio: '' };
    const f = formModal(id ? 'Editar funcionário' : 'Cadastrar funcionário', `
      ${photoField('stPhoto', s.photo)}
      <div class="row"><div class="field"><label for="stName">Nome</label><input id="stName" required value="${esc(s.name)}"></div>
      <div class="field"><label for="stRole">Função</label><input id="stRole" required list="roleList" value="${esc(s.role)}" placeholder="Ex.: Professora"><datalist id="roleList">${ROLES.map((r) => `<option value="${r}">`).join('')}</datalist></div></div>
      <div class="field"><label for="stBio">Frase curta (opcional)</label><input id="stBio" value="${esc(s.bio)}" placeholder="Ex.: Professora do Maternal I"></div>`,
    async () => {
      const l = await db.get('staff', []);
      const data = { name: val('stName'), role: val('stRole'), photo: val('stPhoto'), bio: val('stBio') };
      if (id) { const cur = l.find((x) => x.id === id); if (cur.photo && cur.photo !== data.photo) await db.delMedia(cur.photo); Object.assign(cur, data); }
      else l.push(Object.assign({ id: db.uid('f') }, data));
      await db.set('staff', l);
    });
    f.track(wirePhotoField('stPhoto'));
  }

  /* =======================================================
     TURMAS
     ======================================================= */
  const CLASS_NAMES = ['Baby Class', 'Maternal I', 'Maternal II', 'Jardim I', 'Jardim II'];
  async function tabClasses(p) {
    const classes = await db.get('classes', []);
    const students = await db.get('students', []);
    p.innerHTML = `
      <div class="panel-head"><h3>Turmas</h3><button class="btn btn-pink" id="clNew" type="button">Nova turma</button></div>
      <div class="list">${classes.map((c) => {
        const n = students.filter((s) => s.classId === c.id).length;
        return `<div class="item" data-id="${c.id}"><div class="mini">${esc(initials(c.name))}</div>
        <div><h4>${esc(c.name)}</h4><p>${[c.shift, c.teacher ? 'Prof.: ' + c.teacher : '', c.year, n + (n === 1 ? ' aluno' : ' alunos')].filter(Boolean).map(esc).join(' · ')}</p></div>
        <div class="acts"><button class="btn btn-green sm" data-see type="button">Ver alunos</button>
        <button class="btn btn-ghost sm" data-edit type="button">Editar</button>
        <button class="btn btn-danger sm" data-del type="button">Excluir</button></div></div>`;
      }).join('') || '<p class="empty">Nenhuma turma cadastrada. Comece por “Nova turma”.</p>'}</div>`;
    $('#clNew', p).addEventListener('click', () => classForm());
    $$('.item', p).forEach((it) => {
      const id = it.dataset.id;
      $('[data-edit]', it).addEventListener('click', () => classForm(id));
      $('[data-see]', it).addEventListener('click', () => { studentFilter.classId = id; studentFilter.q = ''; switchTab('alunos'); });
      $('[data-del]', it).addEventListener('click', async () => {
        const l = await db.get('classes', []); const c = l.find((x) => x.id === id);
        if (!(await confirmBox(`Excluir a turma “${c.name}”? Os alunos dela continuam cadastrados, mas ficam sem turma.`))) return;
        await db.set('classes', l.filter((x) => x.id !== id));
        const st = await db.get('students', []); st.forEach((s) => { if (s.classId === id) s.classId = ''; }); await db.set('students', st);
        refresh(); toast('Turma excluída.');
      });
    });
  }
  async function classForm(id) {
    const c = (await db.get('classes', [])).find((x) => x.id === id) || { name: '', shift: 'Manhã', teacher: '', year: String(new Date().getFullYear() + (new Date().getMonth() >= 10 ? 1 : 0)) };
    formModal(id ? 'Editar turma' : 'Nova turma', `
      <div class="row"><div class="field"><label for="clName">Nome da turma</label><input id="clName" required list="clList" value="${esc(c.name)}" placeholder="Ex.: Maternal I"><datalist id="clList">${CLASS_NAMES.map((n) => `<option value="${n}">`).join('')}</datalist></div>
      <div class="field"><label for="clShift">Turno</label><select id="clShift">${['Manhã', 'Tarde', 'Integral'].map((t) => `<option ${t === c.shift ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
      <div class="row"><div class="field"><label for="clTeacher">Professora responsável</label><input id="clTeacher" value="${esc(c.teacher)}"></div>
      <div class="field"><label for="clYear">Ano letivo</label><input id="clYear" inputmode="numeric" value="${esc(c.year)}"></div></div>`,
    async () => {
      const l = await db.get('classes', []);
      const data = { name: val('clName'), shift: val('clShift'), teacher: val('clTeacher'), year: val('clYear') };
      if (id) Object.assign(l.find((x) => x.id === id), data); else l.push(Object.assign({ id: db.uid('t') }, data));
      await db.set('classes', l);
    });
  }
  function switchTab(tab) { currentTab = tab; openAlbumId = null; $$('#adminTabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === tab)); renderTab(); }

  /* =======================================================
     ALUNOS E MENSALIDADES (somente administrador)
     ======================================================= */
  const studentFilter = { q: '', classId: '', status: '' };
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function payStatus(pm) { if (pm.paid) return 'paga'; return pm.due && pm.due < todayISO() ? 'atrasada' : 'pendente'; }
  function paySummary(st) {
    const r = { paga: 0, pendente: 0, atrasada: 0, vPaga: 0, vAberto: 0 };
    (st.payments || []).forEach((pm) => { const s = payStatus(pm); r[s]++; if (s === 'paga') r.vPaga += Number(pm.value) || 0; else r.vAberto += Number(pm.value) || 0; });
    return r;
  }
  function age(birth) {
    const b = parseDate(birth); if (!b) return '';
    const now = new Date(); let months = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth(); if (now.getDate() < b.getDate()) months--;
    if (months < 0) return '';
    const y = Math.floor(months / 12), m = months % 12;
    return (y ? y + (y === 1 ? ' ano' : ' anos') : '') + (y && m ? ' e ' : '') + (m ? m + (m === 1 ? ' mês' : ' meses') : '') || 'menos de 1 mês';
  }

  async function tabStudents(p) {
    const students = (await db.get('students', [])).slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const classes = await db.get('classes', []);
    const cname = (id) => (classes.find((c) => c.id === id) || {}).name || 'Sem turma';
    p.innerHTML = `
      <div class="panel-head"><h3>Alunos e mensalidades</h3><button class="btn btn-pink" id="stuNew" type="button">Cadastrar aluno</button></div>
      <p class="private-note">Área restrita: estas informações aparecem só aqui no painel, nunca na parte pública do site.</p>
      <div class="search">
        <input id="stuQ" type="search" placeholder="Pesquisar pelo nome do aluno, da mãe ou do pai" value="${esc(studentFilter.q)}" aria-label="Pesquisar aluno">
        <select id="stuClass" aria-label="Filtrar por turma"><option value="">Todas as turmas</option>${classes.map((c) => `<option value="${c.id}" ${c.id === studentFilter.classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        <select id="stuStatus" aria-label="Filtrar por mensalidades"><option value="">Todas as situações</option>
          <option value="aberto" ${studentFilter.status === 'aberto' ? 'selected' : ''}>Com mensalidade em aberto</option>
          <option value="atrasada" ${studentFilter.status === 'atrasada' ? 'selected' : ''}>Com mensalidade atrasada</option>
          <option value="emdia" ${studentFilter.status === 'emdia' ? 'selected' : ''}>Em dia</option></select>
      </div>
      <div class="list" id="stuList"></div>
      ${students.length ? '' : `<div class="card" style="margin-top:14px"><p class="hint">Quer ver como funciona antes de cadastrar os alunos de verdade? Crie uma turma e dois alunos de exemplo. Depois é só excluí-los.</p>
        <div class="form-actions" style="justify-content:flex-start"><button class="btn btn-yellow sm" id="stuDemo" type="button">Criar alunos de exemplo</button></div></div>`}`;

    const draw = () => {
      const q = norm(studentFilter.q);
      const list = students.filter((s) => {
        if (studentFilter.classId && s.classId !== studentFilter.classId) return false;
        if (q && !norm([s.name, s.mother, s.father, s.guardian].join(' ')).includes(q)) return false;
        const sm = paySummary(s);
        if (studentFilter.status === 'aberto' && !(sm.pendente + sm.atrasada)) return false;
        if (studentFilter.status === 'atrasada' && !sm.atrasada) return false;
        if (studentFilter.status === 'emdia' && sm.atrasada) return false;
        return true;
      });
      $('#stuList').innerHTML = list.map((s) => {
        const sm = paySummary(s);
        return `<div class="item" data-id="${s.id}">${mini(s.photo, s.name)}
          <div><h4>${esc(s.name)}</h4><p>${esc(cname(s.classId))}${s.birth ? ' · ' + esc(age(s.birth)) : ''}${s.mother ? ' · Mãe: ' + esc(s.mother) : ''}</p>
          <p><span class="pill ok">${sm.paga} paga(s)</span> <span class="pill pend">${sm.pendente} pendente(s)</span> ${sm.atrasada ? `<span class="pill late">${sm.atrasada} atrasada(s)</span>` : ''}</p></div>
          <div class="acts"><button class="btn btn-green sm" data-see type="button">Ficha e mensalidades</button>
          <button class="btn btn-ghost sm" data-edit type="button">Editar</button>
          <button class="btn btn-danger sm" data-del type="button">Excluir</button></div></div>`;
      }).join('') || `<p class="empty">${students.length ? 'Nenhum aluno encontrado com essa pesquisa.' : 'Nenhum aluno cadastrado ainda.'}</p>`;
      db.hydrate($('#stuList'));
      $$('#stuList .item').forEach((it) => {
        const id = it.dataset.id;
        $('[data-see]', it).addEventListener('click', () => studentFicha(id));
        $('[data-edit]', it).addEventListener('click', () => studentForm(id));
        $('[data-del]', it).addEventListener('click', async () => {
          const l = await db.get('students', []); const s = l.find((x) => x.id === id);
          if (!(await confirmBox(`Excluir o cadastro de ${s.name}, com todas as mensalidades? Isso não pode ser desfeito.`))) return;
          await db.delMedia(s.photo); await db.set('students', l.filter((x) => x.id !== id)); refresh(); toast('Aluno excluído.');
        });
      });
    };
    draw();
    $('#stuQ').addEventListener('input', (e) => { studentFilter.q = e.target.value; draw(); });
    $('#stuClass').addEventListener('change', (e) => { studentFilter.classId = e.target.value; draw(); });
    $('#stuStatus').addEventListener('change', (e) => { studentFilter.status = e.target.value; draw(); });
    $('#stuNew', p).addEventListener('click', () => studentForm());
    const demo = $('#stuDemo', p); if (demo) demo.addEventListener('click', createDemo);
  }

  function buildPayments(opts) {
    const out = [];
    for (let m = opts.from; m <= opts.to; m++) {
      const ref = opts.year + '-' + String(m).padStart(2, '0');
      const last = new Date(opts.year, m, 0).getDate();
      const due = ref + '-' + String(Math.min(opts.dueDay || 10, last)).padStart(2, '0');
      const first = m === opts.from && opts.enroll;
      out.push({ id: db.uid('p'), ref, label: first ? 'Matrícula (1ª mensalidade)' : MONTHS[m - 1].replace(/^./, (c) => c.toUpperCase()) + '/' + opts.year, due, value: first ? opts.enroll : opts.fee, paid: false, paidAt: '' });
    }
    return out;
  }

  async function createDemo() {
    const classes = await db.get('classes', []);
    const cls = { id: db.uid('t'), name: 'Maternal I (exemplo)', shift: 'Manhã', teacher: '', year: '2027' };
    classes.push(cls); await db.set('classes', classes);
    const pk = PACKAGES[0];
    const mk = (name, mother, father, birth, paidN) => {
      const pays = buildPayments({ year: 2026, from: 8, to: 12, dueDay: 10, fee: pk.fee, enroll: pk.enroll });
      pays.forEach((pm, i) => { if (i < paidN) { pm.paid = true; pm.paidAt = pm.due; } });
      return { id: db.uid('al'), name, photo: '', classId: cls.id, birth, mother, motherPhone: '', father, fatherPhone: '', guardian: mother, address: '', package: pk.name, schedule: '7h30 às 11h30', fee: pk.fee, dueDay: 10, enrollDate: '2026-08-01', health: '', pickup: '', notes: 'Cadastro de exemplo. Pode excluir.', payments: pays };
    };
    const st = await db.get('students', []);
    st.push(mk('Aluno Exemplo Um', 'Mãe Exemplo Um', 'Pai Exemplo Um', '2024-03-15', 3));
    st.push(mk('Aluna Exemplo Dois', 'Mãe Exemplo Dois', 'Pai Exemplo Dois', '2023-09-02', 5));
    await db.set('students', st);
    refresh(); toast('Turma e alunos de exemplo criados.');
  }

  async function studentForm(id) {
    const classes = await db.get('classes', []);
    const s = (await db.get('students', [])).find((x) => x.id === id) || { name: '', photo: '', classId: studentFilter.classId || '', birth: '', mother: '', motherPhone: '', father: '', fatherPhone: '', guardian: '', address: '', package: '', schedule: '', fee: '', dueDay: 10, enrollDate: todayISO(), health: '', pickup: '', notes: '', payments: [] };
    const f = formModal(id ? 'Editar aluno' : 'Cadastrar aluno', `
      ${photoField('suPhoto', s.photo, 'Foto do aluno')}
      <div class="row"><div class="field"><label for="suName">Nome completo</label><input id="suName" required value="${esc(s.name)}"></div>
      <div class="field"><label for="suBirth">Data de nascimento</label><input id="suBirth" type="date" value="${esc(s.birth)}"></div></div>
      <div class="row"><div class="field"><label for="suClass">Turma</label><select id="suClass"><option value="">Sem turma</option>${classes.map((c) => `<option value="${c.id}" ${c.id === s.classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="suEnroll">Data da matrícula</label><input id="suEnroll" type="date" value="${esc(s.enrollDate)}"></div></div>
      <div class="row"><div class="field"><label for="suMother">Nome da mãe</label><input id="suMother" value="${esc(s.mother)}"></div>
      <div class="field"><label for="suMotherPh">Telefone da mãe</label><input id="suMotherPh" type="tel" value="${esc(s.motherPhone)}"></div></div>
      <div class="row"><div class="field"><label for="suFather">Nome do pai</label><input id="suFather" value="${esc(s.father)}"></div>
      <div class="field"><label for="suFatherPh">Telefone do pai</label><input id="suFatherPh" type="tel" value="${esc(s.fatherPhone)}"></div></div>
      <div class="row"><div class="field"><label for="suGuardian">Responsável financeiro</label><input id="suGuardian" value="${esc(s.guardian)}"></div>
      <div class="field"><label for="suAddress">Endereço</label><input id="suAddress" value="${esc(s.address)}"></div></div>
      <div class="row"><div class="field"><label for="suPkg">Pacote</label><select id="suPkg"><option value="">Escolha</option>${PACKAGES.map((k) => `<option ${k.name === s.package ? 'selected' : ''}>${k.name}</option>`).join('')}</select></div>
      <div class="field"><label for="suSched">Horário da criança</label><input id="suSched" value="${esc(s.schedule)}" placeholder="Ex.: 8h às 14h"></div></div>
      <div class="row"><div class="field"><label for="suFee">Valor da mensalidade (R$)</label><input id="suFee" inputmode="decimal" value="${esc(s.fee)}"></div>
      <div class="field"><label for="suDue">Dia do vencimento</label><input id="suDue" type="number" min="1" max="31" value="${esc(s.dueDay)}"></div></div>
      <div class="field"><label for="suHealth">Saúde (alergias, remédios, cuidados)</label><textarea id="suHealth">${esc(s.health)}</textarea></div>
      <div class="field"><label for="suPickup">Pessoas autorizadas a buscar a criança</label><textarea id="suPickup">${esc(s.pickup)}</textarea></div>
      <div class="field"><label for="suNotes">Observações</label><textarea id="suNotes">${esc(s.notes)}</textarea></div>
      ${id ? '' : `<div class="card"><label style="display:flex;gap:8px;align-items:center;font-weight:800"><input type="checkbox" id="suGen" checked> Já criar as mensalidades do ano</label>
        <p class="hint">Cria uma mensalidade por mês, do mês da matrícula até dezembro. A primeira fica como “Matrícula”, com o valor do pacote.</p></div>`}`,
    async () => {
      const l = await db.get('students', []);
      const data = {
        name: val('suName'), photo: val('suPhoto'), birth: val('suBirth'), classId: val('suClass'), enrollDate: val('suEnroll'),
        mother: val('suMother'), motherPhone: val('suMotherPh'), father: val('suFather'), fatherPhone: val('suFatherPh'),
        guardian: val('suGuardian'), address: val('suAddress'), package: val('suPkg'), schedule: val('suSched'),
        fee: parseMoney(val('suFee')), dueDay: Number(val('suDue')) || 10, health: val('suHealth'), pickup: val('suPickup'), notes: val('suNotes')
      };
      if (id) { const cur = l.find((x) => x.id === id); if (cur.photo && cur.photo !== data.photo) await db.delMedia(cur.photo); Object.assign(cur, data); }
      else {
        let payments = [];
        if ($('#suGen') && $('#suGen').checked) {
          const d = parseDate(data.enrollDate) || new Date();
          const pk = PACKAGES.find((k) => k.name === data.package);
          payments = buildPayments({ year: d.getFullYear(), from: d.getMonth() + 1, to: 12, dueDay: data.dueDay, fee: data.fee, enroll: pk ? pk.enroll : 0 });
        }
        l.push(Object.assign({ id: db.uid('al'), payments }, data));
      }
      await db.set('students', l);
    }, { wide: true });
    f.track(wirePhotoField('suPhoto'));
    $('#suPkg').addEventListener('change', (e) => {
      const pk = PACKAGES.find((k) => k.name === e.target.value);
      if (pk) { $('#suFee').value = String(pk.fee).replace('.', ','); if (!$('#suSched').value) $('#suSched').value = pk.group === 'parcial' ? pk.ex.split(', ')[1].replace('das ', '') : ''; }
    });
  }
  function parseMoney(s) { if (!s) return 0; return Number(String(s).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) || 0; }

  async function studentFicha(id) {
    const st = (await db.get('students', [])).find((x) => x.id === id);
    if (!st) return;
    const classes = await db.get('classes', []);
    const cls = classes.find((c) => c.id === st.classId);
    const sm = paySummary(st);
    const pays = (st.payments || []).slice().sort((a, b) => (a.due || a.ref).localeCompare(b.due || b.ref));
    const rows = [
      ['Turma', cls ? cls.name + (cls.shift ? ' (' + cls.shift + ')' : '') : 'Sem turma'],
      ['Nascimento', st.birth ? fmtDate(st.birth) + ' (' + age(st.birth) + ')' : ''],
      ['Mãe', [st.mother, st.motherPhone].filter(Boolean).join(' · ')],
      ['Pai', [st.father, st.fatherPhone].filter(Boolean).join(' · ')],
      ['Responsável financeiro', st.guardian], ['Endereço', st.address],
      ['Pacote', [st.package, st.schedule].filter(Boolean).join(' · ')],
      ['Mensalidade', st.fee ? money(st.fee) + ', vence todo dia ' + st.dueDay : ''],
      ['Matrícula em', fmtDate(st.enrollDate)], ['Saúde', st.health], ['Autorizados a buscar', st.pickup], ['Observações', st.notes]
    ].filter((r) => r[1]);
    const body = openModal(st.name, `
      <div class="ficha"><div class="foto">${st.photo ? `<img data-src="${esc(st.photo)}" alt="Foto de ${esc(st.name)}">` : esc(initials(st.name))}</div>
      <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>
      <div class="sum"><div class="s-ok">Pagas<b>${sm.paga}</b>${money(sm.vPaga)}</div>
        <div class="s-pend">Pendentes<b>${sm.pendente}</b></div>
        <div class="s-late">Atrasadas<b>${sm.atrasada}</b></div>
        <div>Total em aberto<b>${money(sm.vAberto)}</b></div></div>
      <div class="panel-head"><h3 style="font-size:1.2rem">Mensalidades</h3>
        <button class="btn btn-ghost sm" id="fpAdd" type="button">Adicionar mensalidade</button>
        <button class="btn btn-ghost sm" id="fpGen" type="button">Gerar meses de um ano</button>
        <button class="btn btn-ghost sm" id="fpEdit" type="button">Editar cadastro</button></div>
      <div class="table-wrap"><table class="pay"><thead><tr><th>Referência</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th>Pago em</th><th></th></tr></thead>
      <tbody>${pays.map((pm) => {
        const s = payStatus(pm);
        return `<tr data-id="${pm.id}"><td>${esc(pm.label || pm.ref)}</td><td>${fmtDate(pm.due)}</td>
          <td><input data-v value="${esc(String(pm.value).replace('.', ','))}" aria-label="Valor"></td>
          <td><span class="pill ${s === 'paga' ? 'ok' : s === 'atrasada' ? 'late' : 'pend'}">${s === 'paga' ? 'Paga' : s === 'atrasada' ? 'Atrasada' : 'Pendente'}</span></td>
          <td>${pm.paid ? fmtDate(pm.paidAt) : '–'}</td>
          <td style="white-space:nowrap"><button class="btn ${pm.paid ? 'btn-ghost' : 'btn-green'} sm" data-t type="button">${pm.paid ? 'Desfazer' : 'Marcar como paga'}</button>
          <button class="btn btn-danger sm" data-x type="button" aria-label="Remover mensalidade">×</button></td></tr>`;
      }).join('') || '<tr><td colspan="6">Nenhuma mensalidade lançada. Use “Gerar meses de um ano”.</td></tr>'}</tbody></table></div>`, { wide: true, noFocus: true });

    const save = async (fn) => { const l = await db.get('students', []); const s = l.find((x) => x.id === id); fn(s); await db.set('students', l); };
    $$('tr[data-id]', body).forEach((tr) => {
      const pid = tr.dataset.id;
      $('[data-t]', tr).addEventListener('click', async () => { await save((s) => { const pm = s.payments.find((x) => x.id === pid); pm.paid = !pm.paid; pm.paidAt = pm.paid ? todayISO() : ''; }); studentFicha(id); renderTab(); });
      $('[data-v]', tr).addEventListener('change', async (e) => { await save((s) => { s.payments.find((x) => x.id === pid).value = parseMoney(e.target.value); }); toast('Valor atualizado.'); studentFicha(id); });
      $('[data-x]', tr).addEventListener('click', async () => { await save((s) => { s.payments = s.payments.filter((x) => x.id !== pid); }); studentFicha(id); renderTab(); });
    });
    $('#fpEdit', body).addEventListener('click', () => studentForm(id));
    $('#fpAdd', body).addEventListener('click', () => {
      const d = new Date();
      const b = openModal('Adicionar mensalidade de ' + st.name, `<form class="form" id="paF">
        <div class="row"><div class="field"><label for="paLabel">Descrição</label><input id="paLabel" required value="${MONTHS[d.getMonth()].replace(/^./, (c) => c.toUpperCase())}/${d.getFullYear()}"></div>
        <div class="field"><label for="paDue">Vencimento</label><input id="paDue" type="date" required value="${todayISO()}"></div>
        <div class="field"><label for="paVal">Valor (R$)</label><input id="paVal" inputmode="decimal" value="${esc(String(st.fee || '').replace('.', ','))}"></div></div>
        <label style="display:flex;gap:8px;align-items:center;font-weight:800"><input type="checkbox" id="paPaid"> Já foi paga</label>
        <div class="form-actions"><button class="btn btn-ghost" type="button" id="paBack">Voltar</button><button class="btn btn-green" type="submit">Adicionar</button></div></form>`);
      $('#paBack', b).addEventListener('click', () => studentFicha(id));
      $('#paF', b).addEventListener('submit', async (e) => {
        e.preventDefault();
        const paid = $('#paPaid').checked;
        await save((s) => { s.payments = s.payments || []; s.payments.push({ id: db.uid('p'), ref: val('paDue').slice(0, 7), label: val('paLabel'), due: val('paDue'), value: parseMoney(val('paVal')), paid, paidAt: paid ? todayISO() : '' }); });
        studentFicha(id); renderTab(); toast('Mensalidade adicionada.');
      });
    });
    $('#fpGen', body).addEventListener('click', () => {
      const y = new Date().getFullYear() + (new Date().getMonth() >= 10 ? 1 : 0);
      const b = openModal('Gerar mensalidades de ' + st.name, `<form class="form" id="gnF">
        <div class="row"><div class="field"><label for="gnYear">Ano</label><input id="gnYear" type="number" required value="${y}"></div>
        <div class="field"><label for="gnFrom">Do mês</label><select id="gnFrom">${MONTHS.map((m, i) => `<option value="${i + 1}" ${i === 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
        <div class="field"><label for="gnTo">Até o mês</label><select id="gnTo">${MONTHS.map((m, i) => `<option value="${i + 1}" ${i === 11 ? 'selected' : ''}>${m}</option>`).join('')}</select></div></div>
        <div class="row"><div class="field"><label for="gnFee">Valor mensal (R$)</label><input id="gnFee" inputmode="decimal" required value="${esc(String(st.fee || '').replace('.', ','))}"></div>
        <div class="field"><label for="gnDue">Dia do vencimento</label><input id="gnDue" type="number" min="1" max="31" value="${esc(st.dueDay || 10)}"></div></div>
        <div class="form-actions"><button class="btn btn-ghost" type="button" id="gnBack">Voltar</button><button class="btn btn-green" type="submit">Gerar</button></div></form>`);
      $('#gnBack', b).addEventListener('click', () => studentFicha(id));
      $('#gnF', b).addEventListener('submit', async (e) => {
        e.preventDefault();
        const from = Number(val('gnFrom')), to = Number(val('gnTo'));
        if (to < from) { toast('O mês final precisa ser depois do mês inicial.', true); return; }
        const items = buildPayments({ year: Number(val('gnYear')), from, to, dueDay: Number(val('gnDue')) || 10, fee: parseMoney(val('gnFee')) });
        let added = 0;
        await save((s) => { s.payments = s.payments || []; items.forEach((it) => { if (!s.payments.some((x) => x.ref === it.ref && !/Matr/.test(x.label || ''))) { s.payments.push(it); added++; } }); });
        studentFicha(id); renderTab(); toast(added + ' mensalidade(s) criada(s). Meses que já existiam foram mantidos.');
      });
    });
  }

  /* =======================================================
     CONFIGURAÇÕES
     ======================================================= */
  async function tabConfig(p) {
    p.innerHTML = `
      <div class="panel-head"><h3>Configurações</h3></div>
      <div class="card" style="margin-bottom:16px">
        <h4 style="margin:0 0 8px;font-family:var(--font-display)">Trocar a senha</h4>
        <p class="hint">Você entrou como <strong>${esc(db.adminEmail())}</strong>.</p>
        <form class="form" id="pwF">
          <div class="field"><label for="pwOld">Senha atual</label><input id="pwOld" type="password" required autocomplete="current-password"></div>
          <div class="row"><div class="field"><label for="pwNew">Nova senha</label><input id="pwNew" type="password" minlength="6" required autocomplete="new-password"></div>
          <div class="field"><label for="pwNew2">Repita a nova senha</label><input id="pwNew2" type="password" minlength="6" required autocomplete="new-password"></div></div>
          <div class="form-actions"><button class="btn btn-green" type="submit">Salvar nova senha</button></div>
        </form></div>
      <div class="card">
        <h4 style="margin:0 0 8px;font-family:var(--font-display)">Onde ficam os dados</h4>
        <p class="hint">Os cadastros ficam salvos no Firebase e as fotos e vídeos no Cloudinary, os dois na internet. Ao excluir uma foto aqui, ela sai do site, mas o arquivo continua no painel do Cloudinary (pasta jardim-encantado), onde você pode apagá-lo se quiser liberar espaço. Fotos, vídeos, eventos, álbuns e funcionários aparecem para qualquer pessoa que abrir o site. Turmas, alunos e mensalidades só podem ser vistos por quem entrar com o login do administrador.</p>
      </div>`;
    $('#pwF', p).addEventListener('submit', async (e) => {
      e.preventDefault();
      if ($('#pwNew').value !== $('#pwNew2').value) { toast('As duas novas senhas não são iguais.', true); return; }
      try { await db.changePassword($('#pwOld').value, $('#pwNew').value); e.target.reset(); toast('Senha alterada.'); }
      catch (err) { console.error(err); toast(AUTH_MSG[err.code] || (err.code === 'auth/weak-password' ? 'Escolha uma senha com pelo menos 6 caracteres.' : 'Não foi possível trocar a senha.'), true); }
    });
  }

  updateAdminBtn();
})();
