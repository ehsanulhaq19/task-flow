"use client";

import { useEffect } from "react";

type DayLimitDialogProps = {
  message: string;
  confirmLabel: string;
  secondaryLabel?: string;
  onConfirm: () => void;
  onSecondary?: () => void;
  onClose: () => void;
};

export default function DayLimitDialog({
  message,
  confirmLabel,
  secondaryLabel,
  onConfirm,
  onSecondary,
  onClose,
}: DayLimitDialogProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close dialog" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Daily hours</h2>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
            >
              {secondaryLabel}
            </button>
          ) : null}
          <button type="button" onClick={onConfirm} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
