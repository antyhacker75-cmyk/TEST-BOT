/**
 * @author R3nz75
 * RENZ MESSENGER BOT V3
 * Official source code: https://github.com/renz2451/MESSENGER-CHAT-BOT-V3
 */

const fs = require("fs-extra");
const path = require("path");
const { promisify } = require("util");
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

// ===== LOAD CONFIG =====
const configPath = path.join(__dirname, process.env.NODE_ENV === 'development' ? 'config.dev.json' : 'config.json');
const config = require(configPath);

// ===== SETUP GLOBAL =====
global.GoatBot = {
  config: config,
  configCommands: require(path.join(__dirname, process.env.NODE_ENV === 'development' ? 'configCommands.dev.json' : 'configCommands.json')),
  commands: new Map(),
  eventCommands: new Map(),
  aliases: new Map(),
  fcaApi: null,
  botID: null,
  botName: config.nameBot || "RENZ BOT",
  prefix: config.prefix || "$",
  language: config.language || "en",
  startTime: Date.now()
};

// ===== LOAD UTILITIES =====
const utils = require("./utils.js");
global.utils = utils;
global.log = utils.log;

// ===== SETUP DATABASE =====
const db = require("./database/controller/index.js");

// ===== LOAD FIREBASE =====
const { botModel, userModel } = require('./dashboard/firebase.js');

// ===== BOT ID FROM ENVIRONMENT =====
const BOT_ID = process.env.BOT_ID || null;
const BOT_OWNER = process.env.BOT_OWNER || null;
const BOT_FBSTATE = process.env.BOT_FBSTATE || null;
const IS_CHILD_PROCESS = !!process.env.BOT_ID;

console.log(`[BOT] Starting bot${BOT_ID ? ` ${BOT_ID}` : ''} (${IS_CHILD_PROCESS ? 'child process' : 'main process'})`);

// ===== LOGIN FUNCTION =====
async function loginBot() {
  try {
    const { login } = require("fcanew-r3nz75");
    
    let fbstate = null;

    // If we're a child process with a specific bot ID, get fbstate from Firebase
    if (IS_CHILD_PROCESS && BOT_ID) {
      console.log(`[BOT] Loading fbstate from Firebase for bot ${BOT_ID}`);
      const bot = await botModel.getById(BOT_ID);
      if (!bot) {
        console.error(`[BOT] Bot ${BOT_ID} not found in Firebase`);
        process.exit(1);
      }
      fbstate = bot.fbstate;
      console.log(`[BOT] Loaded fbstate from Firebase for bot ${BOT_ID}`);
    } else {
      // For main process (dashboard), we don't log in as a bot
      console.log('[BOT] Main process - not logging in as bot');
      return null;
    }

    if (!fbstate) {
      console.error('[BOT] No fbstate found in Firebase');
      process.exit(1);
    }

    // Parse fbstate if it's a string
    if (typeof fbstate === 'string') {
      try {
        fbstate = JSON.parse(fbstate);
      } catch (e) {
        console.error('[BOT] Invalid fbstate format');
        process.exit(1);
      }
    }

    if (!Array.isArray(fbstate)) {
      console.error('[BOT] Invalid fbstate format - must be an array');
      process.exit(1);
    }

    // Login with fbstate
    console.log('[BOT] Logging in...');
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

    // Get bot info - using the correct method for this FCA version
    try {
      // Try to get user info from the API
      const botInfo = await api.getUserInfo(api.getCurrentUserID());
      const userId = api.getCurrentUserID();
      if (botInfo && botInfo[userId]) {
        global.GoatBot.botID = userId;
        global.GoatBot.botName = botInfo[userId].name || config.nameBot || "RENZ BOT";
        console.log(`[BOT] Logged in as: ${global.GoatBot.botName} (${global.GoatBot.botID})`);
      } else {
        global.GoatBot.botID = api.getCurrentUserID();
        console.log(`[BOT] Logged in as: ${global.GoatBot.botID}`);
      }
    } catch (err) {
      // Fallback to getCurrentUserID
      global.GoatBot.botID = api.getCurrentUserID();
      console.log(`[BOT] Logged in with ID: ${global.GoatBot.botID}`);
    }

    // ===== LOAD COMMANDS =====
    await loadCommands(api);

    // ===== START LISTENING =====
    await startListening(api);

    return api;

  } catch (err) {
    console.error('[BOT] Login failed:', err.message);
    if (!IS_CHILD_PROCESS) {
      console.log('[BOT] Main process continuing without bot login...');
      return null;
    }
    setTimeout(() => {
      console.log('[BOT] Retrying login...');
      loginBot();
    }, 5000);
  }
}

// ===== LOAD COMMANDS =====
async function loadCommands(api) {
  const commandsPath = path.join(__dirname, 'commands');
  if (!fs.existsSync(commandsPath)) {
    console.log('[BOT] No commands folder found');
    return;
  }

  const commandFolders = await readdir(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const statInfo = await stat(folderPath);
    
    if (!statInfo.isDirectory()) continue;

    const commandFiles = await readdir(folderPath);
    for (const file of commandFiles) {
      if (!file.endsWith('.js')) continue;

      try {
        const command = require(path.join(folderPath, file));
        if (command.config && command.config.name) {
          global.GoatBot.commands.set(command.config.name, command);
          
          if (command.config.aliases) {
            for (const alias of command.config.aliases) {
              global.GoatBot.aliases.set(alias, command.config.name);
            }
          }
          console.log(`[BOT] Loaded command: ${command.config.name}`);
        }
      } catch (err) {
        console.error(`[BOT] Failed to load command ${file}:`, err.message);
      }
    }
  }

  console.log(`[BOT] Loaded ${global.GoatBot.commands.size} commands`);
}

// ===== START LISTENING =====
async function startListening(api) {
  // Load event handlers
  const eventsPath = path.join(__dirname, 'events');
  if (fs.existsSync(eventsPath)) {
    const eventFiles = await readdir(eventsPath);
    for (const file of eventFiles) {
      if (!file.endsWith('.js')) continue;
      try {
        const event = require(path.join(eventsPath, file));
        if (event.config && event.config.name) {
          global.GoatBot.eventCommands.set(event.config.name, event);
          console.log(`[BOT] Loaded event: ${event.config.name}`);
        }
      } catch (err) {
        console.error(`[BOT] Failed to load event ${file}:`, err.message);
      }
    }
  }

  // Start listening to messages
  api.listenMqtt(async (err, event) => {
    if (err) {
      console.error('[BOT] MQTT Error:', err.message);
      return;
    }

    // Handle events
    await handleEvent(api, event);
  });

  console.log('[BOT] Listening for messages...');
}

// ===== HANDLE EVENTS =====
async function handleEvent(api, event) {
  try {
    // Process event commands first
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

      const command = global.GoatBot.commands.get(commandName) || 
                      global.GoatBot.commands.get(global.GoatBot.aliases.get(commandName));

      if (command) {
        try {
          const context = {
            api,
            event,
            message: {
              reply: async (text) => {
                return api.sendMessage(text, event.threadID);
              },
              react: async (emoji) => {
                return api.setMessageReaction(emoji, event.messageID, event.threadID);
              }
            },
            usersData: require('./database/models/users.js'),
            threadsData: require('./database/models/threads.js'),
            args,
            commandName
          };

          await command.onStart(context);
        } catch (err) {
          console.error(`[BOT] Command ${commandName} error:`, err.message);
          api.sendMessage(`⚠️ Error: ${err.message}`, event.threadID);
        }
      }
    }
  } catch (err) {
    console.error('[BOT] Event handler error:', err.message);
  }
}

// ===== START BOT =====
console.log('[BOT] Starting RENZ MESSENGER BOT V3...');
console.log(`[BOT] Using Node.js ${process.version}`);

// Handle process signals
process.on('SIGTERM', () => {
  console.log('[BOT] Received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[BOT] Received SIGINT, shutting down...');
  process.exit(0);
});

// If this is a child process (bot), start the bot
if (IS_CHILD_PROCESS && BOT_ID) {
  console.log(`[BOT] Starting as bot ${BOT_ID} (owner: ${BOT_OWNER})`);
  loginBot().catch(err => {
    console.error('[BOT] Fatal error:', err);
    process.exit(1);
  });
} else {
  // Main process - just keep alive for dashboard
  console.log('[BOT] Running as main process (dashboard only)');
  console.log('[BOT] To start bots, use the dashboard Start buttons.');
  
  // Keep the process alive
  setInterval(() => {}, 60000);
}