import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glass?: boolean;
}

export default function Card({ children, className = "", glass = false }: CardProps) {
  if (glass) {
    return (
      <div
        className={`border border-white/20 rounded-xl p-6 backdrop-blur-xl bg-white/5 shadow-lg ${className}`}
      >
        {children}
      </div>
    );
  }
  
  return (
    <div
      className={`border border-white/10 rounded-xl p-6 bg-black ${className}`}
    >
      {children}
    </div>
  );
}

