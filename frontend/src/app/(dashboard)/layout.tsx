"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Loader from "@/components/Loader";
import Navbar from "@/components/Navbar";
import { homePath } from "@/lib/user";
import NavigationProvider, { PageLoadingOverlay } from "@/components/navigation";
import Sidebar from "@/components/Sidebar";
import { useAppSelector } from "@/store/store";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, token } = useAppSelector((state) => state.auth);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    try {
      if (localStorage.getItem("taskflow-sidebar-collapsed") === "1") {
        setSidebarCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem("taskflow-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const media = window.matchMedia("(max-width: 767px)");
    const apply = () => {
      document.body.style.overflow = media.matches ? "hidden" : "";
    };
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!token) router.replace("/login");
    else if (user && user.systemRole !== "employee") router.replace(homePath(user));
  }, [router, token, user]);

  if (!token || !user || user.systemRole !== "employee") return <Loader />;

  return (
    <NavigationProvider>
      <div className="flex h-[100dvh] overflow-x-hidden bg-gray-50 dark:bg-gray-950 md:h-screen">
        <Sidebar
          mobileOpen={mobileNavOpen}
          onClose={closeMobileNav}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapsed}
        />
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <Navbar onMenuClick={() => setMobileNavOpen(true)} />
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">{children}</main>
          <PageLoadingOverlay />
        </div>
      </div>
    </NavigationProvider>
  );
}
