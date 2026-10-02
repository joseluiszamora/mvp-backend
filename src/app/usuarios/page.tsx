import type { Metadata } from "next";
import { UsersView } from "@/components/users-view";
import { users } from "@/lib/users";

export const metadata: Metadata = { title: "Usuarios", description: "Listado de usuarios de demostración." };
export default function UsersPage() { return <UsersView users={users} />; }
