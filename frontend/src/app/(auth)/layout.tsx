"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Loader from "@/components/Loader";
import { homePath } from "@/lib/user";
import { useAppSelector } from "@/store/store";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (token && user) router.replace(homePath(user));
  }, [router, token, user]);

  if (token && user) return <Loader />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center sm:mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Taskflow</h1>
          <p className="mt-2 text-sm text-primary-200 sm:text-base">Tasks and time, in one place</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
