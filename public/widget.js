/* Widget del Asesor Digital — pega en cualquier sitio:
   <script src="https://TU-DOMINIO/widget.js" data-org="UUID-DE-TU-INMOBILIARIA" defer></script> */
(function () {
  var s = document.currentScript; if (!s) return;
  var org = s.getAttribute('data-org'); if (!org) return;
  var base = new URL(s.src).origin;
  var btn = document.createElement('button');
  btn.textContent = '💬';
  btn.setAttribute('aria-label', 'Abrir chat');
  btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99998;width:56px;height:56px;border-radius:50%;border:none;background:#FF1E7A;color:#fff;font-size:24px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.35)';
  var frame = null, abierto = false;
  btn.onclick = function () {
    if (!frame) {
      frame = document.createElement('iframe');
      frame.src = base + '/w/' + org;
      frame.title = 'Asistente';
      frame.style.cssText = 'position:fixed;bottom:88px;right:20px;z-index:99999;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100vh - 120px));border:1px solid rgba(255,255,255,.15);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.5);display:none;background:#0A0B0F';
      document.body.appendChild(frame);
    }
    abierto = !abierto;
    frame.style.display = abierto ? 'block' : 'none';
    btn.textContent = abierto ? '✕' : '💬';
  };
  document.body.appendChild(btn);
})();
