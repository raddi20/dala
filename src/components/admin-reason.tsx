import { fieldClass } from "@/components/ui";

/** Reason typed by an admin. Required for takedown and restore. */
export function ReasonInput({ id, required = true }: { id: string; required?: boolean }) {
  return (
    <label htmlFor={id} className="grid min-w-48 flex-1 gap-1 text-sm text-ink/80">
      Reason
      <input
        id={id}
        name="reason"
        required={required}
        minLength={required ? 3 : undefined}
        maxLength={500}
        placeholder={required ? "Why" : "Optional note"}
        className={fieldClass}
      />
    </label>
  );
}
