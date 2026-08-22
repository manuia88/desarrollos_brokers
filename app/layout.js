import './globals.css';

export const metadata = {
  title: 'DesarrollosMX · Portal de Brokers',
  description: 'El portal del programa de brokers de DesarrollosMX: inventario, ficha técnica, CRM y comisiones.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
