import type { Metadata } from "next";
import { ProtectedPage } from "@/components/protected-page";
import { RolesSection } from "@/components/roles-section";
export const metadata: Metadata = { title: "Roles", description: "Roles y permisos de la empresa." };
export default function Page() { return <ProtectedPage module="roles"><RolesSection /></ProtectedPage>; }
