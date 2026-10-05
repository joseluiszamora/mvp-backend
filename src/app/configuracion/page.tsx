import type { Metadata } from "next";
import { ProtectedPage } from "@/components/protected-page";
import { SettingsSection } from "@/components/settings-section";

export const metadata: Metadata = { title: "Configuración", description: "Personaliza la apariencia del panel administrativo." };
export default function SettingsPage() { return <ProtectedPage module="settings"><SettingsSection /></ProtectedPage>; }
