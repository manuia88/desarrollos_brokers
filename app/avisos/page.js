'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Nav from '../../components/Nav';
import { EmptyState } from '../../components/ui';
import { listarAvisos, marcarLeido, marcarTodo } from '../../lib/notif';

const ICON = { lead_asignado: '🎯', lead_sla: '⏱️', apartado: '📌', liga_abierta: '👀', cita: '📅', agente_borrador: '✍️', agente_cadencia: '🔁', agente_precio: '📉', agente_noshow: '🪃', wa_handoff: '🙋', default: '🔔' };
const hace = ts => { if (!ts) return ''; const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000); if (s < 60) return 'ahora'; if (s < 3600) return `hace ${Math.floor(s / 60)} min`; if (s < 86400) return `hace ${Math.floor(s / 3600)} h`; return `hace ${Math.floor(s / 86400)} d`; };

export default function Avisos() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [avisos, setAvisos] = useState(null);

  async function recargar() { setAvisos(await listarAvisos()); }
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: prof } = await supabase.from('profiles').select('nombre,rol,org_id').eq('id', session.user.id).single();
      setMe({ id: session.user.id, email: session.user.email, ...(prof || {}) });
      await recargar();
    })();
  }, [router]);

  async function abrir(a) { if (!a.leido) await marcarLeido(a.id); if (a.link) router.push(a.link); else recargar(); }
  async function todo() { await marcarTodo(); recargar(); }

  if (avisos === null) return <div className="loading">Cargando avisos…</div>;
  const noLeidos = avisos.filter(a => !a.leido).length;

  return (
    <>
      <Nav me={me} current="/avisos" logo="Avisos" />
      <main className="wrap">
        <div className="buscar-intro" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div><h1>Avisos</h1><p>Leads asignados, reasignaciones por SLA, apartados y actividad de tus clientes.</p></div>
          {noLeidos > 0 && <button className="btn ghost sm" onClick={todo}>Marcar todo leído</button>}
        </div>

        {avisos.length === 0 ? (
          <EmptyState icon="🔔" title="Sin avisos por ahora">Cuando te asignen un lead, se reasigne por SLA o un cliente abra tu ficha, te aparecerá aquí.</EmptyState>
        ) : (
          <div className="av-list">
            {avisos.map(a => (
              <div className={'av' + (a.leido ? '' : ' unread')} key={a.id} onClick={() => abrir(a)}>
                <span className="av-ic">{ICON[a.tipo] || ICON.default}</span>
                <div className="av-body"><b>{a.titulo}</b><span>{a.cuerpo}</span><em>{hace(a.creado)}</em></div>
                {!a.leido && <span className="av-dot" />}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
