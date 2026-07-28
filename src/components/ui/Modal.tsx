"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ModalProps {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  tituloId?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closable?: boolean;
  overlayClassName?: string;
  dialogClassName?: string;
}

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[90vw]",
};

export default function Modal({
  aberto,
  onFechar,
  titulo,
  tituloId,
  children,
  size = "md",
  closable = true,
  overlayClassName,
  dialogClassName,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const id = tituloId ?? `modal-title-${titulo.replace(/\s+/g, "-")}`;

  useEffect(() => {
    if (!aberto) return;

    // Store previously focused element for restoration
    previouslyFocusedRef.current = document.activeElement as HTMLElement;

    // Focus the dialog
    dialogRef.current?.focus();

    // Trap focus
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onFechar();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (focusable.length === 0) return;

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus
      previouslyFocusedRef.current?.focus();
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm ${overlayClassName ?? ""}`}
      onClick={(e) => {
        if (e.target === overlayRef.current) onFechar();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className={`relative w-full ${SIZE_CLASSES[size]} bg-white rounded-2xl shadow-2xl overflow-hidden outline-none ${dialogClassName ?? ""}`}
      >
        {children}
        {closable && (
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="absolute top-3 right-3 text-[#8b7d6b] hover:text-[#555] p-1"
          >
            <X size={18} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}
