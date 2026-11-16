import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireUser } from "@/lib/auth/session";
import "../workspace.css";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser(["ADMIN"]);
  return (
    <WorkspaceShell
      user={user}
      title="Admin"
      home="/admin"
      links={[
        { href: "/admin", label: "Dashboard", exact: true },
        { href: "/admin/requests", label: "Requests" },
        { href: "/admin/jobs", label: "Jobs" },
        { href: "/admin/orders", label: "Orders" },
        { href: "/admin/catalog", label: "Catalog" },
        { href: "/admin/suppliers", label: "Suppliers" },
        { href: "/admin/audit", label: "Audit log" },
      ]}
    >
      {children}
    </WorkspaceShell>
  );
}
