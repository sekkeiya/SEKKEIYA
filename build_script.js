import { execSync } from "child_process";
import fs from "fs";

try {
  console.log("Removing node_modules/sekkeiya-global-panel...");
  fs.rmSync("node_modules/sekkeiya-global-panel", { recursive: true, force: true });
  
  console.log("Running npm install...");
  const installOutput = execSync("npm i", { encoding: "utf-8", stdio: "inherit" });
  console.log(installOutput);

  console.log("Running npm run build...");
  const buildOutput = execSync("npm run build", { encoding: "utf-8", stdio: "inherit" });
  console.log(buildOutput);

  console.log("Build Finished Successfully.");
} catch (e) {
  console.error("Build failed: ", e.message);
}
