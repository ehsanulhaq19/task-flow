"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Loader from "@/components/Loader";
import { homePath } from "@/lib/user";
import { useAppSelector } from "@/store/store";

export default function Home() {
  const router = useRouter();
  const { token, user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    router.replace(token ? homePath(user) : "/login");
  }, [router, token, user]);

  return <Loader />;
}
