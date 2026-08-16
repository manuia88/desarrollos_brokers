import Link from 'next/link';

export default function Landing() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <span className="logo"><b>Q</b>Quiero Casa</span>
          <nav className="nav">
            <Link href="/login">Iniciar sesión</Link>
            <Link href="/registro" className="btn mag" style={{ padding: '.55rem .9rem' }}>Unirme</Link>
          </nav>
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <span className="eyebrow">Programa de Brokers</span>
          <h1>Vende el inventario de <span className="mag">Quiero Casa</span><br />con datos, no con suerte<span className="lim">.</span></h1>
          <p>El portal para inmobiliarias y brokers independientes: inventario en tiempo real, ficha técnica completa,
            cotizador con crédito, CRM y comisiones — todo en un solo lugar, con aislamiento total entre inmobiliarias.</p>
          <div className="cta">
            <Link href="/registro" className="btn mag">Registrar mi inmobiliaria</Link>
            <Link href="/registro" className="btn lim">Soy broker independiente</Link>
            <Link href="/login" className="btn ghost">Ya tengo cuenta</Link>
          </div>
          <div className="stats">
            <div><b>28</b><span>Desarrollos</span></div>
            <div><b>1,284</b><span>Unidades disponibles</span></div>
            <div><b>3</b><span>Marcas: Quiero Casa · Capital · Agatha</span></div>
            <div><b>RLS</b><span>Aislamiento por inmobiliaria</span></div>
          </div>
        </section>

        <section className="feat">
          <div className="fcard"><div className="ic">🏢</div><h3>Catálogo con ficha completa</h3><p>Cada desarrollo con todas sus columnas, disponibilidad en tiempo real y galería.</p></div>
          <div className="fcard"><div className="ic">🎯</div><h3>Segmentación inteligente</h3><p>Filtra por precio, zona, entrega, cajones, elevautos, comisión y más. Encuentra el depa de tu cliente.</p></div>
          <div className="fcard"><div className="ic">🧮</div><h3>Cotizador con crédito</h3><p>Enganche, mensualidades y crédito Infonavit/FOVISSSTE/bancario, con tu marca. (Próximamente)</p></div>
          <div className="fcard"><div className="ic">👥</div><h3>CRM del broker</h3><p>Registra clientes, mueve el pipeline, agenda visitas — con protección de cliente y anti-fraude.</p></div>
          <div className="fcard"><div className="ic">💰</div><h3>Comisiones claras</h3><p>Cálculo automático por venta y estado de cuenta por inmobiliaria y asesor. (Próximamente)</p></div>
          <div className="fcard"><div className="ic">🔒</div><h3>Seguro por diseño</h3><p>Postgres con RLS: una inmobiliaria jamás ve los datos ni los clientes de otra.</p></div>
        </section>

        <footer className="foot-note">Quiero Casa · Quiero Capital · Agatha — Portal de Brokers · Fase 1 en construcción.</footer>
      </main>
    </>
  );
}
