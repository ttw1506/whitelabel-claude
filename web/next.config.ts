import type { NextConfig } from "next";

// Cabeçalhos de segurança em todas as páginas.
// shortcut: sem Content-Security-Policy ainda (o Next usa scripts embutidos; exige "nonce"). Adicionar antes de abrir ao público.
const cabecalhos = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@soloplan/regras"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: cabecalhos }];
  },
};

export default nextConfig;
