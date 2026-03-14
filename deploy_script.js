import { execSync } from "child_process";
import fs from "fs";

try {
  console.log("Running firebase deploy...");
  const deployOutput = execSync("firebase.cmd deploy --only hosting", { encoding: "utf-8" });
  fs.writeFileSync("deploy_log.txt", deployOutput);
  console.log("Deploy Finished Successfully.");
} catch (e) {
  fs.writeFileSync("deploy_log.txt", "Deploy failed: " + e.message + "\n" + (e.stdout || e.stderr || ""));
}
