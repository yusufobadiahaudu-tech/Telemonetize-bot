import { Mark } from "@/components/logo";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Avatar({
  name,
  bot,
  size = "md",
}: {
  name: string;
  bot?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? "size-8" : size === "lg" ? "size-12" : "size-10";
  if (bot) {
    return (
      <span className={cn("shrink-0 overflow-hidden rounded-full", dim)}>
        <Mark className="size-full rounded-none" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-elevated font-display font-semibold text-accent",
        dim,
        size === "sm" ? "text-[11px]" : "text-sm",
      )}
    >
      {initials(name)}
    </span>
  );
}
