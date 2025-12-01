import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export const GlassCard = ({ children, className, hover = false }: GlassCardProps) => {
  return (
    <div
      className={cn(
        "glass-card p-6",
        hover && "hover:shadow-2xl hover:-translate-y-1 transition-all duration-300",
        className
      )}
    >
      {children}
    </div>
  );
};
