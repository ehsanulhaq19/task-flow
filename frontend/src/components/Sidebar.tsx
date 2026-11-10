"use client";

import { useEffect, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePageNavigation } from "@/components/navigation";
import { stopScreenCapture } from "@/services/screenCapture";
import toast from "react-hot-toast";
import type { IconType } from "react-icons";
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineChevronDoubleLeft,
  HiOutlineChevronDoubleRight,
  HiOutlineCog6Tooth,
  HiOutlineHome,
  HiOutlineMoon,
  HiOutlineSun,
  HiOutlineViewColumns,
  HiOutlineXMark,
} from "react-icons/hi2";
import { logoutUser } from "@/store/slices/authSlice";
import { toggleTheme } from "@/store/slices/themeSlice";
import { useAppDispatch, useAppSelector } from "@/store/store";

type NavItem = { label: string; href: string; icon: IconType };

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: HiOutlineHome },
  { label: "Tasks", href: "/tasks", icon: HiOutlineViewColumns },
  { label: "Settings", href: "/settings", icon: HiOutlineCog6Tooth },
];

function pathMatches(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SidebarProps = {
  mobileOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export default function Sidebar({
  mobileOpen = false,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navigate = usePageNavigation();
  const dispatch = useAppDispatch();
  const mode = useAppSelector((state) => state.theme.mode);

  useEffect(() => {
    onClose?.();
  }, [pathname, onClose]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onClose]);

  const handleLogout = async () => {
    stopScreenCapture();
    await dispatch(logoutUser());
    toast.success("Signed out");
    router.push("/login");
  };

  const openPage = (href: string, label: string) => (event: MouseEvent) => {
    if (pathname === href) return;
    event.preventDefault();
    navigate(href, label);
  };

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      collapsed ? "md:justify-center md:gap-0 md:px-2" : ""
    } ${
      active
        ? "bg-primary-50 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400"
        : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
    }`;

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => onClose?.()}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-full max-w-full shrink-0 flex-col border-r border-gray-200 bg-white transition-[width,transform] duration-200 ease-out dark:border-gray-800 dark:bg-gray-900 md:static md:h-screen md:max-w-none ${
          collapsed ? "md:w-16" : "md:w-64"
        } ${mobileOpen ? "translate-x-0 shadow-xl md:shadow-none" : "-translate-x-full md:translate-x-0"}`}
      >
        <div
          className={`flex items-center gap-2 border-b border-gray-100 px-4 py-4 dark:border-gray-800 md:border-0 ${
            collapsed ? "md:justify-center md:px-2" : ""
          }`}
        >
          <Link
            href="/dashboard"
            className={`flex min-w-0 flex-1 items-center gap-2 ${collapsed ? "md:justify-center" : ""}`}
            aria-label="Taskflow home"
            onClick={openPage("/dashboard", "Dashboard")}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
              T
            </span>
            <span
              className={`truncate text-xl font-bold text-primary-600 dark:text-primary-400 ${
                collapsed ? "md:hidden" : ""
              }`}
            >
              Taskflow
            </span>
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
            onClick={() => onClose?.()}
            aria-label="Close menu"
          >
            <HiOutlineXMark className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col space-y-1 overflow-y-auto px-3 pt-2">
          {navItems.map((item) => {
            const active = pathMatches(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={linkClass(active)}
                aria-label={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
                onClick={openPage(item.href, item.label)}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-1 border-t border-gray-100 px-3 pb-4 pt-3 dark:border-gray-800">
          <button
            type="button"
            onClick={() => dispatch(toggleTheme())}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 ${
              collapsed ? "md:justify-center md:px-2" : ""
            }`}
            aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={mode === "dark" ? "Light mode" : "Dark mode"}
          >
            {mode === "dark" ? (
              <HiOutlineSun className="h-5 w-5 shrink-0" />
            ) : (
              <HiOutlineMoon className="h-5 w-5 shrink-0" />
            )}
            <span className={collapsed ? "md:hidden" : ""}>
              {mode === "dark" ? "Light mode" : "Dark mode"}
            </span>
          </button>

          <button
            type="button"
            className="hidden w-full items-center justify-center rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 md:flex"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <HiOutlineChevronDoubleRight className="h-5 w-5" />
            ) : (
              <HiOutlineChevronDoubleLeft className="h-5 w-5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400 ${
              collapsed ? "md:justify-center md:px-2" : ""
            }`}
            aria-label="Log out"
            title="Log out"
          >
            <HiOutlineArrowRightOnRectangle className="h-5 w-5 shrink-0" />
            <span className={collapsed ? "md:hidden" : ""}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
