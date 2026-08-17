/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
