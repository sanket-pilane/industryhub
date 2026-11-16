import Link from "next/link";
import type { UserProfile } from "../../../shared/contracts";
import { SignOut } from "@/components/auth/sign-out";
import { WorkspaceNav, type WorkspaceLink } from "./workspace-nav";

/**
 * Shared frame for the supplier and admin workspaces: top bar with the
 * signed-in user, side navigation, and the page content.
 */
export function WorkspaceShell({
  user,
  title,
  home,
  links,
  children,
}: {
  user: UserProfile;
  title: string;
  home: string;
  links: WorkspaceLink[];
  children: React.ReactNode;
}) {
  return (
    <div className="ws">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="ws-top">
        <Link href={home} className="brand" aria-label={`${title} home`}>
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>INDUSTRIHUB</span>
        </Link>
        <span className="ws-role">{title}</span>
        <div className="ws-user">
          <span className="avatar" aria-hidden="true">
            {user.initials}
          </span>
          <span className="ws-user-name">
            {user.firstName} {user.lastName}
            <small>{user.companyName}</small>
          </span>
          <SignOut />
        </div>
      </header>
      <div className="ws-body">
        <WorkspaceNav links={links} label={`${title} navigation`} />
        <div className="ws-content">{children}</div>
      </div>
    </div>
  );
}
