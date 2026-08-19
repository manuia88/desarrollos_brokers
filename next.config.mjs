/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // pptxgenjs / jspdf referencian módulos de Node que no existen en el navegador.
      const nodeLibs = [
        'fs', 'https', 'http', 'os', 'path', 'crypto', 'stream', 'zlib', 'util', 'url', 'assert', 'buffer', 'child_process',
      ];
      config.resolve = config.resolve || {};
      config.resolve.fallback = { ...(config.resolve.fallback || {}) };
      for (const l of nodeLibs) {
        config.resolve.fallback[l] = false;
        config.resolve.fallback['node:' + l] = false;
      }
      // Reescribe imports "node:xxx" a "xxx" (que arriba mandamos a false en el cliente).
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, '');
      }));
    }
    return config;
  },
};
export default nextConfig;
