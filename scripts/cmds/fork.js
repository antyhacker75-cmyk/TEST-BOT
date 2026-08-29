module.exports = {
  config: {
    name: "fork",
    version: "3.0",
    author: "xalman",
    countDown: 5,
    role: 0,
    shortDescription: "Show repository info",
    category: "utility",
    guide: {
      en: "{p}fork"
    }
  },

  langs: {
    en: {
      current: `📌 𝐍𝐗-𝐆𝐎𝐀𝐓-𝐁𝐎𝐓-𝐕𝟑
━━━━━━━━━━━━━━━━━━━━━━━━
👑 Repo Owner : 𝖷𝖺𝗅𝗆𝖺𝗇 𝖧𝗈𝗌𝗌𝖺𝗂𝗇
🔗 Repo       : %1
💎 Status     : always updating
━━━━━━━━━━━━━━━━━━━━━━━━`
    }
  },

  onStart: async function ({ message, getLang }) {
    const link = "https://github.com/goatbotnx/NX-GOAT-BOT-V3";
    return message.reply(getLang("current", link));
  },

  onChat: async function ({ message, getLang, event }) {
    if (event.body && event.body.toLowerCase() === "fork") {
      const link = "https://github.com/goatbotnx/NX-GOAT-BOT-V3";
      return message.reply(getLang("current", link));
    }
  }
};
