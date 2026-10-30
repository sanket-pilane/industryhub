"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="standalone-state">
      <h1>We couldn’t load this page.</h1>
      <p>Check the application configuration and try again.</p>
      <div className="button-row">
        <button className="button button-primary" onClick={reset}>
          Try again
        </button>
        <Link className="button button-secondary" href="/">
          Return home
        </Link>
      </div>
    </main>
  );
}
