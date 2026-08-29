/**
 * RENZ MESSENGER BOT V3
 * Entry point for Render deployment
 */

const { spawn } = require("child_process");
const log = require("./logger/log.js");

function startProject() {
  const child = spawn("node", ["Goat.js"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: true
  });

  child.on("close", (code) => {
    if (code == 2) {
      log.info("Restarting Project...");
      startProject();
    } else if (code != 0) {
      log.error(`Project exited with code ${code}`);
      // Don't restart immediately to avoid crash loops
      setTimeout(() => startProject(), 5000);
    }
  });
}

startProject();