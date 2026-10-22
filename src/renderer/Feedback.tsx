import React from "react";
import {
  feedbackTypes,
  feedbackAreas,
  feedbackImpacts,
  type FeedbackInput,
} from "../shared/feedback";
import { Modal } from "./ui";

export default function Feedback({
  where,
  version,
  onClose,
}: {
  where: FeedbackInput["where"];
  version: string;
  onClose: () => void;
}) {
  const [value, setValue] = React.useState<FeedbackInput>({
    type: "Problem",
    where,
    impact: "can continue",
    what: "",
  });
  const [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await window.launcher.feedback(value);
      onClose();
    } catch (error) {
      setError(
        String(error).includes("Feedback is too long")
          ? "Feedback is too long for a GitHub link. Use a shorter summary; you can add more details on GitHub before submitting."
          : "Could not open your browser. Your feedback is still here; please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Send feedback" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="muted">
          Opens a pre-filled issue in the FIT Launcher GitHub repository. Review
          and submit it in your browser using your own GitHub account.
        </p>
        <label>
          Type
          <select
            aria-label="Type"
            value={value.type}
            onChange={(event) =>
              setValue({
                ...value,
                type: feedbackTypes[event.target.selectedIndex],
              })
            }
          >
            {feedbackTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          Where were you?
          <select
            aria-label="Where were you?"
            value={value.where}
            onChange={(event) =>
              setValue({
                ...value,
                where: feedbackAreas[event.target.selectedIndex],
              })
            }
          >
            {feedbackAreas.map((area) => (
              <option key={area}>{area}</option>
            ))}
          </select>
        </label>
        <label>
          Impact
          <select
            aria-label="Impact"
            value={value.impact}
            onChange={(event) =>
              setValue({
                ...value,
                impact: feedbackImpacts[event.target.selectedIndex],
              })
            }
          >
            {feedbackImpacts.map((impact) => (
              <option key={impact}>{impact}</option>
            ))}
          </select>
        </label>
        <label>
          What happened?
          <textarea
            autoFocus
            required
            rows={5}
            maxLength={6000}
            value={value.what}
            onChange={(event) => {
              setValue({ ...value, what: event.target.value });
              setError("");
            }}
            placeholder="What were you doing, what happened, and what did you expect?"
          />
        </label>
        <p className="muted">
          Includes app version {version} and Windows version. Launcher does not
          attach your workspace, paths or logs, or store GitHub sign-in details.
          Feedback is public when you submit it.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Open GitHub issue →
          </button>
        </div>
      </form>
    </Modal>
  );
}
