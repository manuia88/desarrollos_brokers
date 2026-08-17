// Envíos server-side. Si falta el proveedor (env), simplemente no envía.

function digits(s) { return String(s || '').replace(/[^0-9]/g, ''); }
function e164Mx(tel) { const d = digits(tel); if (!d) return null; return '+' + (d.length === 10 ? '52' + d : d); }

export async function sendWhatsApp(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_WHATSAPP_FROM;
  const num = e164Mx(to);
  if (!sid || !tok || !from || !num) return false;
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(sid + ':' + tok).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: from.startsWith('whatsapp:') ? from : ('whatsapp:' + from), To: 'whatsapp:' + num, Body: body }),
    });
    return r.ok;
  } catch { return false; }
}

export async function sendEmail(to, subject, html) {
  const key = process.env.RESEND_API_KEY, from = process.env.RESEND_FROM || 'Quiero Casa <onboarding@resend.dev>';
  if (!key || !to) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return r.ok;
  } catch { return false; }
}
