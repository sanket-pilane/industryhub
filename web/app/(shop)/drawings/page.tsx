import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth/session";
import { formatBytes } from "@/lib/drawings/rules";
import { getDrawingStore } from "@/lib/drawings/store";

export const metadata = { title: "My drawings" };

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function Drawings() {
  const user = await requireUser(["CUSTOMER"]);
  const drawings = await getDrawingStore().listForCustomer(user.id);
  return (
    <main id="main" className="container workspace-page">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Custom manufacturing</p>
          <h1>My drawings</h1>
          <p>Drawings you have submitted for quotation, newest first.</p>
        </div>
        <LinkButton href="/upload-drawing">Upload drawing</LinkButton>
      </div>
      <section className="panel">
        {drawings.length === 0 ? (
          <div className="empty-state">
            <h2>No drawings yet</h2>
            <p>Upload a CAD drawing to request a production quotation.</p>
            <LinkButton href="/upload-drawing">
              Upload your first drawing
            </LinkButton>
          </div>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Submitted drawings"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th className="quote-id">Request</th>
                  <th>Part</th>
                  <th>Drawing file</th>
                  <th>Qty</th>
                  <th>Process</th>
                  <th>Target date</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Download</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {drawings.map((d) => (
                  <tr key={d.id}>
                    <td className="quote-id">
                      <Link className="table-link" href={`/drawings/${d.id}`}>
                        {d.id}
                      </Link>
                    </td>
                    <td>
                      {d.partName}
                      <span className="table-sub">
                        Rev {d.revision} · {d.material}
                      </span>
                    </td>
                    <td>
                      {d.file.name}
                      <span className="table-sub">
                        {formatBytes(d.file.size)}
                      </span>
                    </td>
                    <td>{d.quantity}</td>
                    <td>{d.process}</td>
                    <td>{dateFormat.format(new Date(d.targetDate))}</td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                    <td>
                      <a
                        className="table-link"
                        href={`/api/drawings/${d.id}/file`}
                      >
                        Download
                      </a>
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
