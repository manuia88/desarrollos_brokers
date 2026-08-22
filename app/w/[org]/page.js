import ChatWidget from './widget-client';
import { svc } from '../../../lib/googleServer';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Asistente', robots: { index: false } };
}

// Página embebible del Asesor Digital (iframe del widget). Sin Nav, sin sesión.
export default async function W({ params }) {
  const { org } = await params;
  let nombre = null, activo = false;
  try {
    const db = svc();
    const { data } = await db.from('orgs').select('nombre,agente_modo,estado').eq('id', org).maybeSingle();
    if (data && data.estado === 'activo' && data.agente_modo !== 'off') { nombre = data.nombre; activo = true; }
  } catch { /* sin servicio: se muestra apagado */ }
  return <ChatWidget org={org} nombre={nombre} activo={activo} />;
}
