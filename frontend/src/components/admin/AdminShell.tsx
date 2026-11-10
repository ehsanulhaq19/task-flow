"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import NavigationProvider, { PageLoadingOverlay, usePageNavigation } from "@/components/navigation";
import { stopScreenCapture } from "@/services/screenCapture";
import toast from "react-hot-toast";
import type { IconType } from "react-icons";
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineBars3,
  HiOutlineBuildingOffice2,
  HiOutlineClock,
  HiOutlineHome,
  HiOutlineMoon,
  HiOutlineSun,
  HiOutlineUsers,
  HiOutlineViewColumns,
  HiOutlineXMark,
} from "react-icons/hi2";
import { logoutUser } from "@/store/slices/authSlice";
import { toggleTheme } from "@/store/slices/themeSlice";
import { useAppDispatch, useAppSelector } from "@/store/store";

const navItems: { label: string; href: string; icon: IconType }[] = [
  { label: "Overview", href: "/admin", icon: HiOutlineHome },
  { label: "Organizations", href: "/admin/organizations", icon: HiOutlineBuildingOffice2 },
  { label: "People", href: "/admin/users", icon: HiOutlineUsers },
  { label: "Tasks", href: "/admin/tasks", icon: HiOutlineViewColumns },
  { label: "Time logs", href: "/admin/time", icon: HiOutlineClock },
];

function isActive(href: string, pathname: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const navigate = usePageNavigation();
  const dispatch = useAppDispatch();
  const mode = useAppSelector((state) => state.theme.mode);
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  const openPage = (href: string, label: string) => (event: MouseEvent) => {
    if (pathname === href) return;
    event.preventDefault();
    navigate(href, label);
  };

  const handleLogout = async () => {
    stopScreenCapture();
    await dispatch(logoutUser());
    toast.success("Signed out");
    router.push("/login");
  };

  return (
    <>
      {mobileOpen ? (
        <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onClose} />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-full max-w-full flex-col border-r border-gray-200 bg-white transition-transform duration-200 dark:border-gray-800 dark:bg-gray-900 md:static md:h-screen md:w-64 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/admin" onClick={openPage("/admin", "Overview")} className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
              T
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-bold text-primary-600 dark:text-primary-400">Taskflow</span>
              <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Admin</span>
            </span>
          </Link>
          <button type="button" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:hidden dark:hover:bg-gray-800" onClick={onClose} aria-label="Close menu">
            <HiOutlineXMark className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {navItems.map((item) => {
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={openPage(item.href, item.label)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-gray-100 px-3 py-3 dark:border-gray-800">
          <p className="truncate px-3 pb-1 text-xs text-gray-500 dark:text-gray-400">
            {user ? `${user.firstName} ${user.lastName}` : "Admin"}
          </p>
          <button
            type="button"
            onClick={() => dispatch(toggleTheme())}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {mode === "dark" ? <HiOutlineSun className="h-5 w-5" /> : <HiOutlineMoon className="h-5 w-5" />}
            {mode === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-rose-50 hover:text-rose-600 dark:text-gray-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
          >
            <HiOutlineArrowRightOnRectangle className="h-5 w-5" />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = useCallback(() => setMobileOpen(false), []);
  const current = navItems.find((item) => isActive(item.href, pathname));

  return (
    <NavigationProvider>
      <div className="flex h-[100dvh] overflow-hidden bg-gray-50 dark:bg-gray-950 md:h-screen">
        <AdminSidebar mobileOpen={mobileOpen} onClose={close} />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
            <button
              type="button"
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden dark:text-gray-300 dark:hover:bg-gray-800"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <HiOutlineBars3 className="h-5 w-5" />
            </button>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white">{current?.label ?? "Admin"}</h1>
          </header>
          <main className="relative min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
          <PageLoadingOverlay />
        </div>
      </div>
    </NavigationProvider>
  );
}

export function AdminIntro({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  );
}
