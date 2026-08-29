// ============================================================
// antiout.js — ULTIMATE Anti-Leave (Max Strict / No-Escape)
// Version: 5.1
// Credits: Terence + Jantzy + Assistant
// ============================================================

module.exports.config = {
  name: "antileave",
  version: "5.1",
  permission: 2,
  credits: "Terence + Jantzy + Assistant",
  description: "Ultimate anti-leave: keeps retrying until user is re-added (Max Strict Mode)",
  prefix: true,
  category: "system",
  usages: "on/off/status/setmsg/setgif/reaction/reset/mode",
  cooldowns: 3
};

const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

// FIXED: Correct path for data file
const dataFile = path.join(__dirname, "..", "data", "antiout.json");

// Ensure data path/file exists
async function ensureData() {
  const dataDir = path.join(__dirname, "..", "data");
  await fs.ensureDir(dataDir);
  if (!fs.existsSync(dataFile)) {
    await fs.writeJson(dataFile, {});
  }
}

// Helper: sleep ms
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// Helper: safe get user name
function getUserName(api, uid) {
  return new Promise((resolve) => {
    api.getUserInfo(uid, (err, res) => {
      try {
        if (err || !res || !res[uid]) return resolve("Unknown User");
        return resolve(res[uid].name || "Unknown User");
      } catch (e) {
        return resolve("Unknown User");
      }
    });
  });
}

// Helper: attempt add with Promise
function attemptAdd(api, uid, threadID) {
  return new Promise((resolve) => {
    try {
      api.addUserToGroup(uid, threadID, (err) => {
        if (!err) return resolve({ success: true });
        return resolve({ success: false, err: err });
      });
    } catch (e) {
      // If addUserToGroup returns a Promise
      try {
        api.addUserToGroup(uid, threadID)
          .then(() => resolve({ success: true }))
          .catch((err2) => resolve({ success: false, err: err2 }));
      } catch (e2) {
        resolve({ success: false, err: e2 });
      }
    }
  });
}

// Helper: download GIF/Image from URL
async function getStreamFromURL(url) {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });
    return response.data;
  } catch (error) {
    console.error("[antiout] Error downloading from URL:", error.message);
    return null;
  }
}

// ============================================================
// HANDLE LEAVE EVENT (MAX STRICT: infinite retry with backoff)
// ============================================================
module.exports.handleEvent = async function ({ api, event }) {
  try {
    if (event.logMessageType !== "log:unsubscribe") return;

    await ensureData();
    const all = await fs.readJson(dataFile);

    const threadID = String(event.threadID);
    const target = event.logMessageData.leftParticipantFbId;

    // FIXED: Get bot ID properly
    const botID = await api.getCurrentUserID();
    if (String(target) === String(botID)) return;

    // ensure group config exists
    if (!all[threadID]) {
      all[threadID] = {
        enabled: false,
        message: "🚫 {name} tried to leave — no escape allowed!\n\n{type}",
        gif: "",
        reaction: "",
        mode: "max"
      };
      await fs.writeJson(dataFile, all, { spaces: 2 });
    }

    // If antiout disabled, do nothing
    if (!all[threadID].enabled) return;

    const cfg = all[threadID];

    const userName = await getUserName(api, target);
    const msgText = (cfg.message || "")
      .replace(/\{name\}/g, userName)
      .replace(/\{id\}/g, target)
      .replace(/\{type\}/g, "User attempted to leave.");

    let added = false;
    let attempt = 0;

    // Max Strict Mode: Retry until success
    while (!added) {
      attempt += 1;

      // Try to add (primary)
      const res1 = await attemptAdd(api, target, threadID);
      if (res1.success) {
        added = true;
        console.log(`[antiout] ✅ Added ${target} on attempt ${attempt}`);
        break;
      }

      // Try a quick immediate second attempt
      const res2 = await attemptAdd(api, target, threadID);
      if (res2.success) {
        added = true;
        console.log(`[antiout] ✅ Added ${target} on attempt ${attempt} (secondary)`);
        break;
      }

      // FIXED: Send DM rejoin link properly
      try {
        const rejoinLink = `https://m.me/${botID}?join_group=${threadID}`;
        await api.sendMessage(
          `🚫 You cannot permanently leave this group.\n\nTap to rejoin: ${rejoinLink}`,
          target
        );
      } catch (e) {
        // ignore DM sending errors
      }

      // Exponential backoff
      let delay = 1000 * Math.pow(2, Math.min(attempt - 1, 6));
      if (delay > 60000) delay = 60000;

      console.log(`[antiout] ⏳ Attempt ${attempt} failed. Retrying in ${delay}ms...`);

      // Burst retry
      const res3 = await attemptAdd(api, target, threadID);
      if (res3.success) {
        added = true;
        console.log(`[antiout] ✅ Added ${target} on attempt ${attempt} (burst)`);
        break;
      }

      await sleep(delay);

      // Periodic group notification
      if (attempt % 6 === 0) {
        try {
          await api.sendMessage(
            `⚠️ Antiout Notice\n\n🔄 Retrying to restore: ${userName}\n📊 Attempts: ${attempt}\n⏳ This will continue until re-add succeeds.`,
            threadID
          );
        } catch (e) {
          // ignore
        }
      }
    }

    // Send main group message with optional GIF
    try {
      let msgObj = { body: msgText };
      if (cfg.gif && cfg.gif.length > 5) {
        try {
          const stream = await getStreamFromURL(cfg.gif);
          if (stream) {
            msgObj.attachment = stream;
          }
        } catch (e) {
          console.log("[antiout] GIF fetch error:", e.message);
        }
      }
      await api.sendMessage(msgObj, threadID);
    } catch (e) {
      console.log("[antiout] Send group message error:", e.message);
    }

    // Send reaction message if configured
    if (cfg.reaction && cfg.reaction.trim() !== "") {
      try {
        await api.sendMessage(cfg.reaction, threadID);
      } catch (e) {
        // ignore
      }
    }

  } catch (err) {
    console.log("❌ Antiout handleEvent error:", err);
  }
};

// ============================================================
// COMMANDS: on/off/status/setmsg/setgif/reaction/reset/mode
// ============================================================
module.exports.run = async ({ api, event, args }) => {
  try {
    await ensureData();
    const all = await fs.readJson(dataFile);
    const threadID = String(event.threadID);

    if (!all[threadID]) {
      all[threadID] = {
        enabled: false,
        message: "🚫 {name} tried to leave — no escape allowed!\n\n{type}",
        gif: "",
        reaction: "",
        mode: "max"
      };
    }

    const cfg = all[threadID];
    const sub = (args[0] || "").toLowerCase();

    switch(sub) {
      case "on":
        cfg.enabled = true;
        await fs.writeJson(dataFile, all, { spaces: 2 });
        return api.sendMessage("🟢 Antiout ENABLED (Max Strict) for this group.", threadID);

      case "off":
        cfg.enabled = false;
        await fs.writeJson(dataFile, all, { spaces: 2 });
        return api.sendMessage("🔴 Antiout DISABLED for this group.", threadID);

      case "status":
        return api.sendMessage(
          `╔══ 🔍 ANTI-LEAVE STATUS ══╗\n` +
          `║ State: ${cfg.enabled ? "🟢 ON" : "🔴 OFF"}\n` +
          `║ Mode: ${cfg.mode || "max"}\n` +
          `║ Message: ${(cfg.message || "").slice(0, 120)}...\n` +
          `║ GIF: ${cfg.gif ? "✅ Set" : "❌ None"}\n` +
          `║ Reaction: ${cfg.reaction ? "✅ Set" : "❌ None"}\n` +
          `╚══════════════════════════╝`,
          threadID
        );

      case "setmsg":
        const newMsg = args.slice(1).join(" ");
        if (!newMsg) return api.sendMessage("❗ Usage: antileave setmsg <message>", threadID);
        cfg.message = newMsg;
        await fs.writeJson(dataFile, all, { spaces: 2 });
        return api.sendMessage("✏️ Antiout leave message updated.", threadID);

      case "setgif":
        const gif = args[1];
        if (!gif) return api.sendMessage("❗ Usage: antileave setgif <url>", threadID);
        cfg.gif = gif;
        await fs.writeJson(dataFile, all, { spaces: 2 });
        return api.sendMessage("🎬 GIF updated successfully.", threadID);

      case "reaction":
        const text = args.slice(1).join(" ");
        if (!text) return api.sendMessage("❗ Usage: antileave reaction <message>", threadID);
        cfg.reaction = text;
        await fs.writeJson(dataFile, all, { spaces: 2 });
        return api.sendMessage("⚡ Reaction message updated.", threadID);

      case "reset":
      case "clear":
        all[threadID] = {
          enabled: false,
          message: "🚫 {name} tried to leave — no escape allowed!\n\n{type}",
          gif: "",
          reaction: "",
          mode: "max"
        };
        await fs.writeJson(dataFile, all, { spaces: 2 });
        return api.sendMessage("♻ Antiout settings reset to default.", threadID);

      case "mode":
        const m = (args[1] || "max").toLowerCase();
        if (!["max", "smart", "normal"].includes(m)) {
          return api.sendMessage("❗ Mode must be: max, smart, or normal", threadID);
        }
        cfg.mode = m;
        await fs.writeJson(dataFile, all, { spaces: 2 });
        return api.sendMessage(`✅ Antiout mode set to: ${m}`, threadID);

      default:
        return api.sendMessage(
          "╔═══ 🛠 Antiout Commands ═══╗\n" +
          "║ antileave on — Enable\n" +
          "║ antileave off — Disable\n" +
          "║ antileave status — Show settings\n" +
          "║ antileave setmsg <text> — Set message\n" +
          "║ antileave setgif <url> — Set GIF\n" +
          "║ antileave reaction <text> — Set reaction\n" +
          "║ antileave reset — Reset settings\n" +
          "║ antileave mode <max|smart|normal>\n" +
          "╚═══════════════════════════╝",
          threadID
        );
    }

  } catch (err) {
    console.log("❌ Antiout command error:", err);
    return api.sendMessage(`⚠️ Error: ${err.message}`, event.threadID);
  }
};
