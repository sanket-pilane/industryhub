import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireUser } from "@/lib/auth/session";
import "../workspace.css";

export default async function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser(["SUPPLIER"]);
  return (
    <WorkspaceShell
      user={user}
      title="Supplier"
      home="/supplier"
      links={[
        { href: "/supplier", label: "Jobs", exact: true },
        { href: "/supplier/profile", label: "Profile" },
      ]}
    >
      {children}
    </WorkspaceShell>
  );
}
