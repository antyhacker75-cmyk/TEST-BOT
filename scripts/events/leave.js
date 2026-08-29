// scripts/events/leave.js
module.exports.config = {
  name: "leave",
  eventType: ["log:unsubscribe"],
  version: "1.2.0",
  credits: "Nayan (upgraded)",
  description: "Stylish leave message (editable per-thread)"
};

const fs = require("fs-extra");
const { join } = require("path");
const dataFile = join(__dirname, "..", "data", "antiout.json");

const DEFAULT_MSG = "🚫 {name} tried to leave — no escapes allowed!\n\n{type}\n\n🔁 I restored them (if Antiout was ON).";
const DEFAULT_GIF = ""; // keep empty for no GIF by default

async function ensureDataFile() {
  await fs.ensureDir(join(__dirname, "..", "data"));
  if (!fs.existsSync(dataFile)) await fs.writeJson(dataFile, {});
}

module.exports.run = async function ({ api, event, Users, Threads }) {
  try {
    // ignore if bot itself left
    if (event.logMessageData.leftParticipantFbId == api.getCurrentUserID()) return;

    await ensureDataFile();
    const all = await fs.readJson(dataFile);
    const threadID = String(event.threadID);
    const cfg = all[threadID] || {};

    // get display name
    const uid = event.logMessageData.leftParticipantFbId;
    const name = global.data.userName.get(uid) || await Users.getNameUser(uid).catch(()=> "Unknown");

    // determine type
    const type = (event.author == uid) ? "Self-left" : "Kicked by admin";

    // thread name if possible
    let threadName = "";
    try {
      const tdata = await Threads.getData(threadID);
      threadName = (tdata && tdata.threadInfo && tdata.threadInfo.threadName) || "";
    } catch (e) {}

    // message template
    let template = cfg.message || DEFAULT_MSG;
    template = template.replace(/\{name\}/g, name)
                       .replace(/\{type\}/g, type)
                       .replace(/\{threadName\}/g, threadName)
                       .replace(/\{id\}/g, uid);

    // pretty UI wrapper
    const boxed = [
      "╔═══════════════════════════════╗",
      `║  ✨ Antiout Notice — ${threadName || "Group"}   ║`,
      "╠═══════════════════════════════╣",
      `${template}`,
      "╚═══════════════════════════════╝"
    ].join("\n");

    // send with gif if exists
    const gif = cfg.gif || DEFAULT_GIF;
    const msg = { body: boxed };

    if (gif && /^https?:\/\//i.test(gif)) {
      // try sending remote gif as attachment (some fb libs accept urls, some require streams)
      // fallback: send body only if attachment fails
      try {
        // If api supports sending attachment as url, it may accept {attachment: gif}
        // Many implementations require a stream, but remote URLs are commonly supported.
        msg.attachment = gif;
        await api.sendMessage(msg, threadID);
      } catch (err) {
        // fallback: send body only
        await api.sendMessage({ body: boxed }, threadID);
      }
    } else if (gif && fs.existsSync(gif)) {
      const { createReadStream } = global.nodemodule["fs-extra"];
      msg.attachment = createReadStream(gif);
      await api.sendMessage(msg, threadID);
    } else {
      await api.sendMessage({ body: boxed }, threadID);
    }
  } catch (err) {
    console.error("leave.js error:", err);
  }
};
