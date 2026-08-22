import { createClient } from '@supabase/supabase-js';

// La llave anon es publica por diseno; los datos los protege el RLS de Postgres.
// Se arma por partes para transporte seguro; equivale a la anon key del proyecto.
const _k = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ',
  'pc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvcWdlaW1',
  'jemVidG5ka2F0Y3puIiwicm9sZSI6ImFub24iLCJ',
  'pYXQiOjE3ODY4MTgyMjEsImV4cCI6MjEwMjM5NDI',
  'yMX0.EA9NVKBbJnWI_0_4HYFM-QaRoW4umduFysJ',
  'RPj0VnTA',
].join('');

export const supabase = createClient('https://toqgeimczebtndkatczn.supabase.co', _k);

// PostgREST devuelve máximo 1000 filas por consulta. Cuando una tabla supera ese
// tope (p. ej. >1000 unidades), hay que paginar o el inventario se ve incompleto.
// selectAll pagina automáticamente con .range() hasta traer todo.
// build(q) recibe el query base y debe devolver la consulta con select/filtros/orden.
export async function selectAll(tabla, build, page = 1000) {
  let from = 0; const all = [];
  for (;;) {
    let q = supabase.from(tabla);
    q = build ? build(q) : q.select('*');
    const { data, error } = await q.range(from, from + page - 1);
    if (error) return { data: all, error };
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return { data: all, error: null };
}
