"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type WorkspaceLink = { href: string; label: string; exact?: boolean };

export function WorkspaceNav({
  links,
  label,
}: {
  links: WorkspaceLink[];
  label: string;
}) {
  const pathname = usePathname();
  return (
    <nav className="ws-nav" aria-label={label}>
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
