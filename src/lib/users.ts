export type UserStatus = "Activo" | "Inactivo";
export type DemoUser = {
  id: number;
  name: string;
  email: string;
  role: "Administrador" | "Editor" | "Miembro";
  status: UserStatus;
  joinedAt: string;
};

export const users: DemoUser[] = [
  { id: 1, name: "María Fernández", email: "maria.fernandez@ejemplo.com", role: "Administrador", status: "Activo", joinedAt: "2026-09-28" },
  { id: 2, name: "Carlos Mendoza", email: "carlos.mendoza@ejemplo.com", role: "Editor", status: "Activo", joinedAt: "2026-09-25" },
  { id: 3, name: "Ana Rodríguez", email: "ana.rodriguez@ejemplo.com", role: "Miembro", status: "Activo", joinedAt: "2026-09-21" },
  { id: 4, name: "Luis Herrera", email: "luis.herrera@ejemplo.com", role: "Miembro", status: "Inactivo", joinedAt: "2026-09-18" },
  { id: 5, name: "Sofía Vargas", email: "sofia.vargas@ejemplo.com", role: "Editor", status: "Activo", joinedAt: "2026-09-14" },
  { id: 6, name: "Diego Morales", email: "diego.morales@ejemplo.com", role: "Miembro", status: "Inactivo", joinedAt: "2026-09-10" },
  { id: 7, name: "Valentina Rojas", email: "valentina.rojas@ejemplo.com", role: "Miembro", status: "Activo", joinedAt: "2026-09-04" },
  { id: 8, name: "Jorge Salazar", email: "jorge.salazar@ejemplo.com", role: "Editor", status: "Activo", joinedAt: "2026-08-29" },
];

export const demoAdmin = { name: "María Fernández", role: "Administradora" };
export const formatDate = (date: string) => new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
