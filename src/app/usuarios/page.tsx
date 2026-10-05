import type { Metadata } from "next";
import { ProtectedPage } from "@/components/protected-page";
import { UsersView } from "@/components/users-view";

export const metadata: Metadata = { title: "Usuarios", description: "Listado de usuarios de la empresa." };
export default function UsersPage() { return <ProtectedPage module="users"><UsersView /></ProtectedPage>; }
