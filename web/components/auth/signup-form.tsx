"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { ApiResponse } from "../../../shared/contracts";

// Prefixed because the login form is mounted on the same page.
const id = (name: string) => `signup-${name}`;

export function SignupForm({ defaults }: { defaults?: Partial<SignupInput> }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    mode: "onBlur",
    defaultValues: { terms: false, ...defaults },
  });
  const submit = async (data: SignupInput) => {
    setError("");
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result: ApiResponse<{ signedIn: boolean }> = await response.json();
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Unable to connect. Check your connection and try again.");
    }
  };
  const text = (
    name: "firstName" | "lastName" | "companyName" | "email",
    label: string,
    autoComplete: string,
    type = "text",
  ) => (
    <div className="field">
      <label htmlFor={id(name)}>{label}</label>
      <input
        id={id(name)}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? id(`${name}-error`) : undefined}
        className="plain-input"
        {...register(name)}
      />
      {errors[name] && (
        <p className="field-error" id={id(`${name}-error`)}>
          {errors[name]?.message}
        </p>
      )}
    </div>
  );
  const password = (
    name: "password" | "confirmPassword",
    label: string,
    autoComplete: string,
  ) => (
    <div className="field">
      <label htmlFor={id(name)}>{label}</label>
      <div className="input-with-icon">
        <Icon name="lock" />
        <input
          id={id(name)}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={!!errors[name]}
          aria-describedby={
            errors[name]
              ? id(`${name}-error`)
              : name === "password"
                ? id("password-hint")
                : undefined
          }
          {...register(name)}
        />
        {name === "password" && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
          >
            {show ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {errors[name] && (
        <p className="field-error" id={id(`${name}-error`)}>
          {errors[name]?.message}
        </p>
      )}
    </div>
  );
  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="login-form">
      <div className="field-row">
        {text("firstName", "First name", "given-name")}
        {text("lastName", "Last name", "family-name")}
      </div>
      {text("companyName", "Company name", "organization")}
      {text("email", "Work email", "email", "email")}
      <div className="field-row">
        {password("password", "Password", "new-password")}
        {password("confirmPassword", "Confirm password", "new-password")}
      </div>
      {!errors.password && (
        <p className="field-hint" id={id("password-hint")}>
          At least 8 characters, with a letter and a number.
        </p>
      )}
      <div className="field">
        <label className="remember-label">
          <input
            type="checkbox"
            aria-describedby={errors.terms ? id("terms-error") : undefined}
            {...register("terms")}
          />
          <span className="checkbox-mark">
            <Icon name="check" />
          </span>
          I agree to the Terms of Service and Privacy Policy
        </label>
        {errors.terms && (
          <p className="field-error" id={id("terms-error")}>
            {errors.terms.message}
          </p>
        )}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="sign-in-button" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create Account"}
      </Button>
    </form>
  );
}
