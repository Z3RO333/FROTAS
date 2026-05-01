import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Frotas Bemol",
  description: "Sistema de gestão de frotas Bemol",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
