import "@/components/operations/operations.css";
import { SupplierProfileForm } from "@/components/operations/supplier-job-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { findSupplierByUser } from "@/lib/suppliers/profile";

export const metadata = { title: "Supplier profile" };

export default async function SupplierProfilePage() {
  const user = await requireUser(["SUPPLIER"]);
  const supplier = findSupplierByUser(getDb(), user.id);

  return (
    <main id="main">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Supplier workspace</p>
          <h1>Company profile</h1>
        </div>
      </div>
      {!supplier ? (
        <section className="panel">
          <p className="muted">
            No supplier profile is linked to this account.
          </p>
        </section>
      ) : (
        <>
          <section className="panel" aria-labelledby="company-heading">
            <h2 id="company-heading">Company</h2>
            <dl className="profile-grid">
              <div>
                <dt>Company</dt>
                <dd>{supplier.companyName}</dd>
              </div>
              <div>
                <dt>GSTIN</dt>
                <dd>{supplier.gstin || "Not added"}</dd>
              </div>
              <div>
                <dt>City</dt>
                <dd>{supplier.city || "Not added"}</dd>
              </div>
              <div>
                <dt>State</dt>
                <dd>{supplier.state || "Not added"}</dd>
              </div>
              <div>
                <dt>Verification</dt>
                <dd>
                  <StatusBadge status={supplier.verificationStatus} />
                </dd>
              </div>
            </dl>
          </section>
          <section className="panel" aria-labelledby="capabilities-heading">
            <h2 id="capabilities-heading">Capabilities</h2>
            <SupplierProfileForm capabilities={supplier.capabilities} />
          </section>
        </>
      )}
    </main>
  );
}
