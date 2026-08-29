const Canvas = require("canvas");
const fs = require("fs");
const path = require("path");
const GIFEncoder = require("gif-encoder-2");

module.exports = {
  config: {
    name: "spin",
    version: "2.1",
    author: "Renz",
    role: 0,
    countDown: 5,
    category: "GAMES",
    guide: {
      en: "{pn} <amount>"
    }
  },

  onStart: async ({ message, event, args, usersData, api }) => {
    const { senderID, threadID } = event;

    const formatMoney = (num) => {
      const n = Number(num);
      if (n === Infinity || isNaN(n)) return "∞";
      if (n < 1000) return n.toFixed(0);
      const units = [
        { v: 1e12, s: "T" },
        { v: 1e9, s: "B" },
        { v: 1e6, s: "M" },
        { v: 1e3, s: "K" }
      ];
      for (let u of units) {
        if (n >= u.v)
          return (n / u.v).toFixed(2).replace(/\.00$/, "") + u.s;
      }
      return n.toLocaleString();
    };

    function parseAmount(input) {
      if (!input) return NaN;
      let a = input.toLowerCase();
      if (a.endsWith("k")) return parseFloat(a) * 1e3;
      if (a.endsWith("m")) return parseFloat(a) * 1e6;
      if (a.endsWith("b")) return parseFloat(a) * 1e9;
      if (a.endsWith("t")) return parseFloat(a) * 1e12;
      return parseInt(a);
    }

    const betAmount = parseAmount(args[0]);
    const minBet = 100;
    const maxBet = 100000000;

    if (isNaN(betAmount) || betAmount < minBet) {
      return message.reply(`🎰 Minimum bet is 100$\nExample: /spin 1k`);
    }

    if (betAmount > maxBet) {
      return message.reply(`🚫 Max bet: ${formatMoney(maxBet)}$`);
    }

    let userData = await usersData.get(senderID);
    if (!userData) {
      userData = { money: 0 };
    }
    const currentMoney = Number(userData.money || 0);

    if (betAmount > currentMoney) {
      return message.reply(`💸 Not enough balance!\nBalance: ${formatMoney(currentMoney)}$`);
    }

    if (!global.spinLimit) global.spinLimit = {};
    const now = Date.now();
    if (!global.spinLimit[senderID] || (now - global.spinLimit[senderID].lastReset > 3600000)) {
      global.spinLimit[senderID] = { count: 0, lastReset: now };
    }

    const maxSpins = 50;
    if (global.spinLimit[senderID].count >= maxSpins) {
      return message.reply(`🚫 Daily limit reached (${maxSpins} spins)`);
    }

    // WIN-ONLY Segments
    const segments = [
      { emoji: "🍎", multiplier: 1, weight: 0.25 },
      { emoji: "🍐", multiplier: 1.5, weight: 0.20 },
      { emoji: "🍑", multiplier: 2, weight: 0.18 },
      { emoji: "🍒", multiplier: 2.5, weight: 0.15 },
      { emoji: "🍓", multiplier: 3, weight: 0.10 },
      { emoji: "🍇", multiplier: 4, weight: 0.06 },
      { emoji: "🍉", multiplier: 5, weight: 0.04 },
      { emoji: "⭐", multiplier: 10, weight: 0.02 }
    ];

    // Pick random segment
    const rand = Math.random();
    let cumulative = 0;
    let spinResult = 0;
    for (let i = 0; i < segments.length; i++) {
      cumulative += segments[i].weight;
      if (rand < cumulative) {
        spinResult = i;
        break;
      }
    }

    const resultSegment = segments[spinResult];
    const multiplier = resultSegment.multiplier;
    
    let bonus = betAmount * multiplier;
    const maxWin = 100000000;
    if (bonus > maxWin) {
      bonus = maxWin;
    }
    
    const finalMoney = currentMoney + bonus;

    userData.money = finalMoney;
    await usersData.set(senderID, userData);

    global.spinLimit[senderID].count++;

    const isJackpot = multiplier >= 10;
    const status = isJackpot ? "JACKPOT! 🌟" : `WIN ${multiplier}x 🎉`;

    const sent = await message.reply("🌀 Spinning the wheel...");

    // ===== GENERATE GIF WITH FIXED ALIGNMENT =====
    const W = 400;
    const H = 400;
    const centerX = W / 2;
    const centerY = H / 2;
    const radius = 160;

    const totalSegments = segments.length;
    const segmentAngle = (2 * Math.PI) / totalSegments;

    const frames = 30;
    const encoder = new GIFEncoder(W, H);
    encoder.setDelay(80);
    encoder.setRepeat(0);
    encoder.start();

    // The arrow points UP (at -PI/2 or 12 o'clock position)
    // We need the segment's center to align with the arrow
    // Segment 0 starts at angle 0, so we need to offset
    const arrowAngle = -Math.PI / 2; // Arrow points up
    
    for (let f = 0; f < frames; f++) {
      const canvas = Canvas.createCanvas(W, H);
      const ctx = canvas.getContext("2d");

      // Background
      ctx.fillStyle = "#1a0a2e";
      ctx.fillRect(0, 0, W, H);

      // Glow
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, "rgba(212, 175, 55, 0.1)");
      gradient.addColorStop(1, "rgba(26, 10, 46, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Calculate rotation
      const progress = f / frames;
      const eased = 1 - Math.pow(1 - progress, 3);
      const totalRotation = (2 * Math.PI) * 3; // 3 full spins
      const spinAngle = eased * totalRotation;
      
      // FIX: Calculate final angle so the selected segment aligns with the arrow
      // The arrow is at the top (12 o'clock), which is -PI/2 in canvas coordinates
      // We want the center of the selected segment to be at the top
      const segmentCenter = spinResult * segmentAngle + segmentAngle / 2;
      // To align segment center with arrow at top: rotation = -segmentCenter - PI/2
      const finalRotation = -(segmentCenter) + arrowAngle;
      
      const rotation = spinAngle + finalRotation;

      // Draw segments
      for (let i = 0; i < totalSegments; i++) {
        const start = i * segmentAngle + rotation;
        const end = start + segmentAngle;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, start, end);
        ctx.closePath();

        const colors = [
          "#FFD700", "#FFC700", "#FFB700", "#FFA700",
          "#FF9700", "#FF8700", "#FF7700", "#FFD700"
        ];
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw emoji and multiplier
        const midAngle = start + segmentAngle / 2;
        const textX = centerX + Math.cos(midAngle) * (radius * 0.7);
        const textY = centerY + Math.sin(midAngle) * (radius * 0.7);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "32px Arial";
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#000000";
        ctx.fillText(segments[i].emoji, textX, textY);
        
        ctx.font = "14px Arial";
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#000000";
        ctx.fillText(segments[i].multiplier + "x", textX, textY + 30);
        ctx.shadowBlur = 0;
      }

      // Center circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
      ctx.fillStyle = "#FFD700";
      ctx.shadowBlur = 30;
      ctx.shadowColor = "#FFD700";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Arrow pointer (at top)
      ctx.fillStyle = "#ff0000";
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#ff0000";
      ctx.beginPath();
      ctx.moveTo(W / 2 - 20, 20);
      ctx.lineTo(W / 2 + 20, 20);
      ctx.lineTo(W / 2, 5);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Highlight the winning segment (make it glow)
      const highlightStart = spinResult * segmentAngle + rotation;
      const highlightEnd = highlightStart + segmentAngle;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius + 5, highlightStart, highlightEnd);
      ctx.closePath();
      ctx.shadowBlur = 40;
      ctx.shadowColor = "rgba(255, 215, 0, 0.8)";
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // "SPIN" text
      ctx.font = "bold 20px Arial";
      ctx.fillStyle = "#FFD700";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#FFD700";
      ctx.fillText("★ SPIN ★", W / 2, H - 10);
      ctx.shadowBlur = 0;

      encoder.addFrame(ctx);
    }

    encoder.finish();
    const buffer = encoder.out.getData();

    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    const filePath = path.join(cacheDir, `spin_${Date.now()}.gif`);
    fs.writeFileSync(filePath, buffer);

    await api.unsendMessage(sent.messageID);

    const msg = `🎡 𝗦𝗣𝗜𝗡 𝗪𝗛𝗘𝗘𝗟

${isJackpot ? "🌟" : "🎉"} ${status}
📊 Result: ${resultSegment.emoji} (${multiplier}x)
💰 Won: ${formatMoney(bonus)}$ ${bonus >= maxWin ? "🔥 MAX WIN!" : ""}
💳 Balance: ${formatMoney(finalMoney)}$
📊 Usage: ${global.spinLimit[senderID].count}/${maxSpins}`;

    return api.sendMessage(
      {
        body: msg,
        attachment: fs.createReadStream(filePath)
      },
      threadID,
      () => {
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch {}
        }
      }
    );
  }
};
