"use client";

import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { useController, useFormContext } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ProfileContent } from "@/types/profile";

/**
 * Small wrappers that connect the shared form to the design-system inputs, so
 * each profile step reads as a list of fields instead of repeated plumbing.
 * `name` is a path into the profile, like `personal.currentAddress.city`.
 */

type FieldName = string;

const idFor = (name: FieldName) => `pf-${name.replace(/[.[\]]+/g, "-")}`;

interface BaseProps {
  name: FieldName;
  label: string;
  description?: string;
  className?: string;
}

function useProfileField(name: FieldName) {
  const { control } = useFormContext<ProfileContent>();
  // The path is built at runtime, so the typed overloads can't follow it.
  return useController({ name: name as never, control });
}

interface TextFieldProps extends BaseProps {
  placeholder?: string;
  type?: "text" | "email" | "tel" | "date";
  inputMode?: "numeric" | "text" | "tel";
  autoComplete?: string;
  maxLength?: number;
  /** Applied to what is typed, for example to upper-case an IFSC. */
  transform?: (value: string) => string;
  max?: string;
  min?: string;
  disabled?: boolean;
}

export function TextField({
  name,
  label,
  description,
  className,
  placeholder,
  type = "text",
  inputMode,
  autoComplete = "off",
  maxLength,
  transform,
  max,
  min,
  disabled,
}: TextFieldProps) {
  const { field, fieldState } = useProfileField(name);
  return (
    <Field data-invalid={fieldState.invalid} className={className}>
      <FieldLabel htmlFor={idFor(name)}>{label}</FieldLabel>
      <Input
        {...field}
        value={(field.value as string | undefined) ?? ""}
        onChange={(event) => field.onChange(transform ? transform(event.target.value) : event.target.value)}
        id={idFor(name)}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        placeholder={placeholder}
        max={max}
        min={min}
        disabled={disabled}
        aria-invalid={fieldState.invalid}
      />
      {fieldState.invalid ? (
        <FieldError errors={[fieldState.error]} />
      ) : (
        description && <FieldDescription>{description}</FieldDescription>
      )}
    </Field>
  );
}

interface TextAreaFieldProps extends BaseProps {
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}

export function TextAreaField({ name, label, description, className, placeholder, rows = 3, maxLength }: TextAreaFieldProps) {
  const { field, fieldState } = useProfileField(name);
  const length = ((field.value as string | undefined) ?? "").length;
  return (
    <Field data-invalid={fieldState.invalid} className={className}>
      <FieldLabel htmlFor={idFor(name)}>{label}</FieldLabel>
      <Textarea
        {...field}
        value={(field.value as string | undefined) ?? ""}
        id={idFor(name)}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={fieldState.invalid}
      />
      {fieldState.invalid ? (
        <FieldError errors={[fieldState.error]} />
      ) : (
        (description || maxLength) && (
          <FieldDescription className="flex justify-between gap-3">
            <span>{description}</span>
            {maxLength && (
              <span className="tabular-nums">
                {length}/{maxLength}
              </span>
            )}
          </FieldDescription>
        )
      )}
    </Field>
  );
}

interface SelectFieldProps extends BaseProps {
  options: readonly (string | { value: string; label: string })[];
  placeholder?: string;
  /** Lets the person clear an optional choice. */
  clearLabel?: string;
}

export function SelectField({ name, label, description, className, options, placeholder = "Choose", clearLabel }: SelectFieldProps) {
  const { field, fieldState } = useProfileField(name);
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <Field data-invalid={fieldState.invalid} className={className}>
      <FieldLabel htmlFor={idFor(name)}>{label}</FieldLabel>
      <Select
        value={(field.value as string | undefined) ?? ""}
        onValueChange={(value) => field.onChange(value === "__none" ? "" : value)}
      >
        <SelectTrigger id={idFor(name)} className="w-full" aria-invalid={fieldState.invalid} onBlur={field.onBlur}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {clearLabel && <SelectItem value="__none">{clearLabel}</SelectItem>}
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {fieldState.invalid ? (
        <FieldError errors={[fieldState.error]} />
      ) : (
        description && <FieldDescription>{description}</FieldDescription>
      )}
    </Field>
  );
}

interface CheckFieldProps {
  name: FieldName;
  label: string;
  className?: string;
  onChange?: (checked: boolean) => void;
}

export function CheckField({ name, label, className, onChange }: CheckFieldProps) {
  const { field } = useProfileField(name);
  return (
    <label htmlFor={idFor(name)} className={cn("flex cursor-pointer items-center gap-2.5 text-sm text-foreground", className)}>
      <Checkbox
        id={idFor(name)}
        checked={Boolean(field.value)}
        onCheckedChange={(checked) => {
          field.onChange(checked === true);
          onChange?.(checked === true);
        }}
      />
      {label}
    </label>
  );
}

/** Type a skill and press Enter or comma to add it as a chip. */
export function SkillsField({ name, label, description, className }: BaseProps) {
  const { field, fieldState } = useProfileField(name);
  const [draft, setDraft] = useState("");
  const skills = (field.value as string[] | undefined) ?? [];

  const add = (raw: string) => {
    const next = raw.trim();
    if (!next) return;
    if (skills.some((s) => s.toLowerCase() === next.toLowerCase())) {
      setDraft("");
      return;
    }
    field.onChange([...skills, next.slice(0, 40)]);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && skills.length) {
      field.onChange(skills.slice(0, -1));
    }
  };

  return (
    <Field data-invalid={fieldState.invalid} className={className}>
      <FieldLabel htmlFor={idFor(name)}>{label}</FieldLabel>
      <Input
        id={idFor(name)}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          add(draft);
          field.onBlur();
        }}
        autoComplete="off"
        placeholder="For example, React, Payroll, Negotiation"
        aria-invalid={fieldState.invalid}
      />
      {skills.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Skills added">
          {skills.map((skill) => (
            <li
              key={skill}
              className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-2.5 text-xs font-medium text-accent-foreground"
            >
              {skill}
              <button
                type="button"
                onClick={() => field.onChange(skills.filter((s) => s !== skill))}
                aria-label={`Remove ${skill}`}
                className="grid size-4 place-items-center rounded-full hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {fieldState.invalid ? (
        <FieldError errors={[fieldState.error]} />
      ) : (
        description && <FieldDescription>{description}</FieldDescription>
      )}
    </Field>
  );
}
