import type { Metadata } from "next";
import { ProtectedPage } from "@/components/protected-page";
import { ProfileSection } from "@/components/profile-section";
export const metadata: Metadata = { title: "Perfil", description: "Perfil de la cuenta." };
export default function Page() { return <ProtectedPage module="profile"><ProfileSection /></ProtectedPage>; }
