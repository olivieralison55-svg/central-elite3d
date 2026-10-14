"use client";

import { Search } from "lucide-react";

/** Rounded search field (dash-ref-01 topbar). */
export default function SearchInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      className={`flex items-center gap-2 rounded-md border border-line bg-background px-4 py-2.5 text-sm transition focus-within:border-line-strong ${className}`}
    >
      <Search size={16} className="shrink-0 text-muted" />
      <input
        type="search"
        className="w-full bg-transparent text-ink outline-none placeholder:text-muted"
        {...props}
      />
    </label>
  );
}
