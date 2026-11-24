/* =========================================================
   Jardim Encantado - armazenamento (versão 2, Firebase)
   - Textos e listas: Firestore
       site/{slides|albums|events|staff}   -> público (qualquer um lê)
       private/{classes|students}          -> só o administrador
   - Fotos e vídeos: Firebase Storage (pasta media/)
   - Login do administrador: Firebase Authentication (e-mail e senha)
   ========================================================= */
(function () {
  const PUBLIC_KEYS = ['slides', 'albums', 'events', 'staff'];
  const PRIVATE_KEYS = ['classes', 'students'];
  const cache = new Map();
  const failed = new Set(); // chaves que não conseguimos ler do Firebase
  let fs = null, storage = null, auth = null, ready = false;
  const authListeners = [];

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- Conteúdo inicial (enquanto o administrador não salvar nada) ---------- */
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
  const note = 'Data comemorativa. O administrador pode ajustar com o dia e horário da festa na escola.';
  const DEFAULTS = {
    slides: FLYERS.map(([src, caption], i) => ({ id: 's_ini' + i, src, caption })),
    albums: [{
      id: 'a_propagandas', title: 'Nossas propagandas', date: '2026-11-19', eventId: '',
      description: 'Panfletos e vídeos de divulgação da escola.',
      items: [
        { id: 'i_v1', type: 'video', src: 'videos/video-1.mp4', poster: 'img/video-1-capa.jpg', caption: 'Vídeo de divulgação 1' },
        { id: 'i_v2', type: 'video', src: 'videos/video-2.mp4', poster: 'img/video-2-capa.jpg', caption: 'Vídeo de divulgação 2' }
      ].concat(FLYERS.concat([['img/obrigada.jpg', 'Obrigada por sua atenção!']]).map(([src, caption], i) => ({ id: 'i_f' + i, type: 'image', src, caption })))
    }],
    events: [
      { id: 'e_natal', title: 'Natal', type: 'Natal', date: '2026-12-25', time: '', description: note, albumId: '' },
      { id: 'e_matr', title: 'Último dia dos valores promocionais de matrícula 2027', type: 'Matrículas', date: '2027-01-30', time: '', description: 'Valores dos pacotes 2027 válidos para contratos assinados até esta data.', albumId: '' },
      { id: 'e_maes', title: 'Dia das Mães', type: 'Dia das Mães', date: '2027-05-09', time: '', description: note, albumId: '' },
      { id: 'e_pais', title: 'Dia dos Pais', type: 'Dia dos Pais', date: '2027-08-08', time: '', description: note, albumId: '' },
      { id: 'e_cri', title: 'Dia das Crianças', type: 'Dia das Crianças', date: '2027-10-12', time: '', description: note, albumId: '' }
    ],
    staff: [],
    classes: [],
    students: []
  };
  const clone = (v) => JSON.parse(JSON.stringify(v));

  function docRef(key) {
    if (PUBLIC_KEYS.includes(key)) return fs.collection('site').doc(key);
    if (PRIVATE_KEYS.includes(key)) return fs.collection('private').doc(key);
    return null;
  }

  async function init() {
    try {
      if (!window.firebase || !window.FIREBASE_CONFIG) throw new Error('Firebase não carregou');
      const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.FIREBASE_CONFIG);
      fs = app.firestore();
      storage = app.storage();
      auth = app.auth();
      await new Promise((resolve) => {
        let first = true;
        auth.onAuthStateChanged((u) => {
          if (!u) PRIVATE_KEYS.forEach((k) => cache.delete(k));
          authListeners.forEach((fn) => { try { fn(u); } catch (e) { console.error(e); } });
          if (first) { first = false; resolve(); }
        });
      });
      ready = true;
    } catch (e) {
      console.error(e);
    }
  }

  async function get(key, fallback) {
    if (cache.has(key) && !(failed.has(key) && isAdmin())) return clone(cache.get(key));
    const def = DEFAULTS[key] !== undefined ? DEFAULTS[key] : fallback;
    const ref = ready && docRef(key);
    if (!ref) return clone(def === undefined ? null : def);
    if (PRIVATE_KEYS.includes(key) && !isAdmin()) return clone(def);
    try {
      const snap = await Promise.race([ref.get(), new Promise((_, rej) => setTimeout(() => rej(new Error('demorou demais')), 7000))]);
      const v = snap.exists ? (snap.data().items || []) : def;
      cache.set(key, v);
      failed.delete(key);
      return clone(v);
    } catch (e) {
      console.warn('Falha ao ler', key, e);
      cache.set(key, def);
      failed.add(key);
      return clone(def);
    }
  }

  async function set(key, value) {
    const ref = ready && docRef(key);
    if (!ref) throw new Error('Sem conexão com o Firebase');
    if (!isAdmin()) throw new Error('Entre como administrador para salvar');
    // nunca salvar por cima de dados que não conseguimos ler (evita apagar o que já existe)
    if (failed.has(key)) { await get(key); throw new Error('Os dados não tinham carregado. Tente de novo.'); }
    await ref.set({ items: value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    cache.set(key, clone(value));
  }

  /* ---------- Fotos e vídeos ---------- */
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

  /** Envia a foto ou o vídeo para o Firebase Storage e devolve o endereço público. */
  async function saveUpload(file, maxPx, onProgress) {
    if (!ready || !isAdmin()) throw new Error('Entre como administrador para enviar arquivos');
    const isVideo = file.type.startsWith('video/');
    const blob = isVideo ? file : await shrinkImage(file, maxPx);
    const ext = isVideo ? ((file.name.split('.').pop() || 'mp4').toLowerCase()) : 'jpg';
    const ref = storage.ref('media/' + uid('m') + '.' + ext);
    const task = ref.put(blob, { contentType: isVideo ? (file.type || 'video/mp4') : 'image/jpeg', cacheControl: 'public,max-age=31536000' });
    if (onProgress) task.on('state_changed', (s) => onProgress(s.bytesTransferred / (s.totalBytes || 1)));
    await task;
    const src = await ref.getDownloadURL();
    return { src, type: isVideo ? 'video' : 'image' };
  }

  async function delMedia(src) {
    if (!src || !ready || !/firebasestorage|storage\.googleapis/.test(src)) return;
    try { await storage.refFromURL(src).delete(); } catch (e) { console.warn('Não apaguei o arquivo', e); }
  }

  async function url(src) { return src || ''; }

  async function hydrate(root) {
    (root || document).querySelectorAll('[data-src]').forEach((el) => {
      const u = el.getAttribute('data-src');
      if (u) el.src = u;
      el.removeAttribute('data-src');
    });
  }

  /* ---------- Login ---------- */
  function isAdmin() { return !!(auth && auth.currentUser); }
  function adminEmail() { return auth && auth.currentUser ? auth.currentUser.email : ''; }
  async function login(email, pass) { await auth.signInWithEmailAndPassword(email, pass); }
  async function logout() { if (auth) await auth.signOut(); }
  async function sendReset(email) { await auth.sendPasswordResetEmail(email); }
  async function changePassword(oldPass, newPass) {
    const u = auth.currentUser;
    const cred = firebase.auth.EmailAuthProvider.credential(u.email, oldPass);
    await u.reauthenticateWithCredential(cred);
    await u.updatePassword(newPass);
  }
  function onAuth(fn) { authListeners.push(fn); if (ready) fn(auth.currentUser); }

  window.JE = window.JE || {};
  window.JE.db = {
    init, get, set, uid, url, hydrate, saveUpload, delMedia,
    isAdmin, adminEmail, login, logout, sendReset, changePassword, onAuth,
    isOnline: () => ready
  };
})();
