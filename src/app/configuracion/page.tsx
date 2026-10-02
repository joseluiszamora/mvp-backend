import type { Metadata } from "next";
import { AppearanceSettings } from "@/components/appearance-settings";

export const metadata: Metadata = { title: "Configuración", description: "Personaliza la apariencia del panel administrativo." };
export default function SettingsPage() { return <AppearanceSettings />; }
