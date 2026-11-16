import Link from "next/link";
import { DrawingUploadForm } from "@/components/drawings/drawing-upload-form";

export const metadata = { title: "Upload Drawing" };

const steps = [
  ["Upload", "Drawing and part details"],
  ["Engineering review", "Feasibility and clarifications"],
  ["Quotation", "Price, GST and lead time"],
  ["Production", "Verified manufacturing partner"],
  ["QC and delivery", "Inspection report and dispatch"],
];

export default function UploadDrawing() {
  return (
    <main id="main" className="container workspace-page">
      <div className="page-title">
        <div>
          <p className="eyebrow text-brand">Custom manufacturing</p>
          <h1>Upload a drawing</h1>
          <p>
            Send your CAD drawing and requirements to get a production
            quotation.
          </p>
        </div>
        <Link className="button button-secondary" href="/drawings">
          My drawings
        </Link>
      </div>
      <div className="upload-layout">
        <section className="panel" aria-label="Drawing upload">
          <DrawingUploadForm />
        </section>
        <aside className="panel upload-aside" aria-label="How it works">
          <h2>How it works</h2>
          <ol className="upload-steps">
            {steps.map(([title, text]) => (
              <li key={title}>
                <strong>{title}</strong>
                <span>{text}</span>
              </li>
            ))}
          </ol>
          <h2>Accepted files</h2>
          <p className="muted">
            PDF, DWG, DXF, STEP and STP, up to 50 MB. Files are checked for a
            valid format and stored privately; only you and the assigned
            engineering team can access them.
          </p>
        </aside>
      </div>
    </main>
  );
}
