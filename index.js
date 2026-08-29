/**
 * RENZ MESSENGER BOT V3
 * Entry point for Render deployment
 */

const log = require("./logger/log.js");

async function startProject() {
    console.log('[MAIN] Starting RENZ MESSENGER BOT V3...');
    try {
        // Import and call the dashboard server starter
        const startDashboard = require("./dashboard/app.js");
        await startDashboard();
        console.log('[MAIN] Dashboard started successfully.');
    } catch (error) {
        console.error('[MAIN] Failed to start dashboard:', error);
        log.error(`Project exited with error: ${error.message}`);
        setTimeout(() => startProject(), 5000);
    }
}

startProject();
