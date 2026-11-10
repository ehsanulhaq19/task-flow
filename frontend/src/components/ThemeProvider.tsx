"use client";

import { useEffect } from "react";
import { useAppSelector } from "@/store/store";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode } = useAppSelector((state) => state.theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, [mode]);

  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", mode === "dark");
  }

  return <>{children}</>;
}
