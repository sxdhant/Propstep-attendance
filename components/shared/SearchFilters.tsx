"use client";

import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder = "Search", ariaLabel, className }: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="h-9 [&::-webkit-search-cancel-button]:hidden pr-8 pl-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: FilterOption[];
  ariaLabel: string;
  className?: string;
}

export function FilterSelect({ value, onValueChange, options, ariaLabel, className }: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger aria-label={ariaLabel} className={cn("h-9 w-full sm:w-auto sm:min-w-40", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface SearchFiltersProps {
  children: ReactNode;
  /** Shows a "Clear filters" button when true. */
  active?: boolean;
  onClear?: () => void;
  className?: string;
}

/** One left-aligned row of filters above the content they scope. */
export function SearchFilters({ children, active, onClear, className }: SearchFiltersProps) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      {children}
      {active && onClear && (
        <Button type="button" variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
          <X className="size-3.5" aria-hidden />
          Clear filters
        </Button>
      )}
    </div>
  );
}
