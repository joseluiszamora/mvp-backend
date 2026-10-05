import type { Metadata } from "next";
import { ProtectedPage } from "@/components/protected-page";
import { AuditSection } from "@/components/audit-section";
export const metadata: Metadata = { title: "Auditoría", description: "Eventos de la empresa." };
export default function Page() { return <ProtectedPage module="audit"><AuditSection /></ProtectedPage>; }
