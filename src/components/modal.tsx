"use client";

import { useEffect, useRef } from "react";

export function Modal({ children, titleId, onClose }: { children: React.ReactNode; titleId: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.querySelector<HTMLElement>("input, button, select, textarea, a[href]")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close.current(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>("input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]")];
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, []);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-xl bg-surface p-6 text-foreground">{children}</div></div>;
}
