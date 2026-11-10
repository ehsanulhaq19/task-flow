type LoaderSize = "sm" | "md" | "lg";

interface LoaderProps {
  size?: LoaderSize;
  fullScreen?: boolean;
  label?: string;
}

const sizeClasses: Record<LoaderSize, string> = {
  sm: "h-6 w-6 border-2",
  md: "h-8 w-8 border-4",
  lg: "h-10 w-10 border-4",
};

export default function Loader({
  size = "lg",
  fullScreen = true,
  label = "Loading...",
}: LoaderProps) {
  return (
    <div
      className={
        fullScreen
          ? "flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950"
          : "flex items-center justify-center"
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className={`${sizeClasses[size]} animate-spin rounded-full border-primary-600 border-t-transparent`}
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      </div>
    </div>
  );
}
