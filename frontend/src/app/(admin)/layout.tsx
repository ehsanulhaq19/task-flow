"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import Loader from "@/components/Loader";
import { useAppSelector } from "@/store/store";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!token) router.replace("/login");
    else if (user && user.systemRole !== "admin") router.replace("/dashboard");
  }, [router, token, user]);

  if (!token || !user || user.systemRole !== "admin") return <Loader />;

  return <AdminShell>{children}</AdminShell>;
}
