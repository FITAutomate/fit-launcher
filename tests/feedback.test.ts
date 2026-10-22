import { test, expect } from "vitest";
import { feedbackIssueUrl } from "../src/main/feedback";

const environment = {
  version: "0.1.0-preview.3",
  windows: "10.0.26300",
  arch: "x64",
};
const feedback = {
  type: "Problem",
  where: "Ports",
  impact: "can continue",
  what: "Refresh stalled & the list did not update.\nExpected a fresh snapshot.",
};
test("feedback opens this repository with encoded typed fields and limited environment data", () => {
  const url = new URL(feedbackIssueUrl(feedback, environment));
  expect(url.origin + url.pathname).toBe(
    "https://github.com/FITAutomate/fit-launcher/issues/new",
  );
  expect(url.searchParams.get("title")).toBe(
    "[Problem] Refresh stalled & the list did not update.",
  );
  expect(url.searchParams.get("body")).toContain("**Where were you:** Ports");
  expect(url.searchParams.get("body")).toContain(feedback.what);
  expect(url.searchParams.get("body")).toContain(
    "FIT Launcher: 0.1.0-preview.3",
  );
  expect(url.searchParams.get("body")).toContain("Windows: 10.0.26300 (x64)");
  expect([...url.searchParams.keys()]).toEqual(["title", "body"]);
});
test("invalid fields, empty text and extra machine data are rejected", () => {
  for (const input of [
    { ...feedback, type: "Execute" },
    { ...feedback, where: "private path" },
    { ...feedback, what: "  " },
    { ...feedback, logs: "private log contents" },
  ])
    expect(() => feedbackIssueUrl(input, environment)).toThrow();
});
test("long and Unicode feedback cannot create an oversized URL or silently lose text", () => {
  expect(() =>
    feedbackIssueUrl({ ...feedback, what: "界".repeat(6000) }, environment),
  ).toThrow("too long for a GitHub link");
  const input = { ...feedback, what: "A".repeat(6000) };
  const url = new URL(feedbackIssueUrl(input, environment));
  expect(url.href.length).toBeLessThanOrEqual(7000);
  expect(url.searchParams.get("body")).toContain(input.what);
});
