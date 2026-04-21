/**
 * Root layout — wraps all pages.
 * Sets up: fonts, metadata, PWA meta tags, React Query provider, Toaster.
 */

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

const themeInitScript = `
(() => {
  try {
    const savedTheme = localStorage.getItem("theme");
    const legacyDarkMode = localStorage.getItem("darkMode");
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const theme =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : legacyDarkMode === "true"
          ? "dark"
          : legacyDarkMode === "false"
            ? "light"
            : systemTheme;

    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
    localStorage.setItem("darkMode", String(theme === "dark"));
  } catch {}
})();
`;

export const metadata: Metadata = {
  title: "SixD Ops Tool",
  description: "SixD Engineering Solutions — Operations Management Platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SixD Ops",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#E85122",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
