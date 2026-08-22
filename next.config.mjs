/** @type {import('next').NextConfig} */

// pptxgenjs (y antes jspdf) referencian módulos de Node que no existen en el
// navegador; se resuelven a un módulo vacío SOLO en el bundle de browser.
const NODE_LIBS = [
  'fs', 'https', 'http', 'os', 'path', 'crypto', 'stream', 'zlib', 'util', 'url', 'assert', 'buffer', 'child_process',
];
const resolveAlias = {};
for (const l of NODE_LIBS) {
  resolveAlias[l] = { browser: './lib/vacio.js' };
  resolveAlias['node:' + l] = { browser: './lib/vacio.js' };
}

const nextConfig = {
  reactStrictMode: true,
  turbopack: { resolveAlias },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    }];
  },
};
export default nextConfig;
