import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <path
        d="M8.5 16.2 22.2 9.4c.7-.35 1.4.35 1.05 1.05L16.8 23.6c-.4.8-1.55.7-1.8-.15l-1.5-5.15-5.15-1.5c-.85-.25-.95-1.4-.15-1.8Z"
        className="fill-accent-fg"
      />
      <path
        d="M13.6 18.3 22 11.2"
        className="stroke-accent"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
