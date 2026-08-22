import { supabase } from '../../../lib/supabase';
import FichaPublica from '../../../components/FichaPublica';
import { tituloDev } from '../../../lib/nombre';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { sku } = await params;
  let og = null;
  try {
    const { data } = await supabase.rpc('ficha_og', { p_sku: sku });
    og = data;
  } catch (e) { og = null; }
  const nombre = (og?.nombre ? tituloDev(og) : null) || 'Ficha técnica';
  const precio = og?.precio_min != null ? '$' + Math.round(og.precio_min).toLocaleString('es-MX') : null;
  const desc = [precio ? 'Desde ' + precio : null, og?.ubicacion || null].filter(Boolean).join(' · ') || 'Desarrollo inmobiliario';
  const images = og?.portada ? [{ url: og.portada }] : [];
  return {
    title: `${nombre} — DesarrollosMX`,
    description: desc,
    openGraph: { title: nombre, description: desc, images, type: 'website' },
    twitter: { card: images.length ? 'summary_large_image' : 'summary', title: nombre, description: desc, images: og?.portada ? [og.portada] : [] },
  };
}

export default async function Page({ params, searchParams }) {
  const { sku } = await params;
  const sp = (await searchParams) || {};
  return <FichaPublica sku={sku} asesor={sp.a || null} unidad={sp.u || null} cliente={sp.c || null} />;
}
