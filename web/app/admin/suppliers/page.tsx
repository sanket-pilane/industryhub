import { SupplierVerifyButtons } from "@/components/operations/admin-forms";
import "@/components/operations/operations.css";
import { StatusBadge } from "@/components/ui/status-badge";
import { listSuppliers } from "@/lib/admin/suppliers";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";

export const metadata = { title: "Suppliers" };

export default async function AdminSuppliersPage() {
  await requireUser(["ADMIN"]);
  const suppliers = listSuppliers(getDb());

  return (
    <main id="main">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Admin workspace</p>
          <h1>Suppliers</h1>
          <p>Verify manufacturing partners before they can be assigned jobs.</p>
        </div>
      </div>
      <section className="panel" aria-labelledby="suppliers-heading">
        <h2 id="suppliers-heading">All suppliers ({suppliers.length})</h2>
        {suppliers.length === 0 ? (
          <div className="empty-state">
            <h2>No suppliers yet</h2>
            <p>Suppliers appear here after they register.</p>
          </div>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Suppliers"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>City</th>
                  <th>Capabilities</th>
                  <th>Verification</th>
                  <th>Jobs</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.companyName}
                      <span className="table-sub">
                        {s.id} · GSTIN {s.gstin || "not added"}
                      </span>
                    </td>
                    <td>
                      {s.city || "Not added"}
                      {s.state && <span className="table-sub">{s.state}</span>}
                    </td>
                    <td className="op-detail-cell">
                      {s.capabilities || "Not added"}
                    </td>
                    <td>
                      <StatusBadge status={s.verificationStatus} />
                    </td>
                    <td>{s.jobCount}</td>
                    <td>
                      <SupplierVerifyButtons
                        supplierId={s.id}
                        status={s.verificationStatus}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
