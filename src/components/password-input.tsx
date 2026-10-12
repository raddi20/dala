"use client";

import { useState, type InputHTMLAttributes, type MouseEvent } from "react";

export type PasswordAutoComplete = "current-password" | "new-password";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "autoComplete"> & {
  name: string;
  autoComplete: PasswordAutoComplete;
};

/** Labels and input type for the show/hide control. Hidden until the button is pressed. */
export function passwordVisibility(visible: boolean): {
  inputType: "password" | "text";
  label: "Show password" | "Hide password";
  pressed: boolean;
} {
  if (visible) return { inputType: "text", label: "Hide password", pressed: true };
  return { inputType: "password", label: "Show password", pressed: false };
}

export function PasswordInput({ className = "", autoComplete, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const visibility = passwordVisibility(visible);

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setVisible((current) => !current);
  }

  return (
    <span className="relative mt-1 block">
      <input
        {...props}
        type={visibility.inputType}
        autoComplete={autoComplete}
        spellCheck={false}
        className={className}
        style={{ marginTop: 0, paddingRight: "3rem" }}
      />
      <button
        type="button"
        aria-label={visibility.label}
        aria-pressed={visibility.pressed}
        onClick={toggle}
        className="absolute top-1/2 right-0.5 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-[10px] text-muted hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lake"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </span>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3l18 18" />
      <path d="M10.6 6.2A9 9 0 0 1 12 6c6.5 0 10 6 10 6a18 18 0 0 1-3.1 4" />
      <path d="M6.2 6.2C3.6 8.1 2 12 2 12s3.5 7 10 7a9 9 0 0 0 4-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
