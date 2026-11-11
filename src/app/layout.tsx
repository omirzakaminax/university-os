import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ToastProvider } from "@/components/ui/toast";
import { THEME_COOKIE, THEME_INIT_SCRIPT, isThemeMode } from "@/domain/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "University OS", template: "%s · University OS" },
  description: "A personal operating system for university life: courses, deadlines, grades and learning in one place.",
  applicationName: "University OS",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0d14" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Explicit light/dark is rendered by the server; "system" is resolved by the pre-paint script below.
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  const explicit = isThemeMode(stored) && stored !== "system" ? stored : undefined;
  return (
    <html lang="en" data-theme={explicit} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
