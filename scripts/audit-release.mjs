import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import { listPackage, extractFile } from "@electron/asar";

const pkg = JSON.parse(await fs.readFile("package.json", "utf8"));
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const allowed =
  /^(?:src\/|resources\/|scripts\/|tests\/|docs\/|\.github\/workflows\/|(?:package(?:-lock)?|tsconfig)\.json$|(?:forge\.config\.cjs|(?:playwright|vitest)\.config\.ts|README\.md|CONTRIBUTING\.md|LICENSE|\.gitignore|\.gitattributes|\.prettierignore)$)/;
const privatePatterns = [
  /[A-Z]:[\\/](?:Users|dev|fit-automate-org|Vaults)[\\/]/i,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
function scan(name, buffer) {
  const text = buffer.toString("utf8");
  for (const pattern of privatePatterns)
    if (pattern.test(text))
      throw Error("Private path or credential pattern in " + name);
}
for (const name of files) {
  if (!allowed.test(name))
    throw Error("Unexpected public source file: " + name);
  if (
    /(?:task.*\.xml|\.env|\.log|\.bak|workspace\.json|layout\.json)$/i.test(
      name,
    )
  )
    throw Error("Personal/generated file: " + name);
  if (!name.endsWith(".ico")) scan(name, await fs.readFile(name));
}
const output = path.resolve(
  "out",
  `FIT-Launcher-${pkg.version}-windows-x64.zip`,
);
const zip = new AdmZip(output),
  entries = zip.getEntries();
for (const entry of entries) {
  const name = entry.entryName;
  if (!/^FIT Launcher\/(?:app\/|LICENSE\.txt$|START HERE\.txt$)/.test(name))
    throw Error("Unexpected release member: " + name);
  if (/\/(?:data|backups|logs|session|\.git)\//i.test(name))
    throw Error("Private/generated directory: " + name);
  if (/\.(?:ps1|yaml|json|txt|md)$/.test(name) && !entry.isDirectory)
    scan(name, entry.getData());
}
const asarEntry = zip.getEntry("FIT Launcher/app/resources/app.asar");
if (!asarEntry) throw Error("Missing packaged application");
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "fit-audit-"));
try {
  const asar = path.join(temp, "app.asar");
  await fs.writeFile(asar, asarEntry.getData());
  const contents = listPackage(asar);
  for (const member of contents) {
    const file = member.replaceAll("\\", "/");
    if (
      /^\/(?:dist|node_modules)(?:\/|$)|^\/(?:package.json|LICENSE)$/.test(
        file,
      ) === false
    )
      throw Error("Unexpected ASAR source: " + file);
    if (file.startsWith("/dist/") && /\.(?:cjs|js|css|html|map)$/.test(file))
      scan(file, extractFile(asar, member.slice(1)));
  }
  console.log("Audited ASAR members:", contents.length);
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
const hash = createHash("sha256")
  .update(await fs.readFile(output))
  .digest("hex");
const expected = (await fs.readFile(output + ".sha256", "utf8")).split(/\s/)[0];
if (hash !== expected) throw Error("Checksum mismatch");
console.log(
  `PASS: ${files.length} public source files, ${entries.length} ZIP members; no bundled personal profile; SHA256 ${hash}`,
);
