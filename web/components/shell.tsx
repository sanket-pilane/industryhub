import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { Brand } from "./ui/brand";
import { SignOut } from "./auth/sign-out";
export async function Shell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="utility-bar">
        <div className="container flex justify-between gap-4">
          <span>
            Free shipping above ₹25,000 · Net-30 terms for qualified B2B
            accounts
          </span>
          <span>ISO 9001 suppliers · Quote response within 24 hours</span>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav className="header-nav" aria-label="Sections">
            <Link href="/#categories">Categories</Link>
            <Link href="/#featured">Featured</Link>
            <Link href="/#resources">Manufacturing</Link>
          </nav>
          <div className="header-actions">
            {user && (
              <>
                <span className="header-link" title={user.companyName}>
                  <span className="avatar">{user.initials}</span>
                  <span className="header-user">{user.firstName}</span>
                </span>
                <SignOut />
              </>
            )}
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
