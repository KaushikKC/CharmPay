import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  children: React.ReactNode;
}

export default function Button({
  variant = "primary",
  children,
  className = "",
  ...props
}: ButtonProps) {
  const baseStyles = "px-6 py-3 rounded-lg font-medium transition-colors cursor-pointer hover:font-bold";
  
  const variants = {
    primary: "bg-white text-black hover:bg-white/90",
    secondary: "bg-black border border-white/20 text-white hover:bg-white/5",
    outline: "border border-white/20 text-white hover:bg-white/5",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

