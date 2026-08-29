// scripts/events/antiout.js
module.exports.config = {
  name: "antiout-auto",
  eventType: ["log:unsubscribe"],
  version: "1.3.0",
  credits: "Nayan (upgraded)",
  description: "Auto re-add members when antiout is ON (per-thread)"
};

const fs = require("fs-extra");
const { join } = require("path");
const dataFile = join(__dirname, "..", "data", "antiout.json");

async function ensureDataFile() {
  await fs.ensureDir(join(__dirname, "..", "data"));
  if (!fs.existsSync(dataFile)) await fs.writeJson(dataFile, {});
}

module.exports.run = async ({ event, api, Users, Threads }) => {
  try {
    // ignore bot leaving
    if (event.logMessageData.leftParticipantFbId == api.getCurrentUserID()) return;

    await ensureDataFile();
    const all = await fs.readJson(dataFile);
    const threadID = String(event.threadID);
    const cfg = all[threadID] || {};

    if (!cfg.enabled) return; // feature off for this thread

    const userID = event.logMessageData.leftParticipantFbId;
    const name = global.data.userName.get(userID) || await Users.getNameUser(userID).catch(()=> "User");

    // Attempt to add back
    api.addUserToGroup(userID, event.threadID, async (err, info) => {
      if (err) {
        // friendly, stylish error message
        const errMsg = [
          "╔═══ ⚠ Antiout Error ═══╗",
          `║ Failed to restore: ${name}`,
          "╠═══════════════════════╣",
          "║ Reason: Could not add user back (blocked or privacy).",
          "╚══════════════════════╝"
        ].join("\n");
        return api.sendMessage(errMsg, event.threadID);
      }

      // on success, send a cool celebration message (uses cfg.reaction if set)
      const reaction = cfg.reaction || `🔒 Antiout engaged — ${name} has been returned.\nNo more escape!`;
      // include mention if possible
      const mentions = [{
        tag: "@" + name,
        id: userID
      }];

      const final = [
        "╔═══ ✅ Antiout Active ═══╗",
        `║ ${reaction}`,
        "╚════════════════════════╝"
      ].join("\n");

      return api.sendMessage({ body: final, mentions }, event.threadID);
    });
  } catch (err) {
    console.error("antiout.js error:", err);
  }
};
