import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone-state">
      <p className="eyebrow text-brand">404 · Page not found</p>
      <h1>This page isn’t available.</h1>
      <p>Explore the current INDUSTRIHUB demo.</p>
      <Link className="button button-primary" href="/">
        Return home
      </Link>
    </main>
  );
}
