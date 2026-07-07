import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary";
type ButtonSize = "default" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-primary)] text-white hover:-translate-y-0.5 hover:bg-[var(--primary-dark)] hover:shadow-[0_12px_28px_rgba(26,92,46,0.22)]",
  secondary:
    "border border-[var(--color-border)] bg-white text-[var(--color-text)] hover:-translate-y-0.5 hover:border-[var(--color-primary-lt)] hover:bg-[var(--color-primary-bg)] hover:text-[var(--color-primary)]",
};

const sizes: Record<ButtonSize, string> = {
  default: "h-10 px-5",
  icon: "h-10 w-10 px-0",
};

export function Button({
  className = "",
  size = "default",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-btn)] text-sm font-bold shadow-none transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
