import type { Metadata } from "next";
import { Outfit } from "next/font/google";

import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Integra Escala",
  description:
    "Gerador de escala institucional para ILPIs — gestão simples, segura e padronizada.",
  icons: [
    {
      rel: "icon",
      type: "image/svg+xml",
      url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%231a3c34'/><text x='50%25' y='53%25' text-anchor='middle' dominant-baseline='central' fill='%23f7f4ec' font-size='16' font-family='sans-serif' font-weight='600'>IE</text></svg>",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} h-full`}>
      <body className="min-h-full bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
