import type { IconType } from "react-icons";
import { cardClass } from "@/constants/ui";

type StatCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: IconType;
  accent: string;
};

export default function StatCard({ label, value, hint, icon: Icon, accent }: StatCardProps) {
  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-start gap-4">
        <div className={`rounded-lg p-3 ${accent}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{hint}</p>
        </div>
      </div>
    </div>
  );
}
