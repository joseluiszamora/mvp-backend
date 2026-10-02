import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Inicio | Panel Admin", template: "%s | Panel Admin" },
  description: "Panel administrativo de demostración con resumen y usuarios.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" suppressHydrationWarning><body><ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange><AppShell>{children}</AppShell></ThemeProvider></body></html>;
}
