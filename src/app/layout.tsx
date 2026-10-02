import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { AppShell } from "@/components/app-shell";
import { accentChoices } from "@/lib/appearance";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Inicio | Panel Admin", template: "%s | Panel Admin" },
  description: "Panel administrativo de demostración con resumen y usuarios.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const colors = JSON.stringify(accentChoices.map((choice) => choice.id));
  const appearanceScript = `try{const colors=${colors};for(const mode of ["light","dark"]){const value=localStorage.getItem("panel-admin-accent-"+mode);if(colors.includes(value))document.documentElement.setAttribute("data-accent-"+mode,value)}}catch{}`;
  return <html lang="es" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: appearanceScript }} /></head><body><ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange><AppShell>{children}</AppShell></ThemeProvider></body></html>;
}
