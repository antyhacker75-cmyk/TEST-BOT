const { spawn } = require('child_process');
const path = require('path');
const { botModel } = require('./firebase.js');

const botProcesses = new Map();

async function startBotProcess(botId) {
    try {
        const bot = await botModel.getById(botId);
        if (!bot) throw new Error('Bot not found');
        if (botProcesses.has(botId)) throw new Error('Bot is already running');

        console.log(`[BOT MANAGER] Starting bot ${botId} (${bot.botName})`);

        // Ensure fbstate is a stringified JSON
        let fbstateString = bot.fbstate;
        if (typeof fbstateString === 'object') {
            fbstateString = JSON.stringify(fbstateString);
        }

        const env = {
            ...process.env,
            BOT_ID: botId,
            BOT_OWNER: bot.ownerFbid,
            BOT_FBSTATE: fbstateString,
            IS_BOT_PROCESS: 'true'
        };

        const child = spawn('node', ['Goat.js'], {
            cwd: process.cwd(),
            env: env,
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
            detached: false
        });

        child.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            for (const line of lines) {
                console.log(`[BOT ${botId}] ${line}`);
            }
        });

        child.stderr.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            for (const line of lines) {
                console.error(`[BOT ${botId}] ${line}`);
            }
        });

        child.on('close', async (code) => {
            console.log(`[BOT ${botId}] Process exited with code ${code}`);
            botProcesses.delete(botId);
            await botModel.update(botId, { running: false, pid: null });
        });

        child.on('error', async (err) => {
            console.error(`[BOT ${botId}] Error:`, err);
            botProcesses.delete(botId);
            await botModel.update(botId, { running: false, pid: null });
        });

        botProcesses.set(botId, child);
        await botModel.update(botId, { running: true, pid: child.pid });

        return { success: true, message: 'Bot started', pid: child.pid };
    } catch (err) {
        console.error(`[BOT MANAGER] Failed to start bot ${botId}:`, err);
        return { success: false, error: err.message };
    }
}

async function stopBotProcess(botId) {
    try {
        const child = botProcesses.get(botId);
        if (!child) {
            const bot = await botModel.getById(botId);
            if (bot && bot.running) {
                await botModel.update(botId, { running: false, pid: null });
                return { success: true, message: 'Bot marked as stopped' };
            }
            throw new Error('Bot is not running');
        }

        child.kill('SIGTERM');
        const exitPromise = new Promise((resolve) => child.once('close', resolve));
        const timeoutPromise = new Promise((resolve) => setTimeout(() => {
            if (!child.killed) child.kill('SIGKILL');
            resolve();
        }, 5000));
        await Promise.race([exitPromise, timeoutPromise]);

        botProcesses.delete(botId);
        await botModel.update(botId, { running: false, pid: null });
        return { success: true, message: 'Bot stopped' };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function getRunningBots() {
    const status = [];
    for (const [id, child] of botProcesses) {
        status.push({ id, pid: child.pid, running: !child.killed });
    }
    return status;
}

async function restoreRunningBots() {
    try {
        const runningBots = await botModel.getRunning();
        console.log(`[BOT MANAGER] Found ${runningBots.length} bots to restore`);
        for (const bot of runningBots) {
            console.log(`[BOT MANAGER] Restoring bot ${bot.id} (${bot.botName})`);
            await startBotProcess(bot.id);
        }
    } catch (err) {
        console.error('[BOT MANAGER] Failed to restore bots:', err);
    }
}

module.exports = { startBotProcess, stopBotProcess, getRunningBots, restoreRunningBots, botProcesses };
