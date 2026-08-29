/**
 * RENZ MESSENGER BOT V3
 * Entry point for Render deployment
 */

const { spawn } = require("child_process");
const log = require("./logger/log.js");

function startProject() {
  console.log('[MAIN] Starting RENZ MESSENGER BOT V3...');
  
  // Start Goat.js (main process)
  const child = spawn("node", ["Goat.js"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      IS_MAIN_PROCESS: 'true'
    }
  });

  child.on("close", (code) => {
    console.log(`[MAIN] Goat.js exited with code ${code}`);
    if (code == 2) {
      log.info("Restarting Project...");
      startProject();
    } else if (code != 0) {
      log.error(`Project exited with code ${code}`);
      setTimeout(() => startProject(), 5000);
    }
  });
}

startProject();