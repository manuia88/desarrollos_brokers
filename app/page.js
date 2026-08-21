import Link from 'next/link';
import { LANDING_CSS } from '../lib/landingCss';

export default function Landing() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

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
            <Link href="/para/inmobiliarias" className="lp-btn lp-btn-mag">Soy inmobiliaria</Link>
            <Link href="/para/brokers" className="lp-btn lp-btn-lime">Soy broker independiente</Link>
            <Link href="/registro?modo=unirme" className="lp-btn lp-btn-ghost">Pertenezco a una inmobiliaria</Link>
            <Link href="/para/desarrolladores" className="lp-btn lp-btn-ghost">Soy desarrollador</Link>
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
            <Link href="/para/inmobiliarias" className="lp-wcard" style={{ textDecoration: 'none', color: 'inherit' }}><h3>Inmobiliarias →</h3><p>Todo tu equipo en una plataforma: cada asesor con su cartera, tú con la foto completa del negocio.</p></Link>
            <Link href="/para/brokers" className="lp-wcard" style={{ textDecoration: 'none', color: 'inherit' }}><h3>Brokers independientes →</h3><p>Vende como si tuvieras un corporativo detrás: inventario, herramientas y marca — sin nómina ni oficina.</p></Link>
            <Link href="/para/desarrolladores" className="lp-wcard" style={{ textDecoration: 'none', color: 'inherit' }}><h3>Desarrolladores →</h3><p>Pon tu inventario frente a decenas de brokers listos para venderlo, sin montar equipo comercial.</p></Link>
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
          <p>Elige tu perfil y crea tu cuenta. Empiezas a vender el mismo día.</p>
          <div className="lp-cta">
            <Link href="/para/inmobiliarias" className="lp-btn lp-btn-mag">Soy inmobiliaria</Link>
            <Link href="/para/brokers" className="lp-btn lp-btn-lime">Soy broker independiente</Link>
            <Link href="/registro?modo=unirme" className="lp-btn lp-btn-ghost">Pertenezco a una inmobiliaria</Link>
            <Link href="/para/desarrolladores" className="lp-btn lp-btn-ghost">Soy desarrollador</Link>
          </div>
          <div className="lp-micro">¿Ya tienes cuenta? <Link href="/login" style={{ color: 'var(--lime)' }}>Inicia sesión</Link></div>
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
