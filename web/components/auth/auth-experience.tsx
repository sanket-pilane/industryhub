"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { LoginForm } from "./login-form";
import { SignupForm } from "./signup-form";
import { AuthVisual } from "./auth-visual";

type Mode = "login" | "signup";
const titles: Record<Mode, string> = {
  login: "Sign in | INDUSTRIHUB",
  signup: "Create account | INDUSTRIHUB",
};

/**
 * Both forms stay mounted; the image panel slides over the inactive one.
 * Switching uses history.pushState (synced with usePathname by Next) so the
 * URL changes without a navigation and the transition is never interrupted.
 */
export function AuthExperience() {
  const mode: Mode = usePathname().startsWith("/signup") ? "signup" : "login";
  const headings = useRef<Record<Mode, HTMLHeadingElement | null>>({
    login: null,
    signup: null,
  });
  const switched = useRef(false);

  useEffect(() => {
    document.title = titles[mode];
    if (switched.current)
      headings.current[mode]?.focus({ preventScroll: true });
  }, [mode]);

  const switchTo = (next: Mode) => (event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    switched.current = true;
    window.history.pushState(null, "", `/${next}`);
  };
  return (
    <main className="auth-page" id="main">
      <div className="auth-card" data-mode={mode}>
        <section
          className="auth-pane auth-pane-login"
          data-active={mode === "login"}
          inert={mode !== "login"}
          aria-labelledby="login-heading"
        >
          <div className="auth-pane-head">
            <h1
              id="login-heading"
              tabIndex={-1}
              ref={(el) => {
                headings.current.login = el;
              }}
            >
              Welcome back
            </h1>
            <p>
              New to INDUSTRIHUB?{" "}
              <a href="/signup" onClick={switchTo("signup")}>
                Create an account
              </a>
            </p>
          </div>
          <LoginForm />
        </section>
        <section
          className="auth-pane auth-pane-signup"
          data-active={mode === "signup"}
          inert={mode !== "signup"}
          aria-labelledby="signup-heading"
        >
          <div className="auth-pane-head">
            <h1
              id="signup-heading"
              tabIndex={-1}
              ref={(el) => {
                headings.current.signup = el;
              }}
            >
              Create an account
            </h1>
            <p>
              Already have an account?{" "}
              <a href="/login" onClick={switchTo("login")}>
                Log in
              </a>
            </p>
          </div>
          <SignupForm />
        </section>
        <AuthVisual />
      </div>
      <p className="auth-page-note">
        Payments run through the test-mode gateway · No real money is charged.
      </p>
    </main>
  );
}
