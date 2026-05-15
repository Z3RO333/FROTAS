import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "Frotas Bemol",
  description: "Sistema de gestão de frotas Bemol",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Frotas",
    startupImage: "/icons/icon-512x512.svg",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192x192.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon-152x152.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
