const fs = require("fs-extra");
const axios = require("axios");
const path = require("path");
const { getPrefix } = global.utils;
const { commands, aliases } = global.GoatBot;
const doNotDelete = "✦ 𝗔𝗦𝗧𝗥𝗢 𝗦𝗧𝗔𝗥 𝗥𝗘𝗡𝗭 ✦";

module.exports = {
  config: {
    name: "help",
    aliases: ["h", "menu", "commands"],
    version: "2.0.0",
    author: "xalman | Renz",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "View command usage and information"
    },
    longDescription: {
      en: "Display all available commands with pagination, categories, and detailed command information"
    },
    category: "info",
    guide: {
      en: "{pn} [page | command name]\n\n" +
           "📌 Examples:\n" +
           "• {pn} - Show all commands\n" +
           "• {pn} 2 - Show page 2\n" +
           "• {pn} bal2 - Show bal2 info"
    },
    priority: 1
  },

  langs: {
    en: {
      help2: 
        "╭─── ✦ 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗟𝗜𝗦𝗧 ✦ ───╮\n" +
        "│\n" +
        "%1\n" +
        "│\n" +
        "╰────────────────────────────╯\n" +
        "📖 𝗣𝗮𝗴𝗲: [ %2 / %3 ]\n" +
        "📊 𝗧𝗼𝘁𝗮𝗹: %4 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀\n" +
        "💡 𝗨𝘀𝗲: %5𝐡𝐞𝐥𝐩 <𝐧𝐮𝐦>\n" +
        "━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
        "👤 %6",

      help: 
        "╭─── ✦ 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗠𝗘𝗡𝗨 ✦ ───╮\n" +
        "│\n" +
        "%1\n" +
        "│\n" +
        "╰────────────────────────────╯\n" +
        "📌 𝗧𝗼𝘁𝗮𝗹: %2 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀\n" +
        "🔗 𝗣𝗿𝗲𝗳𝗶𝘅: [ %3 ]\n" +
        "✨ %4",

      commandNotFound: 
        "╭─── ❌ 𝗘𝗥𝗥𝗢𝗥 ───╮\n" +
        "│\n" +
        "│ 𝗖𝗼𝗺𝗺𝗮𝗻𝗱 \"%1\" 𝗻𝗼𝘁 𝗳𝗼𝘂𝗻𝗱!\n" +
        "│\n" +
        "╰────────────────────╯\n" +
        "💡 𝗧𝗶𝗽: 𝗨𝘀𝗲 %2𝐡𝐞𝐥𝐩 𝘁𝗼 𝘃𝗶𝗲𝘄 𝗮𝗹𝗹 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝘀",

      getInfoCommand: 
        "╭─── 📋 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗜𝗡𝗙𝗢 ───╮\n" +
        "│\n" +
        "│ 🏷️ 𝗡𝗮𝗺𝗲: %1\n" +
        "│ 📝 𝗗𝗲𝘀𝗰: %2\n" +
        "│ 🔗 𝗔𝗹𝗶𝗮𝘀: %3\n" +
        "│ 📦 𝗩𝗲𝗿𝘀𝗶𝗼𝗻: %4\n" +
        "│ 🛡️ 𝗣𝗲𝗿𝗺𝗶𝘀𝘀𝗶𝗼𝗻: %5\n" +
        "│ ⏳ 𝗖𝗼𝗼𝗹𝗱𝗼𝘄𝗻: %6𝘀\n" +
        "│ 👤 𝗔𝘂𝘁𝗵𝗼𝗿: %7\n" +
        "│\n" +
        "╰────────────────────────────╯\n" +
        "╭─── 📖 𝗨𝗦𝗔𝗚𝗘 ───╮\n" +
        "│\n" +
        "%8\n" +
        "│\n" +
        "╰────────────────────╯\n" +
        "✦ %9",

      pageNotFound: 
        "╭─── ❌ 𝗘𝗥𝗥𝗢𝗥 ───╮\n" +
        "│\n" +
        "│ 𝗣𝗮𝗴𝗲 %1 𝗶𝘀 𝗼𝘂𝘁 𝗼𝗳 𝗿𝗮𝗻𝗴𝗲!\n" +
        "│\n" +
        "╰────────────────────╯",

      noCommands: 
        "╭─── ⚠️ 𝗡𝗢 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦 ───╮\n" +
        "│\n" +
        "│ 𝗡𝗼 𝗰𝗼𝗺𝗺𝗮𝗻𝗱𝘀 𝗮𝗿𝗲 𝗮𝘃𝗮𝗶𝗹𝗮𝗯𝗹𝗲.\n" +
        "│\n" +
        "╰────────────────────────────╯"
    }
  },

  onStart: async function ({ message, args, event, threadsData, getLang, role }) {
    const langCode = await threadsData.get(event.threadID, "data.lang") || global.GoatBot.config.language;
    const { threadID } = event;
    const threadData = await threadsData.get(threadID);
    const prefix = getPrefix(threadID);
    
    const commandName = (args[0] || "").toLowerCase();
    const command = commands.get(commandName) || commands.get(aliases.get(commandName));

    // ============================================
    // SHOW COMMAND INFO
    // ============================================

    if (command) {
      const config = command.config;
      let guide = config.guide?.[langCode] || config.guide?.en || "";
      if (typeof guide === "object") guide = guide.body;
      
      const usage = guide
        .replace(/\{pn\}/g, prefix + config.name)
        .replace(/\{p\}/g, prefix)
        .split("\n")
        .map(line => `│ ${line}`)
        .join("\n");

      const permission = config.role == 0 ? "👥 All Users" 
        : config.role == 1 ? "🛡️ Group Admins" 
        : config.role == 2 ? "⚙️ Bot Admins" 
        : config.role == 3 ? "💎 Premium Users" 
        : "👑 Bot Owner";

      return message.reply(getLang("getInfoCommand", 
        config.name.toUpperCase(),
        config.shortDescription?.[langCode] || config.shortDescription?.en || "No Description",
        config.aliases?.join(", ") || "None",
        config.version || "1.0.0",
        permission,
        config.countDown || 1,
        config.author || "Unknown",
        usage,
        doNotDelete
      ));
    }

    // ============================================
    // PAGINATED COMMAND LIST
    // ============================================

    if (!args[0] || !isNaN(args[0])) {
      const arrayInfo = [];
      let msg = "";
      
      if (!isNaN(args[0]) || (threadData.settings && threadData.settings.sortHelp === "name")) {
        const page = parseInt(args[0]) || 1;
        const numberOfOnePage = 20;
        
        // Collect all commands the user can access
        for (const [name, value] of commands) {
          if (value.config.role > role) continue;
          arrayInfo.push({ 
            data: name, 
            priority: value.config.priority || 0 
          });
        }
        
        // Sort by priority (higher first) then alphabetically
        arrayInfo.sort((a, b) => 
          b.priority - a.priority || a.data.localeCompare(b.data)
        );
        
        if (arrayInfo.length === 0) {
          return message.reply(getLang("noCommands"));
        }
        
        const { allPage, totalPage } = global.utils.splitPage(arrayInfo, numberOfOnePage);
        
        if (page < 1 || page > totalPage) {
          return message.reply(getLang("pageNotFound", page));
        }

        msg = allPage[page - 1].reduce((text, item, index) => 
          text += `│ ${(page-1)*numberOfOnePage + index + 1}. ${item.data}\n`, 
          ""
        );
        
        return message.reply(getLang("help2", 
          msg, 
          page, 
          totalPage, 
          arrayInfo.length, 
          prefix, 
          doNotDelete
        ));
      } 
      
      // ============================================
      // CATEGORIZED VIEW
      // ============================================
      
      else {
        const categories = {};
        
        // Group commands by category
        for (const [, value] of commands) {
          if (value.config.role > role) continue;
          const cat = value.config.category?.toUpperCase() || "OTHERS";
          if (!categories[cat]) categories[cat] = [];
          categories[cat].push(value.config.name);
        }

        // Sort categories and format
        Object.keys(categories).sort().forEach(cat => {
          const sortedCmds = categories[cat].sort().join(", ");
          msg += `\n┌───『 ${cat} 』\n│ ${sortedCmds}\n`;
        });

        if (!msg) {
          return message.reply(getLang("noCommands"));
        }

        return message.reply(getLang("help", 
          msg, 
          commands.size, 
          prefix, 
          doNotDelete
        ));
      }
    }

    // ============================================
    // COMMAND NOT FOUND
    // ============================================

    return message.reply(getLang("commandNotFound", args[0], prefix));
  }
};
