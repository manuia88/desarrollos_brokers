import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LANDING_CSS } from '../../../lib/landingCss';

// Convierte "texto con **negritas**" en nodos React.
function rich(text) {
  return String(text).split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p));
}

// Sub-landing específica por actor. Cada botón de la home general lleva aquí.
// La idea: contenido hiperpersonalizado — dolor, beneficios y funciones reales que
// aplican SOLO a ese rol (inmobiliaria / broker / desarrollador).
const PERFILES = {
  inmobiliarias: {
    modo: 'inmobiliaria', btn: 'lp-btn-mag',
    eyebrow: 'Para inmobiliarias',
    h1: <>Toda tu inmobiliaria vendiendo desde <span className="lp-mag">una sola plataforma</span>.</>,
    sub: 'Tú diriges. Nosotros ponemos el inventario en vivo, el CRM compartido y las comisiones claras — para que tu equipo cierre más y tú veas todo el negocio en una pantalla.',
    cta: 'Registrar mi inmobiliaria',
    stats: [
      ['0', 'hojas de Excel para tu pipeline'],
      ['100%', 'del equipo en una sola vista'],
      ['1 clic', 'para invitar y aprobar asesores'],
    ],
    dolorTitle: 'Lo que hoy te cuesta ventas',
    dolorLead: 'Dirigir una inmobiliaria con WhatsApp y Excel deja dinero en la mesa. Esto es lo que cambia.',
    antes: [
      'Cada asesor con su propio Excel; nunca ves el pipeline real.',
      'Clientes que se caen porque nadie les dio seguimiento a tiempo.',
      'Peleas de comisiones sin registro claro de quién trajo al cliente.',
      'Inventario desactualizado: se ofrece algo ya vendido o a precio viejo.',
      'Cada asesor nuevo tarda semanas en empezar a producir.',
    ],
    despues: [
      ['Un ', <b key="a">tablero con el pipeline de toda la inmobiliaria</b>, ', asesor por asesor.'],
      ['Recordatorios automáticos: ', <b key="b">ningún prospecto se enfría</b>, ' sin querer.'],
      ['Comisión y ', <b key="c">origen del cliente registrados</b>, ' desde el primer contacto.'],
      ['Catálogo en vivo de varios desarrolladores, ', <b key="d">siempre al día</b>, '.'],
      ['Academia integrada: el asesor nuevo ', <b key="e">vende desde la primera semana</b>, '.'],
    ],
    pilaresTitle: 'Lo que te llevas como dirección',
    pilares: [
      ['🏢', 'Inventario sin cargarlo tú', 'Catálogo en vivo de varios desarrolladores. Tu equipo vende sin que nadie capture ni actualice precios.'],
      ['🗂️', 'Tu equipo, ordenado', 'Cada asesor con su cartera; en el Tablero ves quién vende, quién no y qué se está cayendo.'],
      ['🛡️', 'Sin fugas de clientes', 'Aislamiento por inmobiliaria: los prospectos de tu equipo son tuyos, de nadie más.'],
      ['💰', 'Comisiones claras por asesor', 'Estado de cuenta automático por vendedor: quién cobra qué y cuándo, sin discusiones.'],
      ['📊', 'Visión de negocio', 'Métricas de conversión, ritmo de cierre y qué desarrollos mueven más a tu equipo.'],
      ['🎓', 'Onboarding que produce', 'Academia y materiales listos para que tus asesores nuevos arranquen sin depender de ti.'],
    ],
    featsTitle: 'Las funciones que usas como director',
    feats: [
      ['Dirección', '🗂️', 'Dirige a todo tu equipo desde un panel', [
        'Invita a tus asesores y **aprueba su ingreso** con un clic desde Equipo.',
        'Reasigna carteras y da de baja sin perder el historial del cliente.',
        '**Ver como** cualquier asesor para revisar su pipeline y ayudarle a cerrar.',
        'Tablero con el estado real de cada oportunidad de la inmobiliaria.',
      ]],
      ['Cierre', '🧮', 'Cotización en automático', [
        'Enganche, mensualidades e **Infonavit/FOVISSSTE** calculados frente al cliente.',
        'Propuestas y fichas con la **marca de tu inmobiliaria**.',
        'Copiloto de IA que ayuda a responder dudas del cliente al instante.',
        'CRM y seguimiento compartido: nada vive solo en el celular del asesor.',
      ]],
      ['Control', '💰', 'Comisiones y dinero, sin zona gris', [
        'Comisión por desarrollo ya configurada (por ejemplo 3% o 3.5%).',
        'Origen del cliente registrado: se sabe quién lo trajo.',
        'Estado de cuenta por asesor y por operación.',
        'Escrituración con acompañamiento hasta la firma.',
      ]],
    ],
    pasos: [
      ['Registra tu inmobiliaria', 'Creas tu cuenta como director y das de alta tu inmobiliaria. Un administrador la valida.'],
      ['Invita a tu equipo', 'Tus asesores se registran, eligen tu inmobiliaria y tú apruebas su ingreso desde Equipo.'],
      ['A vender con visión completa', 'Todos con el mismo inventario, cotizador y CRM; tú con el Tablero del negocio entero.'],
    ],
    faq: [
      ['¿Tengo que cargar el inventario yo?', 'No. El catálogo llega en vivo de los desarrolladores de la red y se mantiene actualizado solo. Tu equipo sólo elige y vende.'],
      ['¿Los clientes de mis asesores quedan protegidos?', 'Sí. Cada inmobiliaria está aislada: los prospectos y su historial son de tu equipo, y nadie fuera de él los ve.'],
      ['¿Puedo ver lo que hace cada asesor?', 'Sí. Con "Ver como" entras a la vista de cualquier asesor, y en el Tablero ves el pipeline y las comisiones de toda la inmobiliaria.'],
      ['¿Cómo se manejan las comisiones?', 'Cada desarrollo trae su porcentaje configurado y el sistema arma el estado de cuenta por asesor y operación, con el origen del cliente registrado.'],
    ],
    finalP: 'Registra tu inmobiliaria, invita a tu equipo y empieza a vender con todo el inventario y las herramientas en un solo lugar. Un administrador valida tu registro y quedas activo.',
  },

  brokers: {
    modo: 'independiente', btn: 'lp-btn-lime',
    eyebrow: 'Para brokers independientes',
    h1: <>Vende como si tuvieras un <span className="lp-lime">corporativo detrás</span>.</>,
    sub: 'Inventario, cotizador con crédito, CRM y tu propia marca — sin nómina, sin oficina y sin cargar con inventario propio. Tú pones al cliente; nosotros, todo lo demás.',
    cta: 'Crear mi cuenta de broker',
    stats: [
      ['$0', 'invertido en inventario propio'],
      ['Tu marca', 'en cada propuesta que mandas'],
      ['Sin oficina', 'todo desde el navegador'],
    ],
    dolorTitle: 'Lo que te frena vendiendo solo',
    dolorLead: 'Trabajar por tu cuenta no tiene por qué significar improvisar. Esto es lo que cambia.',
    antes: [
      'Persigues inventario en mil chats y catálogos en PDF viejos.',
      'Cotizas "te confirmo mañana" y el cliente se enfría.',
      'Mandas fichas genéricas que no se ven como tu marca.',
      'Prospectos anotados en el celular que se te caen.',
      'Nadie que te respalde después del apartado.',
    ],
    despues: [
      ['Decenas de desarrollos en vivo, ', <b key="a">filtrables por zona, precio y crédito</b>, '.'],
      ['Cotización con enganche y mensualidades ', <b key="b">al instante, frente al cliente</b>, '.'],
      ['Propuestas y fichas con tu logo: ', <b key="c">te ves como una firma grande</b>, '.'],
      ['CRM con recordatorios; ', <b key="d">ningún cliente se vuelve a caer</b>, '.'],
      ['Acompañamiento ', <b key="e">hasta la firma</b>, ', como si tuvieras backoffice.'],
    ],
    pilaresTitle: 'Lo que te llevas como broker',
    pilares: [
      ['🏙️', 'Inventario listo para vender', 'Decenas de desarrollos en vivo. Tú sólo eliges lo que le queda a tu cliente y lo muestras.'],
      ['🧮', 'Cotiza con crédito al instante', 'Enganche, mensualidades e Infonavit/FOVISSSTE en Precalifica — no al día siguiente.'],
      ['🎨', 'Con tu marca', 'Fichas y propuestas con tu logo. Firma grande, aunque trabajes solo.'],
      ['📇', 'Tu CRM personal', 'Pipeline, recordatorios y seguimiento. Ningún prospecto se te vuelve a caer.'],
      ['🤖', 'Copiloto de IA', 'Responde dudas del cliente y arma el mensaje de seguimiento en segundos.'],
      ['🖋️', 'Respaldo hasta la firma', 'Escrituración acompañada: cierras tranquilo aunque no tengas backoffice.'],
    ],
    featsTitle: 'Las funciones que usas para cerrar',
    feats: [
      ['Inventario', '🏙️', 'Todo el catálogo, siempre al día', [
        '**Buscar** y **Comparar** desarrollos por zona, precio, entrega y crédito.',
        'Disponibilidad y precios en vivo: no ofreces algo que ya se vendió.',
        'Fichas con planos, amenidades y todo lo que el cliente pregunta.',
        'Marca los que te interesan y arma tu propia lista corta.',
      ]],
      ['Cierre', '🧮', 'De interesado a apartado el mismo día', [
        '**Precalifica** el crédito (Infonavit/FOVISSSTE/bancario) frente al cliente.',
        'Cotización con enganche y mensualidades lista para compartir.',
        'Propuesta con **tu marca** por WhatsApp en un toque.',
        'Copiloto que te sugiere la respuesta y el próximo paso.',
      ]],
      ['Tu negocio', '📇', 'Un backoffice completo para ti solo', [
        'CRM con pipeline, recordatorios y seguimiento automático.',
        'Comisión clara por desarrollo, sin sorpresas.',
        'Escrituración acompañada hasta la firma.',
        'Academia para vender más y mejor.',
      ]],
    ],
    pasos: [
      ['Crea tu cuenta', 'En minutos, desde el navegador, sin instalar nada.'],
      ['Explora el inventario', 'Filtra por zona, precio, entrega y crédito. Ya está cargado y al día.'],
      ['Cotiza, comparte y cierra', 'Manda la propuesta con tu marca por WhatsApp y cobra tu comisión.'],
    ],
    faq: [
      ['¿Tengo que pagar por el inventario o traerlo yo?', 'No. Vendes el inventario de la red sin comprar nada ni cargar con propiedades propias. Sólo eliges y muestras.'],
      ['¿La propuesta lleva mi marca o la de la plataforma?', 'La tuya. Las fichas y propuestas salen con tu logo para que te veas como una firma grande.'],
      ['¿Puedo cotizar el crédito yo mismo?', 'Sí. En Precalifica calculas enganche, mensualidades y opciones de Infonavit/FOVISSSTE o bancario en el momento.'],
      ['¿Y después del apartado, quién me ayuda?', 'El módulo de Escrituración te acompaña hasta la firma, como si tuvieras un backoffice detrás.'],
    ],
    finalP: 'Crea tu cuenta de broker y empieza a vender hoy con inventario, cotizador y tu marca. Un administrador valida tu registro y quedas activo.',
  },

  desarrolladores: {
    modo: 'desarrollador', btn: 'lp-btn-cyan',
    eyebrow: 'Para desarrolladores',
    h1: <>Pon tu inventario frente a <span className="lp-mag">decenas de brokers</span> listos para vender.</>,
    sub: 'Publica tus desarrollos a toda la red, decide qué se muestra y a quién, y recibe prospectos calificados — sin montar un equipo comercial propio.',
    cta: 'Registrar mi desarrolladora',
    stats: [
      ['1 alta', 'y tu inventario llega a toda la red'],
      ['Tú decides', 'qué se publica y qué se oculta'],
      ['En vivo', 'precios y disponibilidad sincronizados'],
    ],
    dolorTitle: 'Lo que te cuesta vender sin red',
    dolorLead: 'Construir es tu negocio; montar una fuerza de ventas no debería serlo. Esto es lo que cambia.',
    antes: [
      'Contratas y cargas con un equipo comercial propio.',
      'Tu inventario sólo lo ve quien llega a tu caseta.',
      'Brokers vendiendo con precios y disponibilidad viejos.',
      'No sabes qué desarrollo mueve más ni por qué canal.',
      'Reglas y comisiones distintas con cada broker.',
    ],
    despues: [
      ['La red de inmobiliarias y brokers ', <b key="a">vende por ti, sin nómina</b>, '.'],
      ['Tu inventario ', <b key="b">visible para toda la red</b>, ' desde el día uno.'],
      ['Precios y disponibilidad en vivo: ', <b key="c">nadie vende datos viejos</b>, '.'],
      ['Métricas de ', <b key="d">qué se mueve y por dónde</b>, '.'],
      ['Comisión ', <b key="e">configurada por desarrollo</b>, ', igual para todos.'],
    ],
    pilaresTitle: 'Lo que te llevas como desarrollador',
    pilares: [
      ['📢', 'Alcance inmediato', 'Tu inventario visible para inmobiliarias y brokers de toda la red, desde el día uno.'],
      ['🎛️', 'Tú controlas qué se muestra', 'Publicas u ocultas desarrollos y hasta unidades sueltas. Lo que no publiques, nadie lo ve.'],
      ['🎯', 'Prospectos calificados', 'Los brokers te traen clientes listos. Tú te enfocas en construir.'],
      ['🔄', 'Sincronización en vivo', 'Conecta tu Sheets o Salesforce: precios y disponibilidad se actualizan solos.'],
      ['📄', 'Fichas y planos centralizados', 'Una sola fuente de verdad: nadie vende con datos ni precios viejos.'],
      ['📊', 'Ves qué mueve tu inventario', 'Métricas por desarrollo y por unidad: qué se aparta, qué se estanca y por qué.'],
    ],
    featsTitle: 'Las funciones que usas como desarrollador',
    feats: [
      ['Publicación', '🎛️', 'Tú decides qué inventario abres a la red', [
        'Publica u oculta un desarrollo completo, o unidades sueltas, desde **Inventario**.',
        'Abre inventario sólo cuando y como quieras mostrarlo.',
        'Reserva unidades premium y muéstralas en el momento correcto.',
        'Cambias precio o disponibilidad y **se refleja en vivo** en el catálogo.',
      ]],
      ['Sincronización', '🔄', 'Conecta tu Drive o Google Sheets', [
        'Conecta **Google Sheets** o **Salesforce**: el catálogo se actualiza solo.',
        'Espejo real: si algo se vende y sale del Sheet, **sale del portal**.',
        'Fichas con planos, amenidades y precios centralizados.',
        'Captura y Publicador para altas manuales cuando lo necesites.',
      ]],
      ['Resultados', '🎯', 'Vende más sin equipo comercial propio', [
        'Prospectos calificados que traen los brokers de la red.',
        'Comisión por desarrollo **configurable** (por ejemplo 3% o 3.5%).',
        'Métricas de qué desarrollo mueve más y por qué canal.',
        'Si quieres, además operas como **master broker** y reclutas vendedores.',
      ]],
    ],
    pasos: [
      ['Registra tu desarrolladora', 'Creas tu cuenta y das de alta tu empresa. Un administrador la valida.'],
      ['Carga o sincroniza tu inventario', 'Subes tus desarrollos o conectas tu Sheets/Salesforce; precios y disponibilidad en vivo.'],
      ['Publica y recibe prospectos', 'Eliges qué abrir a la red y los brokers empiezan a mover tu inventario.'],
    ],
    faq: [
      ['¿Tengo que montar un equipo de ventas?', 'No. La red de inmobiliarias y brokers vende tu inventario. Tú decides qué publicas y recibes prospectos calificados.'],
      ['¿Controlo qué se muestra a los brokers?', 'Sí. Desde Inventario publicas u ocultas desarrollos completos o unidades sueltas. Lo que no publiques, ningún broker lo ve.'],
      ['¿Cómo mantengo precios y disponibilidad al día?', 'Conectas tu Google Sheets o Salesforce y todo se sincroniza en vivo, en espejo: lo que se vende y sale del Sheet, sale del portal.'],
      ['¿Cómo se define mi comisión a brokers?', 'Configuras el porcentaje por desarrollo (por ejemplo 3% o 3.5%) y aplica igual para toda la red.'],
    ],
    finalP: 'Registra tu desarrolladora, publica tu inventario y deja que la red lo venda. Un administrador valida tu registro y quedas activo.',
  },
};

export function generateStaticParams() {
  return Object.keys(PERFILES).map(perfil => ({ perfil }));
}

export default async function Para({ params }) {
  const { perfil } = await params;
  const d = PERFILES[perfil];
  if (!d) notFound();
  const reg = `/registro?modo=${d.modo}`;
  const btn = d.btn || 'lp-btn-mag';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

      <div className="lp-page">
      <header className="lp-top">
        <div className="lp-top-in">
          <Link href="/" className="lp-logo"><b>D</b>DesarrollosMX</Link>
          <nav className="lp-nav">
            <Link href="/login">Iniciar sesión</Link>
            <Link href={reg} className={'lp-btn ' + btn} style={{ padding: '.55rem .9rem' }}>Crear cuenta</Link>
          </nav>
        </div>
      </header>

      <main className="lp-wrap">
        <section className="lp-hero">
          <Link href="/" className="lp-back">← Volver a la página principal</Link>
          <div><span className="lp-eyebrow">{d.eyebrow}</span></div>
          <h1>{d.h1}</h1>
          <p>{d.sub}</p>
          <div className="lp-cta">
            <Link href={reg} className={'lp-btn ' + btn}>{d.cta}</Link>
            <Link href="/" className="lp-btn lp-btn-ghost">Ver todo lo que incluye</Link>
          </div>
          <div className="lp-micro">Sin instalar nada · listo en minutos · desde el navegador</div>
          {d.stats && (
            <div className="lp-stats">
              {d.stats.map(([b, s]) => (
                <div key={s}><b>{b}</b><span>{s}</span></div>
              ))}
            </div>
          )}
        </section>

        <section className="lp-sect">
          <span className="lp-seyebrow">Antes y después</span>
          <h2>{d.dolorTitle}</h2>
          {d.dolorLead && <p className="lp-lead">{d.dolorLead}</p>}
          <div className="lp-vs">
            <div className="lp-vscard bad">
              <h3>😮‍💨 Sin DesarrollosMX</h3>
              <ul>{d.antes.map((t, i) => <li key={i}><i>✕</i><span>{t}</span></li>)}</ul>
            </div>
            <div className="lp-vscard good">
              <h3>✅ Con DesarrollosMX</h3>
              <ul>{d.despues.map((t, i) => <li key={i}><i>✓</i><span>{t}</span></li>)}</ul>
            </div>
          </div>
        </section>

        <section className="lp-sect">
          <span className="lp-seyebrow">Beneficios para ti</span>
          <h2>{d.pilaresTitle}</h2>
          <div className="lp-pillars">
            {d.pilares.map(([ic, t, p]) => (
              <div className="lp-pcard" key={t}><div className="lp-ic">{ic}</div><h3>{t}</h3><p>{p}</p></div>
            ))}
          </div>
        </section>

        <section className="lp-sect">
          <span className="lp-seyebrow">Qué incluye para tu caso</span>
          <h2>{d.featsTitle}</h2>
          <div className="lp-mods">
            {d.feats.map(([tag, glyph, h3, items]) => (
              <div className="lp-mod" key={h3}>
                <div className="lp-mod-txt">
                  <span className="lp-mtag">{tag}</span>
                  <h3>{h3}</h3>
                  <ul>{items.map((it, i) => <li key={i}><i>✓</i><span>{rich(it)}</span></li>)}</ul>
                </div>
                <div className="lp-mart"><span className="lp-glyph">{glyph}</span></div>
              </div>
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

        <section className="lp-sect">
          <span className="lp-seyebrow">Preguntas</span>
          <h2>Dudas frecuentes</h2>
          <div className="lp-faq">
            {d.faq.map(([q, a]) => (
              <details key={q}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </section>

        <section className="lp-final">
          <h2>{d.cta}</h2>
          <p>{d.finalP}</p>
          <div className="lp-cta">
            <Link href={reg} className={'lp-btn ' + btn}>{d.cta}</Link>
          </div>
          <div className="lp-micro">¿Ya tienes cuenta? <Link href="/login" style={{ color: 'var(--lime)' }}>Inicia sesión</Link></div>
        </section>
      </main>

      <footer className="lp-foot lp-wrap">
        <Link href="/" className="lp-logo"><b>D</b>DesarrollosMX · Portal de Brokers</Link>
        <div className="lp-fl">
          <Link href="/para/desarrolladores">Desarrolladores</Link>
          <Link href="/para/inmobiliarias">Inmobiliarias</Link>
          <Link href="/para/brokers">Brokers</Link>
          <Link href="/login">Iniciar sesión</Link>
        </div>
      </footer>
      </div>
    </>
  );
}
