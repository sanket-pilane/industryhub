import Link from "next/link";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="INDUSTRIHUB home">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>INDUSTRIHUB</span>
    </Link>
  );
}
