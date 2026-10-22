import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
const pkg = JSON.parse(await fs.readFile("package.json", "utf8"));
const source = path.resolve("out", "FIT Launcher-win32-x64");
await fs.access(path.join(source, "FIT Launcher.exe"));
const target = path.resolve("portable", "FIT Launcher");
await fs.mkdir(target, { recursive: true });
await fs.cp(source, path.join(target, "app"), { recursive: true, force: true });
await fs.copyFile("LICENSE", path.join(target, "LICENSE.txt"));
await fs.writeFile(
  path.join(target, "START HERE.txt"),
  "FIT Launcher " +
    pkg.version +
    "\r\n\r\nExtract this whole folder. Open app\\FIT Launcher.exe.\r\nThe app creates a sibling data folder. Update only app; keep data.\r\nNo Node, Git, npm or administrator installer is required.\r\nThis preview is unsigned. Follow your Windows security policy.\r\nSource: https://github.com/FITAutomate/fit-launcher\r\n",
);
const zip = new AdmZip();
zip.addLocalFolder(path.join(target, "app"), "FIT Launcher/app");
for (const name of ["LICENSE.txt", "START HERE.txt"])
  zip.addLocalFile(path.join(target, name), "FIT Launcher");
const output = path.resolve(
  "out",
  `FIT-Launcher-${pkg.version}-windows-x64.zip`,
);
zip.writeZip(output);
const hash = createHash("sha256")
  .update(await fs.readFile(output))
  .digest("hex");
await fs.writeFile(
  output + ".sha256",
  hash + "  " + path.basename(output) + "\n",
);
console.log(output + "\nSHA256 " + hash);
