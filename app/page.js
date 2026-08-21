import Link from 'next/link';

// Landing DesarrollosMX. Estilos autocontenidos con prefijo lp- para no chocar con el resto del portal.
const CSS = `
.lp-wrap{max-width:1160px;margin:0 auto;padding:0 1.25rem}
.lp-mag{color:var(--mag)}.lp-lime{color:var(--lime)}

.lp-top{position:sticky;top:0;z-index:30;backdrop-filter:blur(14px);background:rgba(10,10,12,.72);border-bottom:1px solid var(--line)}
.lp-top-in{max-width:1160px;margin:0 auto;padding:.85rem 1.25rem;display:flex;align-items:center;gap:.75rem}
.lp-logo{display:flex;align-items:center;gap:.55rem;font-weight:800;color:var(--ink)}
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

.lp-hero{padding:4.5rem 0 2rem;max-width:880px}
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

export default function Landing() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="lp-top">
        <div className="lp-top-in">
          <span className="lp-logo"><b>D</b>DesarrollosMX</span>
          <nav className="lp-nav">
            <a className="lp-nav-hide" href="#modulos">Qué te llevas</a>
            <a className="lp-nav-hide" href="#como">Cómo funciona</a>
            <a className="lp-nav-hide" href="#faq">Preguntas</a>
            <Link href="/login">Iniciar sesión</Link>
            <Link href="/registro" className="lp-btn lp-btn-mag" style={{ padding: '.55rem .9rem' }}>Crear cuenta</Link>
          </nav>
        </div>
      </header>

      <main className="lp-wrap">

        {/* HERO */}
        <section className="lp-hero">
          <span className="lp-eyebrow">Para inmobiliarias y brokers</span>
          <h1>DesarrollosMX: vende <span className="lp-mag">más departamentos</span>, con menos vueltas<span className="lp-lime">.</span></h1>
          <p>Inventario en vivo, cotizador con crédito, CRM y comisiones en una sola plataforma.
             Tú vendes; nosotros ponemos el catálogo y las herramientas para que cierres más rápido.</p>
          <div className="lp-cta">
            <Link href="/registro" className="lp-btn lp-btn-mag">Crear cuenta gratis</Link>
            <Link href="/registro" className="lp-btn lp-btn-lime">Soy broker independiente</Link>
            <Link href="/login" className="lp-btn lp-btn-ghost">Ya tengo cuenta</Link>
          </div>
          <div className="lp-micro">Sin instalar nada · listo en minutos · desde el navegador</div>
          <div className="lp-stats">
            <div><b>Sin inventario propio</b><span>El desarrollador lo pone</span></div>
            <div><b className="lp-lime">Con tu marca</b><span>Fichas y propuestas white-label</span></div>
            <div><b>Todo-en-uno</b><span>Catálogo, CRM y comisiones</span></div>
            <div><b>Aislado</b><span>Tus clientes, sólo tuyos</span></div>
          </div>
        </section>

        {/* PROBLEMA / QUÉ ES */}
        <section className="lp-sect" id="quees">
          <span className="lp-seyebrow">Por qué existe</span>
          <h2>Vender un depa no debería costarte 5 apps y medio día</h2>
          <div className="lp-whatis">
            <p>Entre buscar disponibilidad, armar la cotización a mano, mandar PDFs por WhatsApp y anotar
              prospectos donde se pueda, se te va el tiempo… y las ventas. <b>DesarrollosMX junta todo en un
              solo lugar</b>: inventario al día, cotizador, CRM y comisiones. Menos vueltas, más cierres.</p>
          </div>
        </section>

        {/* PILARES */}
        <section className="lp-sect" id="pilares">
          <span className="lp-seyebrow">Lo que te frena, resuelto</span>
          <h2>Cuatro obstáculos que te quitamos de encima</h2>
          <p className="lp-lead">De la primera búsqueda a la comisión cobrada, cada etapa cubierta.</p>
          <div className="lp-pillars">
            <div className="lp-pcard"><div className="lp-ic">🏢</div><h3>Encuentra el depa ideal en segundos</h3><p>Inventario en vivo y un buscador que, con el perfil de tu cliente, te dice qué le queda. Deja de mandar opciones que no aplican.</p></div>
            <div className="lp-pcard"><div className="lp-ic">🗂️</div><h3>Que no se te caiga ni un prospecto</h3><p>Pipeline, recordatorios de cita y protección de cliente. Sabes a quién seguir hoy — y nadie te quita tu prospecto.</p></div>
            <div className="lp-pcard"><div className="lp-ic">⚡</div><h3>Cotiza y manda propuesta en 2 minutos</h3><p>Enganche, mensualidades y crédito al instante, con tu marca, listo para WhatsApp. Mientras otros arman el Excel, tú ya mandaste.</p></div>
            <div className="lp-pcard"><div className="lp-ic">💰</div><h3>Cobra sin pelear con nadie</h3><p>Comisión calculada automática y estado de cuenta claro por asesor. Sabes cuánto ganas y cuándo, sin discusiones.</p></div>
          </div>
        </section>

        {/* MÓDULOS */}
        <section className="lp-sect" id="modulos">
          <span className="lp-seyebrow">Qué te llevas</span>
          <h2>Lo que hace por ti, en concreto</h2>
          <p className="lp-lead">Cada pieza traduce en una venta más fácil. Todo se siente un solo producto.</p>
          <div className="lp-mods">

            <article className="lp-mod">
              <div className="lp-mod-txt">
                <div className="lp-mtag">🏢 Catálogo y ficha</div>
                <h3>Nunca vendas un depa que ya no existe</h3>
                <ul>
                  <li><i>✓</i><span>Disponibilidad y precios al día — <b>no ofreces algo ya vendido ni un precio viejo.</b></span></li>
                  <li><i>✓</i><span>Ficha completa: m², recámaras, créditos, plano y ubicación — <b>respondes cualquier duda sin llamar a nadie.</b></span></li>
                  <li><i>✓</i><span>Buscador por perfil del cliente — <b>dejas de perder tiempo con opciones que no aplican.</b></span></li>
                </ul>
              </div>
              <div className="lp-mart"><span className="lp-glyph">🏙️</span></div>
            </article>

            <article className="lp-mod">
              <div className="lp-mod-txt">
                <div className="lp-mtag">🗂️ CRM del broker</div>
                <h3>Ningún prospecto se te vuelve a caer</h3>
                <ul>
                  <li><i>✓</i><span>Pipeline con temperatura (caliente/tibio/frío) — <b>sabes a quién llamar hoy.</b></span></li>
                  <li><i>✓</i><span>Recordatorios automáticos de cita — <b>menos “se me olvidó”, menos plantones.</b></span></li>
                  <li><i>✓</i><span>Protección de cliente — <b>tu prospecto es tuyo; nadie te lo gana.</b></span></li>
                </ul>
              </div>
              <div className="lp-mart"><span className="lp-glyph">👥</span></div>
            </article>

            <article className="lp-mod">
              <div className="lp-mod-txt">
                <div className="lp-mtag">🧮 Cotizador y propuesta <span className="lp-beta">beta</span></div>
                <h3>Del “déjame ver” al “sí” antes de que se enfríe</h3>
                <ul>
                  <li><i>✓</i><span>Enganche, mensualidades y esquema al instante — <b>cotizas frente al cliente, no al día siguiente.</b></span></li>
                  <li><i>✓</i><span>Crédito Infonavit / FOVISSSTE / bancario incluido — <b>resuelves la duda que más frena la compra.</b></span></li>
                  <li><i>✓</i><span>Propuesta y brochure con tu logo, listos para WhatsApp — <b>te ves como una firma grande.</b></span></li>
                </ul>
              </div>
              <div className="lp-mart"><span className="lp-glyph">🧮</span></div>
            </article>

            <article className="lp-mod">
              <div className="lp-mod-txt">
                <div className="lp-mtag">🤖 IA y WhatsApp <span className="lp-beta">beta</span></div>
                <h3>Como tener un asistente que nunca duerme</h3>
                <ul>
                  <li><i>✓</i><span>Copiloto que redacta y sugiere el siguiente paso — <b>respondes en segundos y mejor.</b></span></li>
                  <li><i>✓</i><span>Concierge que atiende a tu cliente 24/7 en la ficha — <b>no pierdes al que llega a medianoche.</b></span></li>
                  <li><i>✓</i><span>Briefing antes de cada cita — <b>llegas sabiendo qué le importa a tu cliente.</b></span></li>
                </ul>
              </div>
              <div className="lp-mart"><span className="lp-glyph">🤖</span></div>
            </article>

            <article className="lp-mod">
              <div className="lp-mod-txt">
                <div className="lp-mtag">💰 Comisiones y escrituración <span className="lp-beta">beta</span></div>
                <h3>Ve cuánto ganas — sin sorpresas ni discusiones</h3>
                <ul>
                  <li><i>✓</i><span>Comisión calculada automática por venta — <b>cero cálculos a mano.</b></span></li>
                  <li><i>✓</i><span>Estado de cuenta por inmobiliaria y asesor — <b>claridad de quién cobra qué.</b></span></li>
                  <li><i>✓</i><span>Seguimiento de escrituración — <b>ningún cierre se queda a medias.</b></span></li>
                </ul>
              </div>
              <div className="lp-mart"><span className="lp-glyph">💰</span></div>
            </article>

            <article className="lp-mod">
              <div className="lp-mod-txt">
                <div className="lp-mtag">🔒 Seguridad</div>
                <h3>Tu cartera es tuya — y punto</h3>
                <ul>
                  <li><i>✓</i><span>Cada inmobiliaria aislada a nivel base de datos — <b>nadie ve tus clientes.</b></span></li>
                  <li><i>✓</i><span>Jamás compartes prospectos con otra inmobiliaria.</span></li>
                  <li><i>✓</i><span>Seguridad auditada, sin hallazgos críticos — <b>duermes tranquilo.</b></span></li>
                </ul>
              </div>
              <div className="lp-mart"><span className="lp-glyph">🔒</span></div>
            </article>

          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section className="lp-sect" id="como">
          <span className="lp-seyebrow">Cómo funciona</span>
          <h2>Cuatro pasos, sin instalar nada</h2>
          <div className="lp-steps">
            <div className="lp-step"><h3>Crea tu cuenta</h3><p>Tu inmobiliaria o como broker independiente. Listo en minutos, desde el navegador.</p></div>
            <div className="lp-step"><h3>Encuentra lo que busca tu cliente</h3><p>Filtra por zona, precio, entrega y crédito. El inventario ya está cargado y al día.</p></div>
            <div className="lp-step"><h3>Cotiza y manda propuesta</h3><p>Con tu marca, por WhatsApp, en un par de clics.</p></div>
            <div className="lp-step"><h3>Da seguimiento y cobra</h3><p>Mueve el pipeline, cierra la venta y ve tu comisión clara.</p></div>
          </div>
        </section>

        {/* PARA QUIÉN */}
        <section className="lp-sect" id="paraquien">
          <span className="lp-seyebrow">Para quién es</span>
          <h2>Hecho para quien vive de cerrar ventas</h2>
          <div className="lp-who">
            <div className="lp-wcard"><h3>Inmobiliarias</h3><p>Todo tu equipo en una plataforma: cada asesor con su cartera, tú con la foto completa del negocio.</p></div>
            <div className="lp-wcard"><h3>Brokers independientes</h3><p>Vende como si tuvieras un corporativo detrás: inventario, herramientas y marca — sin nómina ni oficina.</p></div>
            <div className="lp-wcard"><h3>Desarrolladores</h3><p>Pon tu inventario frente a decenas de brokers listos para venderlo, sin montar equipo comercial.</p></div>
          </div>
        </section>

        {/* DIFERENCIADORES */}
        <section className="lp-sect" id="porque">
          <span className="lp-seyebrow">Por qué DesarrollosMX</span>
          <h2>Un solo lugar, de principio a fin</h2>
          <div className="lp-band">
            <div><b>En vivo</b><span>Inventario siempre al día</span></div>
            <div><b className="lp-lime">Más rápido</b><span>Del contacto a la comisión</span></div>
            <div><b>Seguro</b><span>Auditado, sin fugas de datos</span></div>
            <div><b>Escalable</b><span>De un asesor a cien</span></div>
          </div>
        </section>

        {/* FAQ */}
        <section className="lp-sect" id="faq">
          <span className="lp-seyebrow">Preguntas frecuentes</span>
          <h2>Lo que seguro te preguntas</h2>
          <div className="lp-faq">
            <details open><summary>¿Y si no tengo inventario propio?</summary>
              <p>No lo necesitas. El inventario lo ponen los desarrolladores y te llega actualizado. Tú te dedicas a vender; nosotros ponemos el catálogo y las herramientas.</p></details>
            <details><summary>¿Tengo que instalar o configurar algo?</summary>
              <p>No. Entras desde el navegador, sin instalar nada y sin capacitación de horas. Creas tu cuenta y empiezas a mover inventario el mismo día.</p></details>
            <details><summary>¿Mis clientes quedan expuestos a otras inmobiliarias?</summary>
              <p>Jamás. Cada inmobiliaria está aislada por diseño a nivel de base de datos: nadie ve tu cartera ni tus prospectos. La seguridad está auditada.</p></details>
            <details><summary>¿Para quién es?</summary>
              <p>Para inmobiliarias, brokers independientes y desarrolladores: unos venden, otros publican su inventario a toda la red.</p></details>
            <details><summary>¿Cuánto cuesta?</summary>
              <p>Crear tu cuenta y explorar el inventario no tiene costo. El esquema de comisiones lo vemos contigo al darte de alta.</p></details>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="lp-final">
          <h2>Tu próxima venta empieza aquí</h2>
          <p>Crea tu cuenta y trae inventario, cotizador y CRM a un solo lugar. Empiezas a vender el mismo día.</p>
          <div className="lp-cta">
            <Link href="/registro" className="lp-btn lp-btn-mag">Crear cuenta gratis</Link>
            <Link href="/registro" className="lp-btn lp-btn-lime">Soy broker independiente</Link>
          </div>
          <div className="lp-micro">Sin instalar nada · sin tarjeta para empezar</div>
        </section>

      </main>

      <footer className="lp-foot lp-wrap">
        <span className="lp-logo"><b>D</b>DesarrollosMX · Portal de Brokers</span>
        <div className="lp-fl">
          <a href="#quees">Producto</a>
          <a href="#faq">Preguntas</a>
          <Link href="/registro">Crear cuenta</Link>
          <Link href="/login">Iniciar sesión</Link>
        </div>
      </footer>
    </>
  );
}
