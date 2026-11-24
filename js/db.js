/* =========================================================
   Jardim Encantado - armazenamento (versão 1)
   Os dados ficam no IndexedDB do próprio navegador.
   Fotos e vídeos enviados pelo administrador viram "idb:<id>".
   Na próxima versão, este arquivo é o único que precisa mudar
   para usar um servidor de verdade (ex.: Firebase).
   ========================================================= */
(function () {
  const DB_NAME = 'jardim-encantado';
  const DB_VERSION = 1;
  let idb = null;
  const memKV = new Map();     // reserva se o IndexedDB não estiver disponível
  const memMedia = new Map();
  const urlCache = new Map();

  function open() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
          if (!d.objectStoreNames.contains('media')) d.createObjectStore('media');
        };
        req.onsuccess = () => { idb = req.result; resolve(true); };
        req.onerror = () => resolve(false);
        req.onblocked = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  }

  function op(store, mode, fn) {
    if (!idb) return Promise.reject(new Error('sem idb'));
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(store, mode);
      const st = tx.objectStore(store);
      const req = fn(st);
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function get(key, fallback) {
    try {
      const v = idb ? await op('kv', 'readonly', (s) => s.get(key)) : memKV.get(key);
      return v === undefined ? fallback : v;
    } catch (e) { return memKV.has(key) ? memKV.get(key) : fallback; }
  }
  async function set(key, value) {
    memKV.set(key, value);
    try { if (idb) await op('kv', 'readwrite', (s) => s.put(value, key)); }
    catch (e) { console.warn('Falha ao salvar', key, e); throw e; }
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  async function putMedia(blob) {
    const id = uid('m');
    memMedia.set(id, blob);
    try { if (idb) await op('media', 'readwrite', (s) => s.put(blob, id)); }
    catch (e) { memMedia.delete(id); throw e; }
    return 'idb:' + id;
  }
  async function getMediaBlob(id) {
    if (memMedia.has(id)) return memMedia.get(id);
    try { return idb ? await op('media', 'readonly', (s) => s.get(id)) : null; } catch (e) { return null; }
  }
  async function delMedia(src) {
    if (!src || !String(src).startsWith('idb:')) return;
    const id = src.slice(4);
    memMedia.delete(id);
    if (urlCache.has(src)) { URL.revokeObjectURL(urlCache.get(src)); urlCache.delete(src); }
    try { if (idb) await op('media', 'readwrite', (s) => s.delete(id)); } catch (e) { /* ignora */ }
  }

  /** Devolve uma URL que o navegador consegue mostrar. */
  async function url(src) {
    if (!src) return '';
    if (!String(src).startsWith('idb:')) return src;
    if (urlCache.has(src)) return urlCache.get(src);
    const blob = await getMediaBlob(src.slice(4));
    if (!blob) return '';
    const u = URL.createObjectURL(blob);
    urlCache.set(src, u);
    return u;
  }

  /** Preenche todos os <img data-src> e <video data-src> dentro de root. */
  async function hydrate(root) {
    const els = (root || document).querySelectorAll('[data-src]');
    await Promise.all(Array.from(els).map(async (el) => {
      const u = await url(el.getAttribute('data-src'));
      if (u) { el.src = u; } else { el.removeAttribute('src'); }
      el.removeAttribute('data-src');
    }));
  }

  /** Reduz a foto para no máximo `max` px e devolve um Blob JPEG. */
  function shrinkImage(file, max) {
    max = max || 1600;
    return new Promise((resolve) => {
      const img = new Image();
      const u = URL.createObjectURL(file);
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        const k = Math.min(1, max / Math.max(w, h));
        w = Math.round(w * k); h = Math.round(h * k);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(u);
        c.toBlob((b) => resolve(b || file), 'image/jpeg', 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(u); resolve(file); };
      img.src = u;
    });
  }

  /** Salva um arquivo enviado (foto ou vídeo). */
  async function saveUpload(file, maxPx) {
    const isVideo = file.type.startsWith('video/');
    const blob = isVideo ? file : await shrinkImage(file, maxPx);
    const src = await putMedia(blob);
    return { src, type: isVideo ? 'video' : 'image' };
  }

  /* ---------- Senha ---------- */
  async function hash(text) {
    const salt = 'jardim-encantado::';
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      let h = 5381; const s = salt + text;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
      return 'x' + (h >>> 0).toString(16);
    }
  }

  /* ---------- Dados iniciais (primeira vez) ---------- */
  const FLYERS = [
    ['img/capa.jpg', 'Creche-Escola Jardim Encantado'],
    ['img/sobre-nos.jpg', 'Sobre nós'],
    ['img/infraestrutura.jpg', 'Nossa infraestrutura'],
    ['img/horarios.jpg', 'Horários parciais e integrais'],
    ['img/pacote-margarida.jpg', 'Pacote Margarida (manhã)'],
    ['img/pacote-tulipa.jpg', 'Pacote Tulipa (tarde)'],
    ['img/pacotes-integrais.jpg', 'Pacotes integrais'],
    ['img/onde-fica.jpg', 'Onde fica nossa escola'],
    ['img/agende-visita.jpg', 'Ligue e agende sua visita']
  ];

  async function seed() {
    if (await get('seeded', false)) return;
    await set('settings', { user: 'admin', passHash: await hash('jardim2027') });
    await set('slides', FLYERS.map(([src, caption]) => ({ id: uid('s'), src, caption })));
    await set('albums', [{
      id: uid('a'), title: 'Nossas propagandas', date: '2026-11-19', eventId: '',
      description: 'Panfletos e vídeos de divulgação da escola.',
      items: [
        { id: uid('i'), type: 'video', src: 'videos/video-1.mp4', poster: 'img/video-1-capa.jpg', caption: 'Vídeo de divulgação 1' },
        { id: uid('i'), type: 'video', src: 'videos/video-2.mp4', poster: 'img/video-2-capa.jpg', caption: 'Vídeo de divulgação 2' }
      ].concat(FLYERS.concat([['img/obrigada.jpg', 'Obrigada por sua atenção!']]).map(([src, caption]) => ({ id: uid('i'), type: 'image', src, caption })))
    }]);
    const note = 'Data comemorativa. O administrador pode ajustar com o dia e horário da festa na escola.';
    await set('events', [
      { id: uid('e'), title: 'Natal', type: 'Natal', date: '2026-12-25', time: '', description: note, albumId: '' },
      { id: uid('e'), title: 'Último dia dos valores promocionais de matrícula 2027', type: 'Matrículas', date: '2027-01-30', time: '', description: 'Valores dos pacotes 2027 válidos para contratos assinados até esta data.', albumId: '' },
      { id: uid('e'), title: 'Dia das Mães', type: 'Dia das Mães', date: '2027-05-09', time: '', description: note, albumId: '' },
      { id: uid('e'), title: 'Dia dos Pais', type: 'Dia dos Pais', date: '2027-08-08', time: '', description: note, albumId: '' },
      { id: uid('e'), title: 'Dia das Crianças', type: 'Dia das Crianças', date: '2027-10-12', time: '', description: note, albumId: '' }
    ]);
    await set('staff', []);
    await set('classes', []);
    await set('students', []);
    await set('seeded', true);
  }

  async function init() {
    await open();
    await seed();
  }

  function reset() {
    return new Promise((resolve) => {
      try { if (idb) idb.close(); } catch (e) { /* ok */ }
      idb = null;
      try {
        const r = indexedDB.deleteDatabase(DB_NAME);
        r.onsuccess = r.onerror = r.onblocked = () => resolve();
      } catch (e) { resolve(); }
    });
  }

  window.JE = window.JE || {};
  window.JE.db = { init, get, set, uid, url, hydrate, saveUpload, delMedia, hash, reset, isPersistent: () => !!idb };
})();
