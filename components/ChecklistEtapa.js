'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabase';

// Pendientes estándar por etapa del pipeline.
const ITEMS = {
  Nuevo: ['Llamar y presentarme', 'Calificar presupuesto y crédito', 'Confirmar qué busca'],
  Contactado: ['Enviar fichas que le queden', 'Precalificar su crédito', 'Proponer una cita'],
  Cita: ['Confirmar la cita', 'Preparar cotización', 'Dar seguimiento tras la visita'],
  Apartado: ['Recabar INE, CURP y comprobante', 'Subir comprobante de apartado', 'Iniciar trámite de crédito'],
  Escriturado: ['Agendar fecha de firma', 'Confirmar notaría', 'Coordinar entrega de llaves'],
  Perdido: ['Registrar el motivo', 'Agendar recontacto a futuro'],
};

export default function ChecklistEtapa({ lead }) {
  const items = ITEMS[lead.etapa] || [];
  const [chk, setChk] = useState(lead.checklist || {});
  if (!items.length) return null;

  const key = i => `${lead.etapa}:${i}`;
  const done = items.filter((_, i) => chk[key(i)]).length;

  async function toggle(i) {
    const next = { ...chk, [key(i)]: !chk[key(i)] };
    setChk(next);
    lead.checklist = next; // mantener en memoria para el drawer
    await supabase.from('leads').update({ checklist: next }).eq('id', lead.id);
  }

  return (
    <div className="dw-sec">
      <h3>Checklist · {lead.etapa} <span className="fcount">{done}/{items.length}</span></h3>
      <div className="chk">
        {items.map((it, i) => (
          <label className={'chk-item' + (chk[key(i)] ? ' done' : '')} key={i}>
            <input type="checkbox" checked={!!chk[key(i)]} onChange={() => toggle(i)} />
            <span>{it}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
