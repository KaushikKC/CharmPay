import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({
  label,
  error,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium mb-2 text-white/80">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-black border border-white/20 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-white/40 transition-colors ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}

