module.exports = {
  config: {
    name: "antiout",
    version: "3.0",
    author: "Renz",
    countDown: 5,
    role: 2,
    shortDescription: "Enable or disable antiout",
    longDescription: "Prevents members from leaving the group by automatically re-adding them",
    category: "box chat",
    guide: "{pn} [on | off | status | setmsg | setgif | reaction | setreact | mode | reset]",
    envConfig: {
      deltaNext: 5
    }
  },

  onStart: async function({ message, event, threadsData, args, api }) {
    try {
      let antioutSettings = await threadsData.get(event.threadID, "settings.antiout");
      
      if (!antioutSettings || typeof antioutSettings !== 'object') {
        antioutSettings = {
          enabled: false,
          message: "🚫 {name} tried to leave — no escape allowed!\n\n{type}",
          gif: "/antiout setgif https://media1.tenor.com/m/uSr_wnlAXYEAAAAd/water-vikings-club-penguin.gif",
          reaction: "",
          autoReact: "😈",
          mode: "max"
        };
        await threadsData.set(event.threadID, antioutSettings, "settings.antiout");
      }

      const subCommand = (args[0] || "").toLowerCase();

      switch(subCommand) {
        case "on":
          antioutSettings.enabled = true;
          await threadsData.set(event.threadID, antioutSettings, "settings.antiout");
          return message.reply("✅ Antiout has been **ENABLED** for this group.");

        case "off":
          antioutSettings.enabled = false;
          await threadsData.set(event.threadID, antioutSettings, "settings.antiout");
          return message.reply("❌ Antiout has been **DISABLED** for this group.");

        case "status":
          const status = antioutSettings.enabled ? "🟢 ENABLED" : "🔴 DISABLED";
          return message.reply(
            `╔═══ 📊 ANTI-OUT STATUS ═══╗\n` +
            `║ Status: ${status}\n` +
            `║ Mode: ${antioutSettings.mode || "max"}\n` +
            `║ Auto React: ${antioutSettings.autoReact || "None"}\n` +
            `║ Group ID: ${event.threadID}\n` +
            `╚═════════════════════════╝`
          );

        case "setmsg":
          const newMsg = args.slice(1).join(" ");
          if (!newMsg) return message.reply("❌ Please provide a message.");
          antioutSettings.message = newMsg;
          await threadsData.set(event.threadID, antioutSettings, "settings.antiout");
          return message.reply(`✅ Message updated!`);

        case "setgif":
          const gifUrl = args[1];
          if (!gifUrl || !gifUrl.startsWith("http")) {
            return message.reply("❌ Please provide a valid GIF URL.");
          }
          antioutSettings.gif = gifUrl;
          await threadsData.set(event.threadID, antioutSettings, "settings.antiout");
          return message.reply(`✅ GIF updated!`);

        case "reaction":
          const reactionMsg = args.slice(1).join(" ");
          if (!reactionMsg) return message.reply("❌ Please provide a reaction message.");
          antioutSettings.reaction = reactionMsg;
          await threadsData.set(event.threadID, antioutSettings, "settings.antiout");
          return message.reply(`✅ Reaction message updated!`);

        case "setreact":
          const emoji = args.slice(1).join(" ");
          if (!emoji) return message.reply("❌ Please provide an emoji.");
          antioutSettings.autoReact = emoji;
          await threadsData.set(event.threadID, antioutSettings, "settings.antiout");
          return message.reply(`✅ Auto-reaction set to: ${emoji}`);

        case "reset":
          antioutSettings = {
            enabled: false,
            message: "🚫 {name} tried to leave — no escape allowed!\n\n{type}",
            gif: "",
            reaction: "",
            autoReact: "😈",
            mode: "max"
          };
          await threadsData.set(event.threadID, antioutSettings, "settings.antiout");
          return message.reply("♻️ Antiout has been **RESET**.");

        default:
          return message.reply(
            `╔═══ 🛠 ANTI-OUT COMMANDS ═══╗\n` +
            `║ {pn} on - Enable\n` +
            `║ {pn} off - Disable\n` +
            `║ {pn} status - Show settings\n` +
            `║ {pn} setmsg <text> - Set message\n` +
            `║ {pn} setgif <url> - Set GIF\n` +
            `║ {pn} reaction <text> - Set reaction\n` +
            `║ {pn} setreact <emoji> - Set auto-react\n` +
            `║ {pn} reset - Reset to default\n` +
            `╚════════════════════════════╝`
          );
      }

    } catch (error) {
      console.error("[ANTIOUT ERROR]", error);
      return message.reply(`❌ Error: ${error.message}`);
    }
  },

  onEvent: async function({ api, event, threadsData }) {
    try {
      // Check if event is a user leaving
      if (event.logMessageType !== "log:unsubscribe") return;

      // Get antiout settings
      const antioutSettings = await threadsData.get(event.threadID, "settings.antiout");
      
      // Check if antiout is enabled
      if (!antioutSettings || !antioutSettings.enabled) return;

      // Get the user who left
      const userId = event.logMessageData.leftParticipantFbId;
      const botID = api.getCurrentUserID();

      // Don't re-add the bot itself
      if (String(userId) === String(botID)) {
        console.log("[ANTIOUT] Bot left, ignoring...");
        return;
      }

      // Get user name
      let userName = "Unknown User";
      try {
        const userInfo = await api.getUserInfo(userId);
        userName = userInfo[userId]?.name || "Unknown User";
      } catch (err) {
        console.log("[ANTIOUT] Could not get user name:", err.message);
      }

      console.log(`[ANTIOUT] 🔴 ${userName} (${userId}) left the group. Attempting to re-add...`);

      // ===== RE-ADD USER WITH MULTIPLE METHODS =====
      let added = false;
      let errorMessage = "";

      // Method 1: Standard addUserToGroup
      try {
        console.log(`[ANTIOUT] Method 1: Using api.addUserToGroup...`);
        await api.addUserToGroup(userId, event.threadID);
        added = true;
        console.log(`[ANTIOUT] ✅ Method 1 SUCCESS: ${userName} re-added!`);
      } catch (err) {
        errorMessage = err.message || err;
        console.log(`[ANTIOUT] ❌ Method 1 failed: ${errorMessage}`);
      }

      // Method 2: If failed, try with delay and retry
      if (!added) {
        try {
          console.log(`[ANTIOUT] Method 2: Retrying after 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          await api.addUserToGroup(userId, event.threadID);
          added = true;
          console.log(`[ANTIOUT] ✅ Method 2 SUCCESS: ${userName} re-added!`);
        } catch (err) {
          errorMessage = err.message || err;
          console.log(`[ANTIOUT] ❌ Method 2 failed: ${errorMessage}`);
        }
      }

      // Method 3: Try with different parameter order (some APIs use threadID first)
      if (!added) {
        try {
          console.log(`[ANTIOUT] Method 3: Trying alternate parameter order...`);
          // Some versions use api.addUserToGroup(threadID, userId)
          await api.addUserToGroup(event.threadID, userId);
          added = true;
          console.log(`[ANTIOUT] ✅ Method 3 SUCCESS: ${userName} re-added!`);
        } catch (err) {
          errorMessage = err.message || err;
          console.log(`[ANTIOUT] ❌ Method 3 failed: ${errorMessage}`);
        }
      }

      // ===== SEND NOTIFICATIONS =====
      if (added) {
        console.log(`[ANTIOUT] ✅ SUCCESS: ${userName} re-added to group!`);
        
        // Send notification
        try {
          const msgText = (antioutSettings.message || "🚫 {name} tried to leave — no escape allowed!")
            .replace(/{name}/g, userName)
            .replace(/{id}/g, userId)
            .replace(/{type}/g, "User attempted to leave");

          const msgData = { body: msgText };

          // Add GIF if set
          if (antioutSettings.gif && antioutSettings.gif.length > 5) {
            try {
              const axios = require("axios");
              const response = await axios({
                method: 'GET',
                url: antioutSettings.gif,
                responseType: 'stream',
                timeout: 15000
              });
              if (response.data) {
                msgData.attachment = response.data;
              }
            } catch (err) {
              console.log("[ANTIOUT] GIF fetch failed:", err.message);
            }
          }

          const sentMsg = await api.sendMessage(msgData, event.threadID);
          
          // Auto-react to own message
          if (antioutSettings.autoReact && sentMsg && sentMsg.messageID) {
            setTimeout(async () => {
              try {
                await api.setMessageReaction(antioutSettings.autoReact, sentMsg.messageID, () => {}, true);
                console.log(`[ANTIOUT] ✅ Auto-reacted with ${antioutSettings.autoReact}`);
              } catch (err) {
                console.log("[ANTIOUT] Auto-react failed:", err.message);
              }
            }, 1000);
          }

          // Send reaction message
          if (antioutSettings.reaction) {
            setTimeout(async () => {
              try {
                await api.sendMessage(antioutSettings.reaction, event.threadID);
              } catch (err) {
                console.log("[ANTIOUT] Reaction message failed:", err.message);
              }
            }, 2000);
          }

        } catch (err) {
          console.log("[ANTIOUT] Failed to send notification:", err.message);
        }

      } else {
        // FAILED to re-add - Send warning to group
        console.log(`[ANTIOUT] ❌ FAILED to re-add ${userName} after all methods`);
        
        try {
          await api.sendMessage(
            `⚠️⚠️⚠️ ANTI-OUT WARNING ⚠️⚠️⚠️\n\n` +
            `❌ Failed to re-add ${userName}\n` +
            `📌 User ID: ${userId}\n` +
            `🔴 Error: ${errorMessage || "Unknown error"}\n\n` +
            `💡 Possible reasons:\n` +
            `• Bot is not an admin\n` +
            `• User blocked the bot\n` +
            `• Group is full\n` +
            `• Facebook API rate limit\n\n` +
            `🔄 Please add ${userName} manually or check bot permissions.`,
            event.threadID
          );
        } catch (err) {
          console.log("[ANTIOUT] Failed to send warning:", err.message);
        }
      }

    } catch (error) {
      console.error("[ANTIOUT EVENT ERROR]", error);
    }
  }
};
