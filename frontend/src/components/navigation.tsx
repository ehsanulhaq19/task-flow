"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Loader from "@/components/Loader";

type Navigate = (href: string, label: string) => void;

type PendingNavigation = { href: string; label: string } | null;

const NavigationContext = createContext<{
  navigate: Navigate;
  pending: PendingNavigation;
}>({
  navigate: () => {},
  pending: null,
});

export function usePageNavigation() {
  return useContext(NavigationContext).navigate;
}

export default function NavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState<PendingNavigation>(null);

  useEffect(() => {
    if (!pending) return;
    if (pathname === pending.href || pathname.startsWith(`${pending.href}/`)) {
      setPending(null);
    }
  }, [pathname, pending]);

  const navigate: Navigate = (href, label) => {
    if (pathname === href) return;
    setPending({ href, label });
    router.push(href);
  };

  return (
    <NavigationContext.Provider value={{ navigate, pending }}>{children}</NavigationContext.Provider>
  );
}

export function PageLoadingOverlay() {
  const { pending } = useContext(NavigationContext);
  if (!pending) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-gray-50/90 backdrop-blur-sm dark:bg-gray-950/90"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader fullScreen={false} label={pending.label} />
    </div>
  );
}
