// Estilos de las landings (home + sub-landings por perfil). Prefijo lp- para no chocar con el portal.
export const LANDING_CSS = `
.lp-wrap{max-width:1160px;margin:0 auto;padding:0 1.25rem}
.lp-mag{color:var(--mag)}.lp-lime{color:var(--lime)}

.lp-top{position:sticky;top:0;z-index:30;backdrop-filter:blur(14px);background:rgba(10,10,12,.72);border-bottom:1px solid var(--line)}
.lp-top-in{max-width:1160px;margin:0 auto;padding:.85rem 1.25rem;display:flex;align-items:center;gap:.75rem}
.lp-logo{display:flex;align-items:center;gap:.55rem;font-weight:800;color:var(--ink);text-decoration:none}
.lp-logo b{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,var(--mag),#FF5CA8);display:grid;place-items:center;color:#fff;font-size:.85rem}
.lp-nav{margin-left:auto;display:flex;gap:.4rem;align-items:center}
.lp-nav a{color:var(--sub);font-weight:600;font-size:.9rem;padding:.5rem .8rem;border-radius:10px}
.lp-nav a:hover{color:var(--ink);background:rgba(255,255,255,.05)}
.lp-nav-hide{display:inline-flex}
@media(max-width:640px){.lp-nav-hide{display:none}}

.lp-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.8rem 1.2rem;border-radius:12px;font-weight:700;border:1px solid transparent;cursor:pointer;transition:transform .15s var(--ease),filter .15s;font-size:.95rem}
.lp-btn:active{transform:scale(.97)}
.lp-btn-mag{background:var(--mag);color:#fff}
.lp-btn-mag:hover{filter:brightness(1.08)}
.lp-btn-lime{background:var(--lime);color:var(--lime-ink)}
.lp-btn-ghost{background:transparent;border-color:var(--line);color:var(--ink)}
.lp-btn-ghost:hover{border-color:var(--mag-line)}

.lp-back{display:inline-flex;align-items:center;gap:.4rem;color:var(--sub);font-size:.9rem;font-weight:600;margin-bottom:1rem}
.lp-back:hover{color:var(--ink)}

.lp-hero{padding:3.5rem 0 2rem;max-width:880px}
.lp-eyebrow{font-size:.74rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--mag)}
.lp-hero h1{font-size:clamp(2.1rem,5.6vw,3.6rem);font-weight:850;letter-spacing:-.025em;line-height:1.06;margin:1rem 0}
.lp-hero p{color:var(--sub);max-width:62ch;font-size:1.12rem}
.lp-cta{display:flex;gap:.7rem;flex-wrap:wrap;margin-top:1.9rem}
.lp-micro{margin-top:.9rem;color:var(--dim);font-size:.82rem}
.lp-stats{display:flex;gap:2.6rem;flex-wrap:wrap;margin-top:2.4rem;padding:1.5rem 0;border-top:1px solid var(--line)}
.lp-stats b{font-size:1.3rem;font-weight:800;display:block;letter-spacing:-.01em}
.lp-stats span{color:var(--dim);font-size:.82rem}

.lp-sect{padding:3.2rem 0;border-top:1px solid var(--line)}
.lp-seyebrow{font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--lime)}
.lp-sect h2{font-size:clamp(1.6rem,4vw,2.3rem);font-weight:820;letter-spacing:-.02em;margin:.6rem 0 .5rem;max-width:24ch}
.lp-lead{color:var(--sub);max-width:64ch;font-size:1.04rem}

.lp-whatis{background:linear-gradient(180deg,var(--mag-soft),transparent);border:1px solid var(--mag-line);border-radius:20px;padding:2rem;margin-top:.4rem}
.lp-whatis p{font-size:1.12rem;color:var(--ink);max-width:72ch}
.lp-whatis p b{color:var(--mag)}

.lp-pillars{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;margin-top:1.8rem}
.lp-pcard{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:1.4rem}
.lp-ic{width:44px;height:44px;border-radius:12px;background:var(--mag-soft);border:1px solid var(--mag-line);display:grid;place-items:center;font-size:1.3rem;margin-bottom:.9rem}
.lp-pcard h3{font-size:1.1rem;margin-bottom:.35rem;line-height:1.25}
.lp-pcard p{color:var(--sub);font-size:.92rem}

.lp-mods{display:flex;flex-direction:column;gap:1rem;margin-top:1.8rem}
.lp-mod{display:grid;grid-template-columns:1.15fr 1fr;gap:1.6rem;background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:1.7rem 1.9rem;align-items:center}
.lp-mod:nth-child(even){grid-template-columns:1fr 1.15fr}
.lp-mod:nth-child(even) .lp-mod-txt{order:2}
.lp-mtag{display:inline-flex;align-items:center;gap:.45rem;font-size:.74rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--mag);margin-bottom:.55rem}
.lp-beta{font-size:.62rem;color:var(--lime);background:var(--lime-soft);border:1px solid rgba(198,255,58,.35);padding:.05rem .4rem;border-radius:99px;letter-spacing:.02em;text-transform:none}
.lp-mod h3{font-size:1.3rem;letter-spacing:-.015em;margin-bottom:.9rem;line-height:1.15}
.lp-mod ul{list-style:none;display:flex;flex-direction:column;gap:.7rem}
.lp-mod li{display:flex;gap:.6rem;align-items:flex-start;color:var(--sub);font-size:.94rem;line-height:1.5}
.lp-mod li i{flex:none;width:20px;height:20px;border-radius:6px;background:var(--lime-soft);border:1px solid rgba(198,255,58,.35);color:var(--lime);display:grid;place-items:center;font-size:.7rem;font-style:normal;margin-top:.15rem;font-weight:800}
.lp-mod li span{flex:1;min-width:0}
.lp-mod li b{color:var(--ink);font-weight:700}
.lp-mart{background:var(--panel2);border:1px solid var(--line);border-radius:14px;min-height:200px;display:grid;place-items:center;position:relative;overflow:hidden}
.lp-glyph{font-size:3.6rem;opacity:.9}
.lp-mart::after{content:'';position:absolute;inset:0;background:radial-gradient(300px 160px at 70% 20%,rgba(255,30,122,.14),transparent 70%)}

.lp-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;margin-top:1.8rem;counter-reset:s}
.lp-step{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:1.4rem;position:relative}
.lp-step::before{counter-increment:s;content:counter(s);position:absolute;top:1.1rem;right:1.3rem;font-size:2.4rem;font-weight:850;color:var(--line);font-variant-numeric:tabular-nums}
.lp-step h3{font-size:1.06rem;margin-bottom:.35rem;max-width:82%;line-height:1.25}
.lp-step p{color:var(--sub);font-size:.9rem}

.lp-who{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;margin-top:1.8rem}
.lp-wcard{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:1.4rem;border-top:3px solid var(--mag)}
.lp-wcard:nth-child(2){border-top-color:var(--lime)}
.lp-wcard:nth-child(3){border-top-color:#8fbcff}
.lp-wcard h3{font-size:1.1rem;margin-bottom:.35rem}
.lp-wcard p{color:var(--sub);font-size:.92rem}

.lp-band{background:linear-gradient(180deg,var(--panel),var(--bg));border:1px solid var(--line);border-radius:20px;padding:2rem;margin-top:.4rem;display:flex;gap:2.6rem;flex-wrap:wrap;justify-content:space-around;text-align:center}
.lp-band div b{font-size:1.5rem;font-weight:850;display:block;letter-spacing:-.01em}
.lp-band div span{color:var(--dim);font-size:.85rem}

.lp-faq{margin-top:1.6rem;border-top:1px solid var(--line)}
.lp-faq details{border-bottom:1px solid var(--line)}
.lp-faq summary{cursor:pointer;font-weight:700;font-size:1.02rem;padding:1.1rem 0;list-style:none;display:flex;justify-content:space-between;gap:1rem;align-items:center}
.lp-faq summary::-webkit-details-marker{display:none}
.lp-faq summary::after{content:'+';color:var(--mag);font-size:1.4rem;font-weight:400;flex:none}
.lp-faq details[open] summary::after{content:'\\2013'}
.lp-faq details p{color:var(--sub);padding:0 0 1.1rem;max-width:75ch}

.lp-final{text-align:center;background:linear-gradient(180deg,var(--mag-soft),transparent);border:1px solid var(--mag-line);border-radius:24px;padding:3rem 1.5rem;margin:1rem 0}
.lp-final h2{font-size:clamp(1.7rem,4vw,2.5rem);letter-spacing:-.02em;margin-bottom:.6rem}
.lp-final p{color:var(--sub);max-width:56ch;margin:0 auto 1.6rem}
.lp-final .lp-cta{justify-content:center}
.lp-final .lp-micro{text-align:center}

.lp-foot{border-top:1px solid var(--line);padding:2.2rem 0 3rem;color:var(--dim);font-size:.86rem;display:flex;gap:1rem;flex-wrap:wrap;justify-content:space-between;align-items:center}
.lp-fl{display:flex;gap:1.2rem;flex-wrap:wrap}
.lp-fl a{color:var(--sub)}

@media(max-width:720px){
  .lp-mod{grid-template-columns:1fr}
  .lp-mod:nth-child(even) .lp-mod-txt{order:0}
  .lp-mart{min-height:130px;order:-1}
  .lp-stats{gap:1.6rem}
  .lp-band{gap:1.6rem}
}
`;
