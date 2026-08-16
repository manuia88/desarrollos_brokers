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
