import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import process from "node:process";

const root = resolve(process.cwd());
const sourceRoot = join(root, "src");
const allowedExtensions = [".js", ".jsx", ".mjs", ".json"];
const failures = [];

function walk(folder) {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) return true;
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, ...allowedExtensions.map((ext) => `${base}${ext}`), ...allowedExtensions.map((ext) => join(base, `index${ext}`))];
  return candidates.some(existsSync);
}

for (const file of walk(sourceRoot).filter((path) => [".js", ".jsx", ".mjs"].includes(extname(path)))) {
  const content = readFileSync(file, "utf8");
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (!resolveImport(file, match[1])) failures.push(`${relative(root, file)} imports missing module ${match[1]}`);
    }
  }

  const forbidden = [
    ["AI does not hallucinate records", "unsafe absolute AI claim"],
    ["we guarantee compliance", "unapproved compliance guarantee"],
    ["Linkages & State Corporations", "obsolete directorate name"]
  ];
  for (const [text, label] of forbidden) {
    if (content.toLowerCase().includes(text.toLowerCase())) failures.push(`${relative(root, file)} contains ${label}`);
  }
}

const requiredFiles = [
  "src/App.jsx",
  "src/lib/api.js",
  "src/lib/mockApi.js",
  "src/lib/workflow.js",
  "src/context/AuthContext.jsx",
  "src/pages/PartnerPortal.jsx",
  "src/pages/SixMonthReport.jsx",
  "src/pages/Scorecards.jsx",
  "BACKEND_API_CONTRACT.md",
  "DEVELOPER_HANDOFF.md",
  "QUALITY_REPORT.md"
];
for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`Required file missing: ${file}`);
}

if (failures.length) {
  console.error("Accord360 frontend validation failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Accord360 frontend validation passed (${walk(sourceRoot).length} source files checked).`);
