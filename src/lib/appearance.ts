export const accentChoices = [
  { id: "blue", name: "Azul", light: "#2663d8", dark: "#6a9aff" },
  { id: "violet", name: "Violeta", light: "#7546d8", dark: "#aa8cff" },
  { id: "emerald", name: "Verde", light: "#14845f", dark: "#5bcfa3" },
  { id: "rose", name: "Rosa", light: "#cd3f75", dark: "#f28bac" },
  { id: "amber", name: "Ámbar", light: "#aa6500", dark: "#f2bc62" },
] as const;

export type AccentColor = (typeof accentChoices)[number]["id"];
export type AppearanceMode = "light" | "dark";
export const accentStorageKey = (mode: AppearanceMode) => `panel-admin-accent-${mode}`;
export const isAccentColor = (value: string | null): value is AccentColor =>
  accentChoices.some((choice) => choice.id === value);
