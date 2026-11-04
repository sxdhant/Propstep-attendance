import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

type NumberInputProps = Omit<ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  /** `NaN` means "empty", which is how a cleared field is represented. */
  value: number;
  onChange: (value: number) => void;
};

/** A numeric field whose value is a real `number`, so forms and schemas never juggle strings. */
export function NumberInput({ value, onChange, ...props }: NumberInputProps) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      value={Number.isNaN(value) ? "" : value}
      onChange={(event) => onChange(event.target.value === "" ? NaN : event.target.valueAsNumber)}
      {...props}
    />
  );
}
