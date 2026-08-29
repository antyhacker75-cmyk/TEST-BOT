const fs = require('fs-extra');
const path = require('path');

module.exports = {
  config: {
    name: "autoseen",
    version: "1.0.0",
    author: "Renz",
    role: 2, // 2 = Admin
    usePrefix: true,
    description: "Turn on/off automatically seen when new messages are available",
    guide: "{pn} on/off",
    category: "system",
    cooldowns: 5
  },

  onStart: async function ({ api, event, args, message }) {
    // Path: cmds/autoseen/autoseen.txt
    const pathFile = path.join(__dirname, 'autoseen', 'autoseen.txt');
    
    try {
      // Ensure the autoseen folder exists
      const dir = path.dirname(pathFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Create file if not exists
      if (!fs.existsSync(pathFile)) {
        fs.writeFileSync(pathFile, 'false');
      }

      if (args[0]?.toLowerCase() === 'on') {
        fs.writeFileSync(pathFile, 'true');
        return message.reply('✅ The autoseen function is now **enabled** for new messages.');
      } 
      else if (args[0]?.toLowerCase() === 'off') {
        fs.writeFileSync(pathFile, 'false');
        return message.reply('❌ The autoseen function has been **disabled** for new messages.');
      } 
      else {
        const status = fs.readFileSync(pathFile, 'utf-8');
        const statusText = status === 'true' ? '✅ ENABLED' : '❌ DISABLED';
        return message.reply(`📌 Autoseen Status: ${statusText}\n\nUsage: /autoseen on | off`);
      }
    } 
    catch (error) {
      console.error("Autoseen error:", error);
      return message.reply('⚠️ An error occurred while processing your request.');
    }
  },

  handleEvent: async function ({ api, event }) {
    // Path: cmds/autoseen/autoseen.txt
    const pathFile = path.join(__dirname, 'autoseen', 'autoseen.txt');
    
    try {
      // Check if file exists, create if not
      if (!fs.existsSync(pathFile)) {
        const dir = path.dirname(pathFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(pathFile, 'false');
      }
      
      const isEnable = fs.readFileSync(pathFile, 'utf-8');
      if (isEnable === 'true') {
        // Use the markAsRead function with current timestamp
        await api.markAsRead(Date.now());
      }
    } 
    catch (error) {
      // Silent fail for events to avoid spam
      console.error("Autoseen event error:", error);
    }
  }
};
