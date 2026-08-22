'use client';
// Launchpad: checklist de arranque para brokers nuevos. Detecta el avance REAL
// (no palomitas manuales) y desaparece solo cuando todo está completo.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function ChecklistArranque({ me }) {
  const router = useRouter();
  const [pasos, setPasos] = useState(null);

  useEffect(() => {
    if (!me?.id) return;
    (async () => {
      const [org, conns, cards, props] = await Promise.all([
        me.org_id ? supabase.from('orgs').select('logo_url').eq('id', me.org_id).maybeSingle() : { data: null },
        supabase.rpc('mis_conexiones'),
        supabase.from('client_cards').select('id').limit(1),
        supabase.from('eventos').select('id').eq('tipo', 'vista_ficha').limit(1),
      ]);
      const lista = conns.data || [];
      setPasos([
        { k: 'marca', done: !!org.data?.logo_url, txt: 'Configura tu marca (logo y colores)', href: '/marca' },
        { k: 'ia', done: lista.some(c => c.proveedor === 'ia' && c.activa), txt: 'Conecta tu llave de IA (enciende a tu Asesor Digital)', href: '/conexiones' },
        { k: 'canal', done: lista.some(c => ['whatsapp', 'telegram'].includes(c.proveedor) && c.activa), txt: 'Conecta un canal (WhatsApp o Telegram)', href: '/conexiones' },
        { k: 'cliente', done: (cards.data || []).length > 0, txt: 'Registra tu primer cliente', href: '/clientes' },
        { k: 'ficha', done: (props.data || []).length > 0, txt: 'Comparte tu primera ficha o propuesta', href: '/buscar' },
      ]);
    })();
  }, [me?.id]);

  if (!pasos) return null;
  const hechos = pasos.filter(p => p.done).length;
  if (hechos === pasos.length) return null;   // graduado: no estorbar más

  return (
    <div className="lp">
      <h3>🚀 Pon a punto tu portal — {hechos}/{pasos.length}</h3>
      <div className="lp-bar"><i style={{ width: (hechos / pasos.length * 100) + '%' }} /></div>
      <div className="lp-items">
        {pasos.map(p => (
          <a key={p.k} className={'lp-item' + (p.done ? ' done' : '')} onClick={() => !p.done && router.push(p.href)}>
            <span className="ck">{p.done ? '✓' : ''}</span>{p.txt}
          </a>
        ))}
      </div>
    </div>
  );
}
