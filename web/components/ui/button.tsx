import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
type Variant = "primary" | "secondary" | "rfq";
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button className={`button button-${variant} ${className}`} {...props} />
  );
}
export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link className={`button button-${variant} ${className}`} {...props} />
  );
}
