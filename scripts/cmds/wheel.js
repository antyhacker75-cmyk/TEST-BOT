const Canvas = require("canvas");
const fs = require("fs-extra");
const path = require("path");
const GIFEncoder = require("gif-encoder-2");

module.exports = {
  config: {
    name: "wheel",
    version: "4.0",
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
    const maxBet = 1e12;

    if (isNaN(betAmount) || betAmount < minBet) {
      return message.reply(`🎰 Minimum bet is 100$\nExample: /wheel 1k`);
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

    if (!global.wheelLimit) global.wheelLimit = {};
    const now = Date.now();
    if (!global.wheelLimit[senderID] || (now - global.wheelLimit[senderID].lastReset > 3600000)) {
      global.wheelLimit[senderID] = { count: 0, lastReset: now };
    }

    const maxSpins = 50;
    if (global.wheelLimit[senderID].count >= maxSpins) {
      return message.reply(`🚫 Daily limit reached (${maxSpins} spins)`);
    }

    // ===== FAIRER SEGMENTS WITH NEGATIVE MULTIPLIERS =====
    const segments = [
      // Negative multipliers (LOSS)
      { label: "x0", value: 0, weight: 0.15, color: "#FF0000", emoji: "💀" },      // Lose everything
      { label: "-2x", value: -2, weight: 0.12, color: "#FF4444", emoji: "😱" },    // Lose 2x bet
      { label: "-1x", value: -1, weight: 0.15, color: "#FF6666", emoji: "😢" },    // Lose 1x bet
      
      // Neutral/Small win
      { label: "0.5x", value: 0.5, weight: 0.15, color: "#FFE66D", emoji: "😅" }, // Win half
      { label: "1x", value: 1, weight: 0.18, color: "#4ECDC4", emoji: "🙂" },      // Break even
      
      // Positive multipliers (WIN)
      { label: "2x", value: 2, weight: 0.10, color: "#66BB6A", emoji: "😊" },
      { label: "3x", value: 3, weight: 0.07, color: "#43A047", emoji: "🎉" },
      { label: "5x", value: 5, weight: 0.05, color: "#2E7D32", emoji: "🎊" },
      { label: "10x", value: 10, weight: 0.02, color: "#1B5E20", emoji: "🤯" },
      { label: "25x", value: 25, weight: 0.01, color: "#FFD700", emoji: "🌟" }    // Jackpot!
    ];

    // Pick random segment based on weights
    const rand = Math.random();
    let cumulative = 0;
    let resultIndex = 0;
    for (let i = 0; i < segments.length; i++) {
      cumulative += segments[i].weight;
      if (rand < cumulative) {
        resultIndex = i;
        break;
      }
    }

    const resultSegment = segments[resultIndex];
    const multiplier = resultSegment.value;
    
    // Calculate win/loss
    let bonus = 0;
    let win = false;
    
    if (multiplier < 0) {
      // Negative multiplier - LOSE money
      bonus = betAmount * Math.abs(multiplier);
      win = false;
    } else if (multiplier === 0) {
      // Lose everything
      bonus = betAmount;
      win = false;
    } else {
      // Positive multiplier - WIN money
      bonus = betAmount * multiplier;
      win = true;
    }
    
    const finalMoney = win ? currentMoney + bonus : currentMoney - bonus;

    // Update user balance
    userData.money = finalMoney;
    await usersData.set(senderID, userData);

    global.wheelLimit[senderID].count++;

    // Status message
    let status = "";
    let resultText = "";
    
    if (multiplier < 0) {
      status = `LOSS ${Math.abs(multiplier)}x 💀`;
      resultText = `Lost ${formatMoney(bonus)}$`;
    } else if (multiplier === 0) {
      status = "BUST 💀";
      resultText = `Lost ${formatMoney(bonus)}$`;
    } else if (multiplier === 1) {
      status = "BREAK EVEN 🙂";
      resultText = `Bet returned: ${formatMoney(betAmount)}$`;
    } else {
      status = `WIN ${multiplier}x 🎉`;
      resultText = `Won ${formatMoney(bonus)}$`;
    }

    const sent = await message.reply("🌀 Spinning the wheel...");

    // ===== GENERATE GIF =====
    const W = 600;
    const H = 600;
    const centerX = W / 2;
    const centerY = H / 2;
    const radius = 240;

    const totalSegments = segments.length;
    const segmentAngle = (2 * Math.PI) / totalSegments;

    const frames = 50;
    const encoder = new GIFEncoder(W, H);
    encoder.setDelay(50);
    encoder.setRepeat(0);
    encoder.setQuality(1);
    encoder.start();

    for (let f = 0; f < frames; f++) {
      const canvas = Canvas.createCanvas(W, H);
      const ctx = canvas.getContext("2d");

      // Background
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, W, H);

      // Stars
      for (let i = 0; i < 80; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2 + 0.5, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.4})`;
        ctx.fill();
      }

      // Rotation animation
      const progress = f / frames;
      const eased = 1 - Math.pow(1 - progress, 3);
      const totalRotation = (2 * Math.PI) * 3;
      const finalAngle = -Math.PI / 2 - (resultIndex * segmentAngle + segmentAngle / 2);
      const angle = eased * totalRotation + finalAngle;

      // Draw segments
      for (let i = 0; i < totalSegments; i++) {
        const start = i * segmentAngle + angle;
        const end = start + segmentAngle;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, start, end);
        ctx.closePath();

        ctx.shadowBlur = 20;
        ctx.shadowColor = "rgba(255,215,0,0.2)";
        ctx.fillStyle = segments[i].color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#d4af37";
        ctx.lineWidth = 4;
        ctx.stroke();

        // Draw label
        const midAngle = start + segmentAngle / 2;
        const textX = centerX + Math.cos(midAngle) * (radius * 0.65);
        const textY = centerY + Math.sin(midAngle) * (radius * 0.65);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 36px Arial";
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#000000";
        
        // Show emoji + label
        ctx.fillText(segments[i].emoji, textX, textY - 20);
        ctx.font = "bold 32px Arial";
        ctx.fillText(segments[i].label, textX, textY + 30);
        ctx.shadowBlur = 0;
      }

      // Center circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, 28, 0, 2 * Math.PI);
      ctx.shadowBlur = 25;
      ctx.shadowColor = "#d4af37";
      ctx.fillStyle = "#d4af37";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.stroke();

      // Arrow pointer
      ctx.fillStyle = "#ff0000";
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#ff0000";
      ctx.beginPath();
      ctx.moveTo(W / 2 - 24, 22);
      ctx.lineTo(W / 2 + 24, 22);
      ctx.lineTo(W / 2, 2);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Outer glow
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 14, 0, 2 * Math.PI);
      ctx.shadowBlur = 40;
      ctx.shadowColor = "rgba(212,175,55,0.6)";
      ctx.strokeStyle = "rgba(212,175,55,0.7)";
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      encoder.addFrame(ctx);
    }

    encoder.finish();
    const buffer = encoder.out.getData();

    // Save and send GIF
    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    const filePath = path.join(cacheDir, `wheel_${Date.now()}.gif`);
    fs.writeFileSync(filePath, buffer);

    await api.unsendMessage(sent.messageID);

    const msg = `🎡 𝗪𝗛𝗘𝗘𝗟 𝗦𝗣𝗜𝗡

${status}
${resultSegment.emoji} Result: ${resultSegment.label}
💰 ${resultText}
💳 Balance: ${formatMoney(finalMoney)}$
📊 Usage: ${global.wheelLimit[senderID].count}/${maxSpins}`;

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
