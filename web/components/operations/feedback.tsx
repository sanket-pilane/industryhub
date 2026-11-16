export type Feedback = { kind: "error" | "success"; text: string } | null;

/** Inline result message: errors are alerts, successes are polite status text. */
export function FeedbackNote({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return feedback.kind === "error" ? (
    <p className="field-error" role="alert">
      {feedback.text}
    </p>
  ) : (
    <p className="info-note" role="status">
      {feedback.text}
    </p>
  );
}
