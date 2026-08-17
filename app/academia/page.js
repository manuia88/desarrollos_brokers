'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';

const PASOS = [
  ['🎨', 'Completa tu marca', 'Sube tu logo y datos de contacto para que tus fichas salgan a tu nombre.', '/marca'],
  ['🏙️', 'Explora el catálogo', 'Conoce los desarrollos, sus fichas técnicas y disponibilidad.', '/portal'],
  ['🔎', 'Haz tu primera búsqueda', 'Define lo que busca un cliente y guarda su tarjeta.', '/buscar'],
  ['👤', 'Registra un cliente', 'Da de alta tu primer lead y muévelo por el pipeline.', '/crm'],
  ['📤', 'Comparte una ficha', 'Manda un link brandeado por WhatsApp y mide cuándo lo abren.', '/materiales'],
  ['🧮', 'Precalifica', 'Calcula para cuánto le alcanza a tu cliente y qué inventario aplica.', '/precalifica'],
];

const FAQ = [
  ['¿Cómo gano mi comisión?', 'Al apartar una unidad se congela tu comisión (precio × % del desarrollo). Se marca como ganada cuando la operación se escritura. Puedes ver tu estado de cuenta y exportarlo en Comisiones.'],
  ['¿Qué es la protección de cliente?', 'Cuando registras un cliente por teléfono o correo, el sistema revisa si alguien más ya lo tiene. Gana quien lo registró primero: así se evita el choque entre brokers.'],
  ['¿Cómo funciona un apartado?', 'Solicitas apartar una unidad; un super-admin lo autoriza. Mientras tanto la unidad queda bloqueada. Los apartados pendientes vencen a 7 días y los autorizados a 30 — al vencer, la unidad se libera sola.'],
  ['¿Cómo sé si un cliente está interesado?', 'Cuando compartes una ficha desde Clientes o Materiales, cada apertura se registra. En el panel de Interés ves qué cliente abrió qué y cuándo — es tu señal de compra.'],
  ['¿Puedo compartir una unidad específica?', 'Sí. En la ficha del desarrollo, dentro de una unidad, tienes el botón de compartir: el link lleva directo a esa unidad y sale con tu marca.'],
  ['¿Los contratos se firman aquí?', 'No. Los contratos y la firma se manejan directo en Salesforce. Aquí llevas la relación con el cliente, el apartado, la comisión y las fechas de escrituración.'],
];

export default function Academia() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
    })();
  }, [router]);

  return (
    <>
      <Nav me={me} current="/academia" logo="Academia" />
      <main className="wrap">
        <div className="buscar-intro">
          <h1>Academia del broker</h1>
          <p>Todo lo que necesitas para arrancar y vender con el portal. Empieza por los pasos y resuelve dudas en las preguntas frecuentes.</p>
        </div>

        <h2 className="calor-h" style={{ marginBottom: '.8rem' }}>Primeros pasos</h2>
        <div className="acad-grid">
          {PASOS.map(([ic, t, d, href], i) => (
            <article className="acad" key={i} onClick={() => router.push(href)}>
              <div className="acad-ic">{ic}</div>
              <div><h3>{i + 1}. {t}</h3><p>{d}</p></div>
              <span className="acad-go">→</span>
            </article>
          ))}
        </div>

        <h2 className="calor-h" style={{ margin: '1.6rem 0 .8rem' }}>Preguntas frecuentes</h2>
        <div className="faq">
          {FAQ.map(([q, a], i) => (
            <div className={'faq-item' + (open === i ? ' on' : '')} key={i}>
              <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>{q}<span>{open === i ? '−' : '+'}</span></button>
              {open === i && <p className="faq-a">{a}</p>}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
