import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Soloplan Campo", template: "%s · Soloplan Campo" },
  description: "Acompanhamento de lavouras, custos e laudos da Soloplan.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f4f6f1" }, { media: "(prefers-color-scheme: dark)", color: "#111712" }],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tema = (await cookies()).get("tema")?.value;
  return (
    <html lang="pt-BR" data-theme={tema === "light" || tema === "dark" ? tema : undefined}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@600;700&family=Public+Sans:wght@400;500;600;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
