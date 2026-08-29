/**
 * @author R3nz75
 * RENZ MESSENGER BOT V3
 * Official source code: https://github.com/renz2451/MESSENGER-CHAT-BOT-V3
 */

const fs = require("fs-extra");
const path = require("path");
const { spawn } = require("child_process");
const { promisify } = require("util");
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

// ===== DETERMINE WHICH ACCOUNT FILE TO USE =====
// If running as a child process for a specific bot, use that bot's file
let accountFile = process.env.BOT_ACCOUNT_FILE || "account.txt";

// If using a specific bot ID, also set the file path
if (process.env.BOT_ID) {
  const botId = process.env.BOT_ID;
  const customFile = `account_${botId}.txt`;
  // Check if the file exists, if not create it from the parent's fbstate
  if (!fs.existsSync(path.join(process.cwd(), customFile))) {
    // If we have the fbstate in environment, write it
    if (process.env.BOT_FBSTATE) {
      fs.writeFileSync(path.join(process.cwd(), customFile), process.env.BOT_FBSTATE);
    }
  }
  accountFile = customFile;
}

console.log(`[BOT] Using account file: ${accountFile}`);

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

// ===== LOGIN FUNCTION =====
async function loginBot() {
  try {
    const { login } = require("fcanew-r3nz75");
    
    // Read fbstate from the determined account file
    const fbstatePath = path.join(__dirname, accountFile);
    let fbstate = [];
    
    if (fs.existsSync(fbstatePath)) {
      try {
        const content = fs.readFileSync(fbstatePath, 'utf8');
        fbstate = JSON.parse(content);
        if (!Array.isArray(fbstate)) {
          throw new Error('Invalid fbstate format');
        }
        console.log(`[BOT] Loaded fbstate from ${accountFile}`);
      } catch (err) {
        console.error(`[BOT] Failed to load fbstate: ${err.message}`);
        // Try to load from config as fallback
        if (config.facebookAccount && config.facebookAccount.fbstate) {
          fbstate = config.facebookAccount.fbstate;
        }
      }
    } else if (config.facebookAccount && config.facebookAccount.fbstate) {
      fbstate = config.facebookAccount.fbstate;
      console.log('[BOT] Using fbstate from config.json');
    } else {
      console.error('[BOT] No fbstate found! Please provide a valid session.');
      process.exit(1);
    }

    // Login with fbstate
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

    // Get bot info
    const botInfo = await api.getCurrentUser();
    global.GoatBot.botID = botInfo.id;
    global.GoatBot.botName = botInfo.name || config.nameBot || "RENZ BOT";

    console.log(`[BOT] Logged in as: ${botInfo.name} (${botInfo.id})`);

    // ===== LOAD COMMANDS =====
    await loadCommands(api);

    // ===== START LISTENING =====
    await startListening(api);

  } catch (err) {
    console.error('[BOT] Login failed:', err.message);
    setTimeout(() => {
      console.log('[BOT] Retrying login...');
      loginBot();
    }, 5000);
  }
}

// ===== LOAD COMMANDS =====
async function loadCommands(api) {
  const commandsPath = path.join(__dirname, 'commands');
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
          // Create context object for the command
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

// Start the bot
loginBot().catch(err => {
  console.error('[BOT] Fatal error:', err);
  process.exit(1);
});