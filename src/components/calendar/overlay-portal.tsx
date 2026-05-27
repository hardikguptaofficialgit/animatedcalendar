"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type OverlayPortalProps = {
  open: boolean;
  onClose: () => void;
  side: "left" | "right" | "center";
  children: ReactNode;
  panelClassName?: string;
  ariaLabel?: string;
};

export function OverlayPortal({
  open,
  onClose,
  side,
  children,
  panelClassName,
  ariaLabel,
}: OverlayPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label={ariaLabel ?? "Close panel"}
        className="calendar-overlay-backdrop"
        onClick={onClose}
      />
      {side === "center" ? (
        <div className="calendar-overlay-center" role="dialog" aria-modal="true">
          <div className={cn("calendar-overlay-dialog", panelClassName)}>{children}</div>
        </div>
      ) : (
        <aside
          className={cn(
            "calendar-overlay-panel",
            side === "left" ? "calendar-overlay-panel-left" : "calendar-overlay-panel-right",
            panelClassName
          )}
          role="dialog"
          aria-modal="true"
        >
          {children}
        </aside>
      )}
    </>,
    document.body
  );
}
