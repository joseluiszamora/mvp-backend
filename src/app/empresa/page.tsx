import type { Metadata } from "next";
import { ProtectedPage } from "@/components/protected-page";
import { OrganizationSection } from "@/components/organization-section";
export const metadata: Metadata = { title: "Empresa", description: "Datos y sucursales de la empresa." };
export default function Page() { return <ProtectedPage module="organization"><OrganizationSection /></ProtectedPage>; }
