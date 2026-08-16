import './globals.css';

export const metadata = {
  title: 'Quiero Casa · Portal de Brokers',
  description: 'El portal del programa de brokers de Quiero Casa: inventario, ficha técnica, CRM y comisiones.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
