import type { Metadata } from "next";
import { ProtectedPage } from "@/components/protected-page";
import { FilesSection } from "@/components/files-section";
export const metadata: Metadata = { title: "Archivos", description: "Archivos privados de la empresa." };
export default function Page() { return <ProtectedPage module="files"><FilesSection /></ProtectedPage>; }
