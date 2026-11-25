/* Pré-matrícula: monta a mensagem e abre o WhatsApp da escola com ela pronta. */
(function () {
  const WHATS = '5591992579446';
  const form = document.getElementById('pmForm');
  if (!form) return;
  const err = document.getElementById('pmErr');
  const v = (id) => document.getElementById(id).value.trim();
  const showErr = (msg, el) => { err.textContent = msg; err.hidden = false; if (el) el.focus(); };

  form.addEventListener('input', () => { err.hidden = true; });
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const resp = v('pmResp'), crianca = v('pmCrianca'), whats = v('pmWhats'), email = v('pmEmail');
    if (!resp) return showErr('Preencha o nome do responsável.', form.pmResp || document.getElementById('pmResp'));
    if (!crianca) return showErr('Preencha o nome e a idade da criança.', document.getElementById('pmCrianca'));
    if (whats.replace(/\D/g, '').length < 10) return showErr('Digite o WhatsApp com DDD, por exemplo (91) 99999-9999.', document.getElementById('pmWhats'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr('Digite um e-mail válido.', document.getElementById('pmEmail'));
    if (!document.getElementById('pmOk').checked) return showErr('Marque a caixinha de concordância para enviar.', document.getElementById('pmOk'));

    const msg = [
      '*Pré-Matrícula 2027 - Jardim Encantado*',
      '',
      '*Responsável:* ' + resp,
      '*Criança (nome/idade):* ' + crianca,
      '*WhatsApp:* ' + whats,
      '*E-mail:* ' + email,
      '',
      'Enviado pelo site.'
    ].join('\n');
    const url = 'https://wa.me/' + WHATS + '?text=' + encodeURIComponent(msg);
    const w = window.open(url, '_blank', 'noopener');
    if (!w) location.href = url;
    form.reset();
    err.hidden = true;
  });
})();
