import type { User } from "@/types";

export function homePath(user: Pick<User, "systemRole"> | null | undefined) {
  return user?.systemRole === "admin" ? "/admin" : "/dashboard";
}

export function fullName(user: Pick<User, "firstName" | "lastName">) {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function initials(user: Pick<User, "firstName" | "lastName">) {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
}
