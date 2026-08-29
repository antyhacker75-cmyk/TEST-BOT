const { loadImage, createCanvas } = require("canvas");
const fs = require("fs-extra");
const axios = require("axios");
const path = require("path");

module.exports = {
  config: {
    name: "post",
    author: "AceGun",
    countDown: 5,
    role: 0,
    category: "fun",
    shortDescription: {
      en: "mentioned your friend and write something to post✍️",
    },
    guide: {
      en: "{p}post @mention | your message"
    }
  },

  wrapText: async function (ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let line = "";

    for (const word of words) {
      const currentLine = `${line}${word} `;
      const currentLineWidth = ctx.measureText(currentLine).width;
      if (currentLineWidth <= maxWidth) {
        line = currentLine;
      } else {
        lines.push(line.trim());
        line = `${word} `;
      }
    }

    lines.push(line.trim());
    return lines;
  },

  // Function to create a default avatar if needed
  createDefaultAvatar: async function() {
    const canvas = createCanvas(200, 200);
    const ctx = canvas.getContext("2d");
    
    // Draw a circle with gradient
    const gradient = ctx.createRadialGradient(100, 100, 0, 100, 100, 100);
    gradient.addColorStop(0, '#4CAF50');
    gradient.addColorStop(1, '#2E7D32');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(100, 100, 100, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw a user icon
    ctx.fillStyle = 'white';
    ctx.font = '80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👤', 100, 100);
    
    return canvas.toBuffer();
  },

  onStart: async function ({ args, usersData, threadsData, api, event }) {
    // Ensure cache directory exists
    const cacheDir = path.join(__dirname, 'cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    try {
      // Check if the message contains a mention and the pipe separator
      if (!event.mentions || Object.keys(event.mentions).length === 0) {
        return api.sendMessage(
          "❌ Please mention someone and add a message.\n\nExample: {p}post @username | Your message here",
          event.threadID,
          event.messageID
        );
      }

      // Check if message contains the pipe separator
      const fullMessage = args.join(" ");
      if (!fullMessage.includes("|")) {
        return api.sendMessage(
          "❌ Please use the '|' separator.\n\nExample: {p}post @username | Your message here",
          event.threadID,
          event.messageID
        );
      }

      // Get the mentioned user ID
      const mentionedID = Object.keys(event.mentions)[0];
      const mentionedName = event.mentions[mentionedID];

      // Get the comment text (everything after the pipe)
      const commentText = fullMessage.split("|").slice(1).join("|").trim();
      
      if (!commentText) {
        return api.sendMessage(
          "❌ Please add a message after the '|' separator.",
          event.threadID,
          event.messageID
        );
      }

      // Get user info
      let userName = mentionedName;
      try {
        const userInfo = await api.getUserInfo(mentionedID);
        userName = userInfo[mentionedID].name;
      } catch (err) {
        console.log("Could not get user info, using mention name:", err);
      }

      // Setup paths with proper cache directory
      const pathImg = path.join(cacheDir, 'background.png');
      const pathAvt1 = path.join(cacheDir, 'Avtmot.png');
      const pathDefaultAvatar = path.join(cacheDir, 'default_avatar.png');
      
      // Create default avatar if it doesn't exist
      if (!fs.existsSync(pathDefaultAvatar)) {
        const defaultAvatarBuffer = await this.createDefaultAvatar();
        fs.writeFileSync(pathDefaultAvatar, defaultAvatarBuffer);
      }

      // Background image URLs
      const backgrounds = [
        "https://i.ibb.co/9478549/image.jpg",
        "https://i.ibb.co/wJBkF7W/background1.jpg",
        "https://i.ibb.co/5xVqP9q/background2.jpg"
      ];
      
      const backgroundURL = backgrounds[Math.floor(Math.random() * backgrounds.length)];

      let avatarDownloaded = false;

      try {
        // Method 1: Get profile picture with redirect=false
        const avatarURL = `https://graph.facebook.com/${mentionedID}/picture?width=720&height=720&redirect=false`;
        
        const avatarResponse = await axios.get(avatarURL, {
          responseType: "json",
          timeout: 10000
        });

        let actualAvatarURL = avatarURL;
        if (avatarResponse.data && avatarResponse.data.data && avatarResponse.data.data.url) {
          actualAvatarURL = avatarResponse.data.data.url;
        }

        console.log("📸 Fetching avatar from:", actualAvatarURL);

        const getAvtmot = await axios.get(actualAvatarURL, {
          responseType: "arraybuffer",
          timeout: 15000
        });
        fs.writeFileSync(pathAvt1, Buffer.from(getAvtmot.data));
        avatarDownloaded = true;

      } catch (err) {
        console.error("❌ Error downloading avatar:", err.message);
        
        try {
          // Method 2: Try alternate URL
          console.log("🔄 Trying fallback avatar URL...");
          const fallbackURL = `https://graph.facebook.com/${mentionedID}/picture?type=large`;
          const getAvtmot = await axios.get(fallbackURL, {
            responseType: "arraybuffer",
            timeout: 15000
          });
          fs.writeFileSync(pathAvt1, Buffer.from(getAvtmot.data));
          avatarDownloaded = true;
        } catch (fallbackErr) {
          console.error("❌ Fallback also failed:", fallbackErr.message);
          
          // Method 3: Use default avatar
          console.log("🔄 Using default avatar...");
          fs.copyFileSync(pathDefaultAvatar, pathAvt1);
          avatarDownloaded = true;
        }
      }

      // Download background
      try {
        console.log("📸 Fetching background from:", backgroundURL);
        const getbackground = await axios.get(backgroundURL, {
          responseType: "arraybuffer",
          timeout: 15000
        });
        fs.writeFileSync(pathImg, Buffer.from(getbackground.data));
      } catch (bgErr) {
        console.error("❌ Error downloading background:", bgErr.message);
        // Create a simple gradient background
        console.log("🔄 Creating fallback background...");
        const canvas = createCanvas(800, 500);
        const ctx = canvas.getContext("2d");
        const gradient = ctx.createLinearGradient(0, 0, 800, 500);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 800, 500);
        fs.writeFileSync(pathImg, canvas.toBuffer());
      }

      // Load images and create canvas
      const baseImage = await loadImage(pathImg);
      const baseAvt1 = await loadImage(pathAvt1);
      
      const canvas = createCanvas(baseImage.width || 800, baseImage.height || 500);
      const ctx = canvas.getContext("2d");
      
      // Draw background
      ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

      // Draw avatar (circular)
      const avatarX = 20;
      const avatarY = 24;
      const avatarWidth = 80;
      const avatarHeight = 80;

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarWidth/2, avatarY + avatarHeight/2, avatarWidth/2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(baseAvt1, avatarX, avatarY, avatarWidth, avatarHeight);
      ctx.restore();

      // Draw a border around avatar
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(avatarX + avatarWidth/2, avatarY + avatarHeight/2, avatarWidth/2, 0, Math.PI * 2);
      ctx.stroke();

      // Draw name
      ctx.font = "bold 23px Arial";
      ctx.fillStyle = "#000000";
      const nameLines = await this.wrapText(ctx, userName, canvas.width - 200);
      nameLines.forEach((line, index) => {
        ctx.fillText(line, 120, 50 + index * 28);
      });

      // Draw comment
      ctx.font = "400 23px Arial";
      ctx.fillStyle = "#000000";
      const commentLines = await this.wrapText(ctx, commentText, canvas.width - 100);
      commentLines.forEach((line, index) => {
        ctx.fillText(line, 45, 150 + index * 28);
      });

      // Save and send
      const imageBuffer = canvas.toBuffer();
      fs.writeFileSync(pathImg, imageBuffer);
      
      // Clean up avatar file
      if (fs.existsSync(pathAvt1) && pathAvt1 !== pathDefaultAvatar) {
        fs.unlinkSync(pathAvt1);
      }

      // Send the image
      return api.sendMessage(
        {
          body: `📝 Post by ${userName}`,
          attachment: fs.createReadStream(pathImg),
        },
        event.threadID,
        () => {
          if (fs.existsSync(pathImg)) fs.unlinkSync(pathImg);
        },
        event.messageID
      );

    } catch (error) {
      console.error("❌ Post command error:", error);
      
      // Clean up files
      const filesToClean = [
        path.join(cacheDir, 'background.png'),
        path.join(cacheDir, 'Avtmot.png')
      ];
      filesToClean.forEach(file => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      });

      return api.sendMessage(
        `❌ An error occurred: ${error.message}`,
        event.threadID,
        event.messageID
      );
    }
  }
};
