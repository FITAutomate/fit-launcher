import { FeedbackSchema } from "../shared/feedback";

export function feedbackIssueUrl(
  input: unknown,
  environment: { version: string; windows: string; arch: string },
): string {
  const value = FeedbackSchema.parse(input);
  const summary = value.what.split(/\r?\n/)[0].slice(0, 70);
  const body = `**Type:** ${value.type}\n**Where were you:** ${value.where}\n**Impact:** ${value.impact}\n\n### What happened?\n${value.what}\n\n### Environment\nFIT Launcher: ${environment.version}\nWindows: ${environment.windows} (${environment.arch})\n\n---\nOpened from FIT Launcher's feedback form. Review before submitting.`;
  const url =
    "https://github.com/FITAutomate/fit-launcher/issues/new?" +
    new URLSearchParams({ title: `[${value.type}] ${summary}`, body });
  if (url.length > 7000)
    throw Error(
      "Feedback is too long for a GitHub link. Use a shorter summary; you can add more details on GitHub before submitting.",
    );
  return url;
}
