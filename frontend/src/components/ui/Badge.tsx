import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "active" | "cancelled" | "completed" | "pending";
  className?: string;
}

export default function Badge({
  children,
  variant = "active",
  className = "",
}: BadgeProps) {
  const variants = {
    active: "bg-white/10 text-white border-white/20",
    cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
    completed: "bg-green-500/20 text-green-400 border-green-500/30",
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

