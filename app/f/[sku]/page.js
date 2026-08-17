import { supabase } from '../../../lib/supabase';
import FichaPublica from '../../../components/FichaPublica';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  let og = null;
  try {
    const { data } = await supabase.rpc('ficha_og', { p_sku: params.sku });
    og = data;
  } catch (e) { og = null; }
  const nombre = og?.nombre || 'Ficha técnica';
  const precio = og?.precio_min != null ? '$' + Math.round(og.precio_min).toLocaleString('es-MX') : null;
  const desc = [precio ? 'Desde ' + precio : null, og?.ubicacion || null].filter(Boolean).join(' · ') || 'Desarrollo inmobiliario';
  const images = og?.portada ? [{ url: og.portada }] : [];
  return {
    title: `${nombre} — Quiero Casa`,
    description: desc,
    openGraph: { title: nombre, description: desc, images, type: 'website' },
    twitter: { card: images.length ? 'summary_large_image' : 'summary', title: nombre, description: desc, images: og?.portada ? [og.portada] : [] },
  };
}

export default function Page({ params, searchParams }) {
  return <FichaPublica sku={params.sku} asesor={searchParams?.a || null} unidad={searchParams?.u || null} />;
}
