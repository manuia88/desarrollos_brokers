import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LANDING_CSS } from '../../../lib/landingCss';

// Sub-landings por perfil: cada botón de la home lleva aquí y muestra los beneficios de ese rol.
const PERFILES = {
  inmobiliarias: {
    modo: 'inmobiliaria',
    eyebrow: 'Para inmobiliarias',
    h1: <>Toda tu inmobiliaria vendiendo desde <span className="lp-mag">una sola plataforma</span>.</>,
    sub: 'Inventario en vivo sin que tú lo cargues, tu equipo ordenado y tus comisiones claras. Tú diriges; nosotros ponemos catálogo, CRM y herramientas.',
    cta: 'Registrar mi inmobiliaria',
    pilares: [
      ['🏢', 'Inventario sin cargarlo tú', 'Catálogo en vivo de varios desarrolladores. Tu equipo vende sin que tú captures ni actualices nada.'],
      ['🗂️', 'Tu equipo, ordenado', 'Cada asesor con su cartera; tú ves la foto completa: quién vende, quién no, qué se está cayendo.'],
      ['🛡️', 'Sin fugas de clientes', 'Protección de cliente y aislamiento total: los prospectos de tu inmobiliaria son tuyos, de nadie más.'],
      ['💰', 'Comisiones claras por asesor', 'Estado de cuenta automático: sabes quién cobra qué y cuándo, sin discusiones ni hojas sueltas.'],
    ],
    pasos: [
      ['Registra tu inmobiliaria', 'Creas tu cuenta como director y das de alta tu inmobiliaria.'],
      ['Invita a tu equipo', 'Tus asesores se registran, eligen tu inmobiliaria y tú apruebas su ingreso.'],
      ['A vender', 'Todos con el mismo inventario, cotizador y CRM. Tú con la visión del negocio completo.'],
    ],
  },
  brokers: {
    modo: 'independiente',
    eyebrow: 'Para brokers independientes',
    h1: <>Vende como si tuvieras un <span className="lp-mag">corporativo detrás</span>.</>,
    sub: 'Inventario, cotizador, CRM y tu marca — sin nómina, sin oficina y sin cargar con inventario propio.',
    cta: 'Crear mi cuenta de broker',
    pilares: [
      ['🏙️', 'Inventario listo para vender', 'Decenas de desarrollos en vivo. Tú sólo eliges lo que le queda a tu cliente y lo muestras.'],
      ['🧮', 'Cotiza con crédito al instante', 'Enganche, mensualidades e Infonavit/FOVISSSTE frente al cliente — no al día siguiente.'],
      ['🎨', 'Con tu marca', 'Fichas y propuestas con tu logo: te ves como una firma grande aunque trabajes solo.'],
      ['📇', 'Tu CRM personal', 'Pipeline, recordatorios y seguimiento. Ningún prospecto se te vuelve a caer.'],
    ],
    pasos: [
      ['Crea tu cuenta', 'En minutos, desde el navegador, sin instalar nada.'],
      ['Explora el inventario', 'Filtra por zona, precio, entrega y crédito. Ya está cargado y al día.'],
      ['Cotiza, comparte y cierra', 'Manda la propuesta con tu marca por WhatsApp y cobra tu comisión.'],
    ],
  },
  desarrolladores: {
    modo: 'desarrollador',
    eyebrow: 'Para desarrolladores',
    h1: <>Pon tu inventario frente a <span className="lp-mag">decenas de brokers</span> listos para vender.</>,
    sub: 'Publica tus desarrollos a toda la red y recibe prospectos calificados — sin montar un equipo comercial propio.',
    cta: 'Registrar mi desarrolladora',
    pilares: [
      ['📢', 'Alcance inmediato', 'Tu inventario visible para inmobiliarias y brokers de toda la red, desde el día uno.'],
      ['🎯', 'Prospectos calificados', 'Los brokers te traen clientes listos. Tú te enfocas en construir y en vender.'],
      ['🗂️', 'Tú controlas tu inventario', 'Administras desarrollos, precios y disponibilidad; se sincroniza en vivo con el portal.'],
      ['📄', 'Fichas y planos centralizados', 'Un solo lugar con la info correcta: nadie vende con datos ni precios viejos.'],
    ],
    pasos: [
      ['Registra tu desarrolladora', 'Creas tu cuenta y das de alta tu empresa.'],
      ['Carga tu inventario', 'Subes o sincronizas tus desarrollos, precios y disponibilidad.'],
      ['Recibe prospectos', 'La red de brokers empieza a mover tu inventario y a traerte clientes.'],
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(PERFILES).map(perfil => ({ perfil }));
}

export default function Para({ params }) {
  const d = PERFILES[params.perfil];
  if (!d) notFound();
  const reg = `/registro?modo=${d.modo}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

      <header className="lp-top">
        <div className="lp-top-in">
          <Link href="/" className="lp-logo"><b>D</b>DesarrollosMX</Link>
          <nav className="lp-nav">
            <Link href="/login">Iniciar sesión</Link>
            <Link href={reg} className="lp-btn lp-btn-mag" style={{ padding: '.55rem .9rem' }}>Crear cuenta</Link>
          </nav>
        </div>
      </header>

      <main className="lp-wrap">
        <section className="lp-hero">
          <Link href="/" className="lp-back">← Volver</Link>
          <div><span className="lp-eyebrow">{d.eyebrow}</span></div>
          <h1>{d.h1}</h1>
          <p>{d.sub}</p>
          <div className="lp-cta">
            <Link href={reg} className="lp-btn lp-btn-mag">{d.cta}</Link>
            <Link href="/" className="lp-btn lp-btn-ghost">Ver todo lo que incluye</Link>
          </div>
          <div className="lp-micro">Sin instalar nada · listo en minutos · desde el navegador</div>
        </section>

        <section className="lp-sect">
          <span className="lp-seyebrow">Beneficios para ti</span>
          <h2>Lo que te llevas</h2>
          <div className="lp-pillars">
            {d.pilares.map(([ic, t, p]) => (
              <div className="lp-pcard" key={t}><div className="lp-ic">{ic}</div><h3>{t}</h3><p>{p}</p></div>
            ))}
          </div>
        </section>

        <section className="lp-sect">
          <span className="lp-seyebrow">Cómo empiezas</span>
          <h2>En 3 pasos</h2>
          <div className="lp-steps">
            {d.pasos.map(([t, p]) => (
              <div className="lp-step" key={t}><h3>{t}</h3><p>{p}</p></div>
            ))}
          </div>
        </section>

        <section className="lp-final">
          <h2>{d.cta}</h2>
          <p>Crea tu cuenta y empieza hoy. Un administrador valida tu registro y quedas activo.</p>
          <div className="lp-cta">
            <Link href={reg} className="lp-btn lp-btn-mag">{d.cta}</Link>
          </div>
          <div className="lp-micro">¿Ya tienes cuenta? <Link href="/login" style={{ color: 'var(--lime)' }}>Inicia sesión</Link></div>
        </section>
      </main>

      <footer className="lp-foot lp-wrap">
        <Link href="/" className="lp-logo"><b>D</b>DesarrollosMX · Portal de Brokers</Link>
        <div className="lp-fl">
          <Link href="/para/inmobiliarias">Inmobiliarias</Link>
          <Link href="/para/brokers">Brokers</Link>
          <Link href="/para/desarrolladores">Desarrolladores</Link>
          <Link href="/login">Iniciar sesión</Link>
        </div>
      </footer>
    </>
  );
}
