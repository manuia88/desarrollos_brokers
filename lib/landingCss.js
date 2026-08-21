// Estilos de las landings (home + sub-landings por perfil). Prefijo lp- para no chocar con el portal.
// Tema CLARO con verde lima predominante, scoped a .lp-page (el portal sigue en su tema oscuro).
export const LANDING_CSS = `
.lp-page{
  --bg:#09090D; --panel:#181820; --panel2:#20202B; --line:#31313E;
  --ink:#F6F6F8; --sub:#A8A8B6; --dim:#84848F;
  --mag:#FF1E7A; --mag-soft:rgba(255,30,122,.14); --mag-line:rgba(255,30,122,.42);
  --lime:#C6FF3A; --lime-ink:#0A0A0C; --lime-strong:#C6FF3A;
  --lime-soft:rgba(198,255,58,.13); --lime-line:rgba(198,255,58,.42);
  --r:16px; --ease:cubic-bezier(.22,1,.36,1);
  --sh:0 1px 0 rgba(255,255,255,.05) inset,0 12px 30px rgba(0,0,0,.55);
  min-height:100vh; color:var(--ink); background:#09090D;
  background-image:radial-gradient(940px 500px at 84% -10%,rgba(198,255,58,.11),transparent 60%),radial-gradient(700px 380px at -6% -3%,rgba(255,30,122,.09),transparent 55%);
}
.lp-wrap{max-width:1160px;margin:0 auto;padding:0 1.25rem}
.lp-mag{color:var(--mag)}.lp-lime{color:var(--lime-strong)}

.lp-top{position:sticky;top:0;z-index:30;backdrop-filter:blur(14px);background:rgba(10,10,14,.72);border-bottom:1px solid var(--line)}
.lp-top-in{max-width:1160px;margin:0 auto;padding:.85rem 1.25rem;display:flex;align-items:center;gap:.75rem}
.lp-logo{display:flex;align-items:center;gap:.55rem;font-weight:800;color:var(--ink);text-decoration:none}
.lp-logo b{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#C6FF3A,#8FE000);display:grid;place-items:center;color:#14200A;font-size:.85rem}
.lp-nav{margin-left:auto;display:flex;gap:.4rem;align-items:center}
.lp-nav a{color:var(--sub);font-weight:600;font-size:.9rem;padding:.5rem .8rem;border-radius:10px}
.lp-nav a:hover{color:var(--ink);background:rgba(255,255,255,.06)}
.lp-nav-hide{display:inline-flex}
@media(max-width:640px){.lp-nav-hide{display:none}}

.lp-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.8rem 1.2rem;border-radius:12px;font-weight:700;border:1px solid transparent;cursor:pointer;transition:transform .15s var(--ease),filter .15s,box-shadow .15s;font-size:.95rem}
.lp-btn:active{transform:scale(.97)}
.lp-btn-mag{background:var(--mag);color:#fff}
.lp-btn-mag:hover{filter:brightness(1.06)}
.lp-btn-lime{background:var(--lime);color:var(--lime-ink);box-shadow:0 6px 18px rgba(160,220,20,.35)}
.lp-btn-lime:hover{filter:brightness(1.04)}
.lp-btn-cyan{background:#22D3EE;color:#062a33}
.lp-btn-cyan:hover{filter:brightness(1.05)}
.lp-btn-amber{background:#F5A524;color:#3a2503}
.lp-btn-amber:hover{filter:brightness(1.05)}
.lp-btn-ghost{background:var(--panel);border-color:var(--line);color:var(--ink)}
.lp-btn-ghost:hover{border-color:var(--lime-line);background:var(--lime-soft)}

.lp-back{display:inline-flex;align-items:center;gap:.4rem;color:var(--sub);font-size:.9rem;font-weight:600;margin-bottom:1rem}
.lp-back:hover{color:var(--lime-strong)}

.lp-hero{padding:3.5rem 0 2rem;max-width:880px}
.lp-eyebrow{font-size:.74rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--lime-strong)}
.lp-hero h1{font-size:clamp(2.1rem,5.6vw,3.6rem);font-weight:850;letter-spacing:-.025em;line-height:1.06;margin:1rem 0;color:var(--ink)}
.lp-hero p{color:var(--sub);max-width:62ch;font-size:1.12rem}
.lp-cta{display:flex;gap:.7rem;flex-wrap:wrap;margin-top:1.9rem}
.lp-micro{margin-top:.9rem;color:var(--dim);font-size:.82rem}
.lp-stats{display:flex;gap:2.6rem;flex-wrap:wrap;margin-top:2.4rem;padding:1.5rem 0;border-top:1px solid var(--line)}
.lp-stats b{font-size:1.3rem;font-weight:800;display:block;letter-spacing:-.01em;color:var(--ink)}
.lp-stats span{color:var(--dim);font-size:.82rem}

.lp-sect{padding:3.2rem 0;border-top:1px solid var(--line)}
.lp-seyebrow{font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--lime-strong)}
.lp-sect h2{font-size:clamp(1.6rem,4vw,2.3rem);font-weight:820;letter-spacing:-.02em;margin:.6rem 0 .5rem;max-width:24ch;color:var(--ink)}
.lp-lead{color:var(--sub);max-width:64ch;font-size:1.04rem}

.lp-whatis{background:linear-gradient(180deg,var(--lime-soft),transparent);border:1px solid var(--lime-line);border-radius:20px;padding:2rem;margin-top:.4rem;box-shadow:var(--sh)}
.lp-whatis p{font-size:1.12rem;color:var(--ink);max-width:72ch}
.lp-whatis p b{color:var(--lime-strong)}

.lp-pillars{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;margin-top:1.8rem}
.lp-pcard{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:1.4rem;box-shadow:var(--sh)}
.lp-ic{width:44px;height:44px;border-radius:12px;background:var(--lime-soft);border:1px solid var(--lime-line);display:grid;place-items:center;font-size:1.3rem;margin-bottom:.9rem}
.lp-pcard h3{font-size:1.1rem;margin-bottom:.35rem;line-height:1.25;color:var(--ink)}
.lp-pcard p{color:var(--sub);font-size:.92rem}

.lp-mods{display:flex;flex-direction:column;gap:1rem;margin-top:1.8rem}
.lp-mod{display:grid;grid-template-columns:1.15fr 1fr;gap:1.6rem;background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:1.7rem 1.9rem;align-items:center;box-shadow:var(--sh)}
.lp-mod:nth-child(even){grid-template-columns:1fr 1.15fr}
.lp-mod:nth-child(even) .lp-mod-txt{order:2}
.lp-mtag{display:inline-flex;align-items:center;gap:.45rem;font-size:.74rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--lime-strong);margin-bottom:.55rem}
.lp-beta{font-size:.62rem;color:var(--lime-strong);background:var(--lime-soft);border:1px solid var(--lime-line);padding:.05rem .4rem;border-radius:99px;letter-spacing:.02em;text-transform:none}
.lp-mod h3{font-size:1.3rem;letter-spacing:-.015em;margin-bottom:.9rem;line-height:1.15;color:var(--ink)}
.lp-mod ul{list-style:none;display:flex;flex-direction:column;gap:.7rem}
.lp-mod li{display:flex;gap:.6rem;align-items:flex-start;color:var(--sub);font-size:.94rem;line-height:1.5}
.lp-mod li i{flex:none;width:20px;height:20px;border-radius:6px;background:var(--lime-soft);border:1px solid var(--lime-line);color:var(--lime-strong);display:grid;place-items:center;font-size:.7rem;font-style:normal;margin-top:.15rem;font-weight:800}
.lp-mod li span{flex:1;min-width:0}
.lp-mod li b{color:var(--ink);font-weight:700}
.lp-mart{background:linear-gradient(160deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:14px;min-height:200px;display:grid;place-items:center;position:relative;overflow:hidden}
.lp-glyph{font-size:3.6rem;opacity:.95;position:relative;z-index:1}
.lp-mart::after{content:'';position:absolute;inset:0;background:radial-gradient(300px 160px at 70% 20%,rgba(198,255,58,.16),transparent 70%)}

.lp-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin-top:1.8rem;counter-reset:s}
.lp-step{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:1.4rem;position:relative;box-shadow:var(--sh)}
.lp-step::before{counter-increment:s;content:counter(s);position:absolute;top:1.1rem;right:1.3rem;font-size:2.4rem;font-weight:850;color:var(--lime);opacity:.55;font-variant-numeric:tabular-nums}
.lp-step h3{font-size:1.06rem;margin-bottom:.35rem;max-width:82%;line-height:1.25;color:var(--ink)}
.lp-step p{color:var(--sub);font-size:.9rem}

.lp-who{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;margin-top:1.8rem}
.lp-wcard{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:1.4rem;border-top:3px solid var(--lime-strong);box-shadow:var(--sh)}
.lp-wcard:nth-child(2){border-top-color:var(--mag)}
.lp-wcard:nth-child(3){border-top-color:#22D3EE}
.lp-wcard h3{font-size:1.1rem;margin-bottom:.35rem;color:var(--ink)}
.lp-wcard p{color:var(--sub);font-size:.92rem}

.lp-band{background:linear-gradient(180deg,var(--panel),var(--bg));border:1px solid var(--line);border-radius:20px;padding:2rem;margin-top:.4rem;display:flex;gap:2.6rem;flex-wrap:wrap;justify-content:space-around;text-align:center;box-shadow:var(--sh)}
.lp-band div b{font-size:1.5rem;font-weight:850;display:block;letter-spacing:-.01em;color:var(--ink)}
.lp-band div span{color:var(--dim);font-size:.85rem}

.lp-vs{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1.8rem}
.lp-vscard{border:1px solid var(--line);border-radius:18px;padding:1.6rem;box-shadow:var(--sh)}
.lp-vscard.bad{background:var(--panel)}
.lp-vscard.good{border-color:var(--lime-line);background:linear-gradient(180deg,var(--lime-soft),transparent)}
.lp-vscard h3{font-size:1.02rem;margin-bottom:1rem;display:flex;align-items:center;gap:.5rem;color:var(--ink)}
.lp-vscard.bad h3{color:var(--dim)}
.lp-vscard ul{list-style:none;display:flex;flex-direction:column;gap:.75rem}
.lp-vscard li{display:flex;gap:.6rem;align-items:flex-start;color:var(--sub);font-size:.93rem;line-height:1.45}
.lp-vscard li i{flex:none;width:20px;height:20px;border-radius:6px;display:grid;place-items:center;font-size:.72rem;font-style:normal;font-weight:800;margin-top:.08rem}
.lp-vscard.bad li i{background:rgba(255,90,90,.13);border:1px solid rgba(255,90,90,.34);color:#ff7a7a}
.lp-vscard.good li i{background:var(--lime-soft);border:1px solid var(--lime-line);color:var(--lime-strong)}
.lp-vscard.good li b{color:var(--ink);font-weight:700}
@media(max-width:720px){.lp-vs{grid-template-columns:1fr}}

.lp-faq{margin-top:1.6rem;border-top:1px solid var(--line)}
.lp-faq details{border-bottom:1px solid var(--line)}
.lp-faq summary{cursor:pointer;font-weight:700;font-size:1.02rem;padding:1.1rem 0;list-style:none;display:flex;justify-content:space-between;gap:1rem;align-items:center;color:var(--ink)}
.lp-faq summary::-webkit-details-marker{display:none}
.lp-faq summary::after{content:'+';color:var(--lime-strong);font-size:1.4rem;font-weight:400;flex:none}
.lp-faq details[open] summary::after{content:'\\2013'}
.lp-faq details p{color:var(--sub);padding:0 0 1.1rem;max-width:75ch}

.lp-final{text-align:center;background:linear-gradient(180deg,var(--lime-soft),transparent);border:1px solid var(--lime-line);border-radius:24px;padding:3rem 1.5rem;margin:1rem 0;box-shadow:var(--sh)}
.lp-final h2{font-size:clamp(1.7rem,4vw,2.5rem);letter-spacing:-.02em;margin-bottom:.6rem;color:var(--ink)}
.lp-final p{color:var(--sub);max-width:56ch;margin:0 auto 1.6rem}
.lp-final .lp-cta{justify-content:center}
.lp-final .lp-micro{text-align:center}

.lp-foot{border-top:1px solid var(--line);padding:2.2rem 0 3rem;color:var(--dim);font-size:.86rem;display:flex;gap:1rem;flex-wrap:wrap;justify-content:space-between;align-items:center}
.lp-fl{display:flex;gap:1.2rem;flex-wrap:wrap}
.lp-fl a{color:var(--sub)}
.lp-fl a:hover{color:var(--lime-strong)}

@media(max-width:720px){
  .lp-mod{grid-template-columns:1fr}
  .lp-mod:nth-child(even) .lp-mod-txt{order:0}
  .lp-mart{min-height:130px;order:-1}
  .lp-stats{gap:1.6rem}
  .lp-band{gap:1.6rem}
}
`;
