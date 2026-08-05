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

const directNetworkAllowed = new Set([
  "src/lib/api.js",
  "src/lib/backend.js",
  "src/lib/mockApi.js"
]);

for (const file of walk(sourceRoot).filter((path) => [".js", ".jsx", ".mjs"].includes(extname(path)))) {
  const content = readFileSync(file, "utf8");
  const relativePath = relative(root, file).replaceAll("\\", "/");
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (!resolveImport(file, match[1])) failures.push(`${relativePath} imports missing module ${match[1]}`);
    }
  }

  const forbiddenCopy = [
    ["AI does not hallucinate records", "unsafe absolute AI claim"],
    ["we guarantee compliance", "unapproved compliance guarantee"],
    ["Linkages & State Corporations", "obsolete directorate name"]
  ];
  for (const [text, label] of forbiddenCopy) {
    if (content.toLowerCase().includes(text.toLowerCase())) failures.push(`${relativePath} contains ${label}`);
  }

  if (!directNetworkAllowed.has(relativePath) && /\b(api|apiJson|downloadFile)\s*\(/.test(content)) {
    failures.push(`${relativePath} bypasses the centralized backend contract wrapper`);
  }
}

const backendContent = readFileSync(join(root, "src/lib/backend.js"), "utf8");
const unsupportedBackendPaths = [
  "/dashboard\"",
  "/directory/champions",
  "/configuration",
  "/templates",
  "/reference-data",
  "/corrections",
  "/scorecards",
  "/reports/portfolio",
  "/reports/ai-summary",
  "/reports/export.pdf",
  "/reports/export.xlsx",
  "/auth/forgot-password",
  "/auth/register-partner",
  "/me/reports",
  "/resend",
  "/actions/"
];
for (const value of unsupportedBackendPaths) {
  if (backendContent.includes(value)) failures.push(`src/lib/backend.js contains unsupported endpoint fragment ${value}`);
}

const requiredBackendPaths = [
  "/auth/login", "/auth/me", "/users", "/users/champions", "/partners", "/agreements",
  "/transition", "/documents", "/deliverables", "/values", "/dashboard/workspace",
  "/dashboard/stats", "/notifications", "/reports/agreements.csv", "/reports/audit"
];
for (const value of requiredBackendPaths) {
  if (!backendContent.includes(value)) failures.push(`src/lib/backend.js is missing implemented endpoint ${value}`);
}

const rolesContent = readFileSync(join(root, "src/lib/roles.js"), "utf8");
if (/\bpartner\s*:/.test(rolesContent)) failures.push("src/lib/roles.js contains unsupported partner authentication role");

const envContent = readFileSync(join(root, ".env.example"), "utf8");
if (!envContent.includes("VITE_API_URL=http://127.0.0.1:8000/api")) failures.push(".env.example does not use the documented local API base URL");
if (!envContent.includes("VITE_USE_MOCK_API=false")) failures.push(".env.example must default to real backend mode");

const requiredFiles = [
  "src/App.jsx",
  "src/lib/api.js",
  "src/lib/backend.js",
  "src/lib/mockApi.js",
  "src/lib/normalize.js",
  "src/lib/workflow.js",
  "src/context/AuthContext.jsx",
  "src/pages/SixMonthReport.jsx",
  "src/pages/Scorecards.jsx",
  "API_ENDPOINTS.md",
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

console.log(`Accord360 frontend validation passed (${walk(sourceRoot).length} source files checked; API contract alignment enforced).`);
