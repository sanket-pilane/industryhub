"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { ApiResponse } from "../../../shared/contracts";
const SAMPLE_ACCOUNTS = [
  { role: "Customer", email: "srushti.shinde@apexmotion.in" },
  { role: "Supplier", email: "rohan.patil@precisionworks.in" },
  { role: "Admin", email: "operations@industrihub.in" },
] as const;
const SAMPLE_PASSWORD = "Industrihub@123";

export function LoginForm({ defaults }: { defaults?: Partial<LoginInput> }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [help, setHelp] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true, ...defaults },
  });
  const submit = async (data: LoginInput) => {
    setError("");
    try {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result: ApiResponse<{ signedIn: boolean; home: string }> =
        await response.json();
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      router.push(result.data.home);
      router.refresh();
    } catch {
      setError("Unable to connect. Check your connection and try again.");
    }
  };
  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="login-form">
      <div className="field">
        <label htmlFor="login-email">Work email</label>
        <div className="input-with-icon">
          <Icon name="user" />
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p className="field-error" id="login-email-error">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="login-password">Password</label>
        <div className="input-with-icon">
          <Icon name="lock" />
          <input
            id="login-password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={
              errors.password ? "login-password-error" : undefined
            }
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
        {errors.password && (
          <p className="field-error" id="login-password-error">
            {errors.password.message}
          </p>
        )}
      </div>
      <div className="login-options">
        <label className="remember-label">
          <input type="checkbox" {...register("remember")} />
          <span className="checkbox-mark">
            <Icon name="check" />
          </span>
          Remember me
        </label>
        <button
          type="button"
          onClick={() => setHelp(!help)}
          aria-expanded={help}
        >
          Forgot password?
        </button>
      </div>
      {help && (
        <p className="info-note" role="status">
          Contact your INDUSTRIHUB administrator at operations@industrihub.in to
          reset your password.
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="sign-in-button" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign In Securely"}
      </Button>
      <details className="demo-credentials">
        <summary>Sample accounts</summary>
        <p>
          Password for all: <code>{SAMPLE_PASSWORD}</code>
        </p>
        <ul className="sample-accounts">
          {SAMPLE_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => {
                  setValue("email", account.email, { shouldValidate: true });
                  setValue("password", SAMPLE_PASSWORD, {
                    shouldValidate: true,
                  });
                }}
              >
                <strong>{account.role}</strong> {account.email}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </form>
  );
}
