import Link from "next/link";
import type { UserProfile } from "../../../shared/contracts";
import { Brand } from "@/components/ui/brand";
import { SignOut } from "@/components/auth/sign-out";
import { HeaderSearch, SiteNav } from "./site-nav";

export function SiteHeader({ user }: { user: UserProfile }) {
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
          <SiteNav />
          <HeaderSearch />
          <div className="header-user-area">
            <Link
              className="header-link"
              href="/account"
              title={`${user.companyName} · Account`}
              aria-label={`Account: ${user.firstName} ${user.lastName}`}
            >
              <span className="avatar">{user.initials}</span>
              <span className="header-user">{user.firstName}</span>
            </Link>
            <SignOut />
          </div>
        </div>
      </header>
    </>
  );
}
