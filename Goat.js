/**
 * RENZ MESSENGER BOT V3 - Bot Process
 * This file runs as a child process for each bot
 */

const fs = require("fs-extra");
const path = require("path");
const { promisify } = require("util");
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// ===== CHECK IF THIS IS A BOT PROCESS =====
if (!process.env.IS_BOT_PROCESS && !process.env.BOT_ID) {
    console.log('[BOT] Not a bot process, exiting...');
    process.exit(0);
}

const BOT_ID = process.env.BOT_ID;
const BOT_OWNER = process.env.BOT_OWNER;
const BOT_FBSTATE = process.env.BOT_FBSTATE;

console.log(`[BOT] Starting bot ${BOT_ID} (child process)`);
console.log(`[BOT] Owner: ${BOT_OWNER}`);

// ===== LOAD CONFIG =====
const configPath = path.join(__dirname, process.env.NODE_ENV === 'development' ? 'config.dev.json' : 'config.json');
let config = {};
try {
    config = require(configPath);
    console.log(`[BOT] Config loaded`);
} catch (err) {
    console.error(`[BOT] Failed to load config:`, err.message);
    config = { prefix: "$", language: "en", nameBot: "RENZ BOT" };
}

// ===== SETUP GLOBAL =====
global.GoatBot = {
    config: config,
    commands: new Map(),
    eventCommands: new Map(),
    aliases: new Map(),
    fcaApi: null,
    botID: BOT_ID,
    botName: config.nameBot || "RENZ BOT",
    prefix: config.prefix || "$",
    language: config.language || "en",
    startTime: Date.now()
};

// ===== LOAD UTILITIES =====
try {
    const utils = require("./utils.js");
    global.utils = utils;
    console.log(`[BOT] Utilities loaded`);
} catch (err) {
    console.warn(`[BOT] utils.js not found, using fallback`);
    global.utils = {
        log: {
            info: console.log,
            warn: console.warn,
            error: console.error
        },
        convertTime: (ms) => {
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            if (days > 0) return `${days}d ${hours % 24}h`;
            if (hours > 0) return `${hours}h ${minutes % 60}m`;
            if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
            return `${seconds}s`;
        }
    };
}

// ===== LOAD FIREBASE =====
const { botModel } = require('./dashboard/firebase.js');

// ===== LOGIN FUNCTION =====
async function loginBot() {
    try {
        const { login } = require("fcanew-r3nz75");

        let fbstate = null;

        if (BOT_FBSTATE) {
            try {
                fbstate = JSON.parse(BOT_FBSTATE);
                console.log(`[BOT] Loaded fbstate from environment`);
            } catch (parseError) {
                console.error(`[BOT] Failed to parse fbstate JSON:`, parseError.message);
                process.exit(1);
            }
        } else {
            console.log(`[BOT] Loading fbstate from Firebase for bot ${BOT_ID}`);
            const bot = await botModel.getById(BOT_ID);
            if (!bot) {
                console.error(`[BOT] Bot ${BOT_ID} not found in Firebase`);
                process.exit(1);
            }
            fbstate = bot.fbstate;
            if (typeof fbstate === 'string') {
                try {
                    fbstate = JSON.parse(fbstate);
                    console.log(`[BOT] Parsed fbstate from Firebase`);
                } catch (e) {
                    console.error(`[BOT] Invalid fbstate format in Firebase`);
                    process.exit(1);
                }
            }
        }

        if (!fbstate || !Array.isArray(fbstate) || fbstate.length === 0) {
            console.error(`[BOT] Invalid fbstate`);
            process.exit(1);
        }

        console.log(`[BOT] Logging in...`);
        const api = await login({
            appState: fbstate,
            logLevel: 'error',
            forceLogin: true,
            listenEvents: true,
            updatePresence: true,
            listenTyping: true,
            autoMarkDelivery: true,
            autoReconnect: true
        });

        global.GoatBot.fcaApi = api;
        global.GoatBot.botID = api.getCurrentUserID();

        try {
            const botInfo = await api.getUserInfo(global.GoatBot.botID);
            if (botInfo && botInfo[global.GoatBot.botID]) {
                global.GoatBot.botName = botInfo[global.GoatBot.botID].name || config.nameBot || "RENZ BOT";
                console.log(`[BOT] Logged in as: ${global.GoatBot.botName} (${global.GoatBot.botID})`);
            } else {
                console.log(`[BOT] Logged in with ID: ${global.GoatBot.botID}`);
            }
        } catch (err) {
            console.log(`[BOT] Logged in with ID: ${global.GoatBot.botID}`);
        }

        // Mark bot as running in Firebase
        await botModel.update(BOT_ID, { running: true });

        // ===== LOAD COMMANDS =====
        await loadCommands(api);

        // ===== LOAD EVENTS =====
        await loadEvents(api);

        // ===== START LISTENING =====
        await startListening(api);

        return api;

    } catch (err) {
        console.error(`[BOT] Login failed:`, err.message);
        console.error(err.stack);
        setTimeout(() => {
            console.log(`[BOT] Retrying login...`);
            loginBot();
        }, 5000);
    }
}

// ================================================================
// ===== LOAD COMMANDS (Multi‑Path) =====
// ================================================================

async function loadCommands(api) {
    // List of possible command folder paths (in order of priority)
    const possiblePaths = [
        path.join(__dirname, 'scripts', 'cmds'),    // Your actual location
        path.join(__dirname, 'commands'),           // Alternative
        path.join(__dirname, 'cmds'),               // Alternative
        path.join(__dirname, 'bot', 'commands')     // Alternative
    ];

    let foundPath = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            foundPath = p;
            console.log(`[BOT] Found commands at: ${p}`);
            break;
        }
    }

    if (!foundPath) {
        console.log(`[BOT] No commands folder found`);
        return;
    }

    try {
        const files = await readdir(foundPath);
        let loadedCount = 0;
        let failedCount = 0;

        for (const file of files) {
            if (!file.endsWith('.js')) continue;

            const filePath = path.join(foundPath, file);
            try {
                // Clear require cache to load fresh
                delete require.cache[require.resolve(filePath)];
                const command = require(filePath);
                
                if (command.config && command.config.name) {
                    global.GoatBot.commands.set(command.config.name, command);
                    
                    if (command.config.aliases && Array.isArray(command.config.aliases)) {
                        for (const alias of command.config.aliases) {
                            global.GoatBot.aliases.set(alias, command.config.name);
                        }
                    }
                    loadedCount++;
                } else {
                    console.warn(`[BOT] Command ${file} missing config.name`);
                    failedCount++;
                }
            } catch (err) {
                console.error(`[BOT] Failed to load command ${file}:`, err.message);
                failedCount++;
            }
        }

        console.log(`[BOT] Loaded ${loadedCount} commands (${failedCount} failed)`);
        
        if (loadedCount > 0) {
            const names = Array.from(global.GoatBot.commands.keys()).slice(0, 10);
            console.log(`[BOT] Commands: ${names.join(', ')}${global.GoatBot.commands.size > 10 ? '...' : ''}`);
        }
    } catch (err) {
        console.error(`[BOT] Failed to read commands folder:`, err.message);
    }
}

// ================================================================
// ===== LOAD EVENTS (Multi‑Path) =====
// ================================================================

async function loadEvents(api) {
    const possiblePaths = [
        path.join(__dirname, 'scripts', 'events'),
        path.join(__dirname, 'events'),
        path.join(__dirname, 'bot', 'events')
    ];

    let foundPath = null;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            foundPath = p;
            console.log(`[BOT] Found events at: ${p}`);
            break;
        }
    }

    if (!foundPath) {
        console.log(`[BOT] No events folder found`);
        return;
    }

    try {
        const files = await readdir(foundPath);
        let loadedCount = 0;

        for (const file of files) {
            if (!file.endsWith('.js')) continue;

            const filePath = path.join(foundPath, file);
            try {
                delete require.cache[require.resolve(filePath)];
                const event = require(filePath);
                
                if (event.config && event.config.name) {
                    global.GoatBot.eventCommands.set(event.config.name, event);
                    loadedCount++;
                }
            } catch (err) {
                console.error(`[BOT] Failed to load event ${file}:`, err.message);
            }
        }

        console.log(`[BOT] Loaded ${loadedCount} events`);
    } catch (err) {
        console.error(`[BOT] Failed to read events folder:`, err.message);
    }
}

// ===== START LISTENING =====
async function startListening(api) {
    api.listenMqtt(async (err, event) => {
        if (err) {
            console.error(`[BOT] MQTT Error:`, err.message);
            return;
        }

        if (event.type === 'message') {
            console.log(`[BOT] 📩 Message from ${event.senderID}: ${event.body?.substring(0, 50) || '(no text)'}`);
        }

        await handleEvent(api, event);
    });

    console.log(`[BOT] Listening for messages...`);
}

// ===== HANDLE EVENTS =====
async function handleEvent(api, event) {
    try {
        // Process event commands
        for (const [name, eventCmd] of global.GoatBot.eventCommands) {
            try {
                if (eventCmd.onEvent) {
                    await eventCmd.onEvent({ api, event, ...eventCmd.config });
                }
            } catch (err) {
                console.error(`[BOT] Event command ${name} error:`, err.message);
            }
        }

        // Handle message commands
        if (event.type === 'message' && event.body) {
            const prefix = global.GoatBot.prefix;
            
            if (!event.body.startsWith(prefix)) return;

            const args = event.body.slice(prefix.length).trim().split(/\s+/);
            const commandName = args.shift().toLowerCase();

            let command = global.GoatBot.commands.get(commandName);
            if (!command) {
                const aliasTarget = global.GoatBot.aliases.get(commandName);
                if (aliasTarget) {
                    command = global.GoatBot.commands.get(aliasTarget);
                }
            }

            if (command) {
                console.log(`[BOT] 🎯 Executing command: ${commandName} from ${event.senderID}`);
                try {
                    const context = {
                        api,
                        event,
                        message: {
                            reply: async (text) => {
                                console.log(`[BOT] 💬 Replying to ${event.senderID}: ${text?.substring(0, 50) || ''}`);
                                return api.sendMessage(text, event.threadID);
                            },
                            react: async (emoji) => {
                                return api.setMessageReaction(emoji, event.messageID, event.threadID);
                            }
                        },
                        usersData: null,  // If needed, load from database
                        threadsData: null,
                        args,
                        commandName
                    };

                    await command.onStart(context);
                } catch (err) {
                    console.error(`[BOT] ❌ Command ${commandName} error:`, err.message);
                    console.error(err.stack);
                    try {
                        api.sendMessage(`⚠️ Error: ${err.message}`, event.threadID);
                    } catch (e) {}
                }
            } else {
                if (event.body.startsWith(prefix)) {
                    console.log(`[BOT] ❓ Unknown command: ${commandName}`);
                }
            }
        }
    } catch (err) {
        console.error(`[BOT] Event handler error:`, err.message);
        console.error(err.stack);
    }
}

// ===== START BOT =====
process.on('SIGTERM', () => {
    console.log(`[BOT] Received SIGTERM, shutting down...`);
    botModel.update(BOT_ID, { running: false, pid: null }).catch(() => {});
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log(`[BOT] Received SIGINT, shutting down...`);
    botModel.update(BOT_ID, { running: false, pid: null }).catch(() => {});
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`[BOT] Unhandled Rejection:`, reason);
});

console.log(`[BOT] Starting RENZ MESSENGER BOT V3...`);
console.log(`[BOT] Using Node.js ${process.version}`);
console.log(`[BOT] Starting as bot ${BOT_ID} (owner: ${BOT_OWNER})`);
loginBot().catch(err => {
    console.error(`[BOT] Fatal error:`, err);
    process.exit(1);
});
