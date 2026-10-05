import type { Metadata } from "next";
import { ProtectedPage } from "@/components/protected-page";
import { NotificationsSection } from "@/components/notifications-section";
export const metadata: Metadata = { title: "Notificaciones", description: "Avisos ficticios." };
export default function Page() { return <ProtectedPage module="notifications"><NotificationsSection /></ProtectedPage>; }
