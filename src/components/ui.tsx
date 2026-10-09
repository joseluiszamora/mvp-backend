import type { HTMLAttributes, ReactNode } from "react";
import Image from "next/image";

export function Card({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl border border-border bg-surface shadow-[0_1px_3px_rgba(16,24,40,0.04)] ${className}`} {...props}>{children}</div>;
}

export function Avatar({ name, size = "md", photo }: { name: string; size?: "md" | "lg"; photo?: string | null }) {
  const initials = name.split(" ").slice(0, 2).map((part) => part[0]).join("");
  const className = `inline-flex shrink-0 items-center justify-center rounded-full object-cover ${size === "lg" ? "size-11 text-sm" : "size-9 text-xs"}`;
  return photo ? <Image src={photo} alt="" aria-hidden width={size === "lg" ? 44 : 36} height={size === "lg" ? 44 : 36} unoptimized className={className} /> : <span aria-hidden="true" className={`${className} bg-accent-soft font-semibold text-accent-text`}>{initials}</span>;
}

export function Badge({ active }: { active: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-success-soft text-success-text" : "bg-neutral-soft text-neutral-text"}`}><span className="size-1.5 rounded-full bg-current" />{active ? "Activo" : "Inactivo"}</span>;
}

export function PageHeading({ eyebrow, title, description, aside }: { eyebrow: string; title: string; description: string; aside?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.17em] text-accent-text">{eyebrow}</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1><p className="mt-2 text-sm leading-6 text-muted">{description}</p></div>{aside}</div>;
}
