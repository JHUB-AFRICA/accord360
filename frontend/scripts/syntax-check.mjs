import { build } from "vite";

try {
  await build({
    logLevel: "silent",
    build: {
      write: false,
      emptyOutDir: false
    }
  });
  console.log("Accord360 JSX/JavaScript syntax check passed through the Vite compiler.");
} catch (error) {
  console.error("Accord360 syntax check failed.");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
}
