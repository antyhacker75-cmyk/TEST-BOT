const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

module.exports = {
  config: {
    name: "changeavatar",
    version: "10.0.0",
    author: "Jantzy Acc + ChatGPT",
    role: 5,
    usePrefix: true,
    description: "Change bot avatar with image or URL",
    guide: "{pn} - Then send image URL or attach photo",
    category: "System",
    cooldowns: 5
  },

  onStart: async function ({ api, event, message }) {
    try {
      const reply = await message.reply(
        "📤 **CHANGE AVATAR**\n\n" +
        "Send an **image URL** or **attach a photo** in your next message.\n\n" +
        "⏳ Waiting for image..."
      );

      if (!global.client.handleReply) {
        global.client.handleReply = [];
      }

      global.client.handleReply.push({
        name: this.config.name,
        type: "avatarInput",
        messageID: reply.messageID,
        author: event.senderID
      });

    } catch (error) {
      console.error("[CHANGEAVATAR] onStart error:", error);
    }
  },

  onReply: async function ({ api, event, handleReply, message }) {
    if (!handleReply) return;

    if (event.senderID !== handleReply.author) {
      return;
    }

    if (handleReply.type !== "avatarInput") {
      return;
    }

    const { threadID, body, attachments } = event;

    let imgPath = null;

    try {
      /*
       * ==========================================
       * GET IMAGE URL
       * ==========================================
       */

      let imageURL = null;

      // Attached Messenger/Facebook photo
      if (
        Array.isArray(attachments) &&
        attachments.length > 0
      ) {
        const photo = attachments.find(
          att =>
            att &&
            (
              att.type === "photo" ||
              att.type === "image"
            )
        );

        if (photo) {
          imageURL =
            photo.url ||
            photo.largePreviewUrl ||
            photo.previewUrl;
        }
      }

      // Image URL sent as text
      if (!imageURL && body) {
        const text = body.trim();

        if (/^https?:\/\//i.test(text)) {
          imageURL = text;
        }
      }

      if (!imageURL) {
        return message.reply(
          "❌ **Invalid image input.**\n\n" +
          "Please attach a photo or send a direct image URL."
        );
      }

      /*
       * ==========================================
       * CACHE DIRECTORY
       * ==========================================
       */

      const cacheDir = path.join(__dirname, "cache");

      await fs.ensureDir(cacheDir);

      const fileName =
        `avatar_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 8)}.jpg`;

      imgPath = path.join(cacheDir, fileName);

      /*
       * ==========================================
       * DOWNLOAD IMAGE
       * ==========================================
       */

      let downloadResponse;

      try {
        downloadResponse = await axios.get(imageURL, {
          responseType: "arraybuffer",
          timeout: 30000,
          maxContentLength: 15 * 1024 * 1024,
          maxBodyLength: 15 * 1024 * 1024,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });
      } catch (downloadError) {
        console.error(
          "[CHANGEAVATAR] Download error:",
          downloadError.message
        );

        return message.reply(
          "❌ **Failed to download the image.**\n\n" +
          "Make sure the URL is publicly accessible and points to an image."
        );
      }

      const contentType =
        downloadResponse.headers["content-type"] || "";

      if (
        contentType &&
        !contentType.startsWith("image/")
      ) {
        console.warn(
          "[CHANGEAVATAR] Content-Type:",
          contentType
        );

        // Some image hosts don't return the correct content type,
        // so we don't immediately reject it.
      }

      await fs.writeFile(
        imgPath,
        Buffer.from(downloadResponse.data)
      );

      /*
       * ==========================================
       * CHECK FILE
       * ==========================================
       */

      if (!(await fs.pathExists(imgPath))) {
        throw new Error("Downloaded image file does not exist.");
      }

      const stats = await fs.stat(imgPath);

      if (stats.size < 100) {
        throw new Error("Downloaded image is empty or invalid.");
      }

      console.log(
        "[CHANGEAVATAR] Image downloaded:",
        imgPath,
        stats.size,
        "bytes"
      );

      /*
       * ==========================================
       * PROGRESS MESSAGE
       * ==========================================
       */

      const steps = [
        "✨ **PREPARING AVATAR UPDATE**\n" +
        "▰▱▱▱▱ 20%",

        "✨ **PROCESSING IMAGE**\n" +
        "▰▰▱▱▱ 40%",

        "🎨 **OPTIMIZING IMAGE**\n" +
        "▰▰▰▱▱ 60%",

        "⚙️ **APPLYING AVATAR**\n" +
        "▰▰▰▰▱ 80%",

        "✔️ **FINALIZING**\n" +
        "▰▰▰▰▰ 100%"
      ];

      let progressMessageID = handleReply.messageID;

      /*
       * ==========================================
       * EDIT MESSAGE HELPER
       * ==========================================
       */

      const editProgress = async (text) => {
        return new Promise((resolve, reject) => {
          if (!api.editMessage) {
            return reject(
              new Error("api.editMessage is unavailable.")
            );
          }

          let finished = false;

          const done = (err) => {
            if (finished) return;
            finished = true;

            if (err) {
              reject(err);
            } else {
              resolve();
            }
          };

          try {
            const result = api.editMessage(
              text,
              progressMessageID,
              done
            );

            // Some APIs return a Promise
            if (
              result &&
              typeof result.then === "function"
            ) {
              result
                .then(() => done())
                .catch(done);
            }
          } catch (error) {
            done(error);
          }
        });
      };

      /*
       * ==========================================
       * SHOW PROGRESS
       * ==========================================
       */

      for (let i = 0; i < steps.length; i++) {
        try {
          await editProgress(steps[i]);
        } catch (editError) {
          console.error(
            "[CHANGEAVATAR] Progress edit error:",
            editError.message
          );

          // If editing fails on the first step,
          // create a new message instead.
          if (i === 0) {
            try {
              const newMessage =
                await message.reply(steps[i]);

              if (newMessage?.messageID) {
                progressMessageID =
                  newMessage.messageID;
              }
            } catch (replyError) {
              console.error(
                "[CHANGEAVATAR] Progress reply error:",
                replyError.message
              );
            }
          }
        }

        await new Promise(resolve =>
          setTimeout(resolve, 700)
        );
      }

      /*
       * ==========================================
       * GET BOT ID
       * ==========================================
       */

      const botID =
        typeof api.getCurrentUserID === "function"
          ? api.getCurrentUserID()
          : null;

      if (!botID) {
        throw new Error(
          "Unable to get bot/user ID."
        );
      }

      /*
       * ==========================================
       * GET ACCESS TOKEN
       * ==========================================
       */

      let accessToken = null;

      try {
        if (
          global.bot &&
          global.bot.accessToken
        ) {
          accessToken = global.bot.accessToken;
        }
      } catch (e) {}

      if (
        !accessToken &&
        typeof api.getAccessToken === "function"
      ) {
        try {
          accessToken = api.getAccessToken();
        } catch (e) {}
      }

      /*
       * ==========================================
       * CHANGE AVATAR
       * ==========================================
       */

      let avatarChanged = false;
      let graphError = null;

      /*
       * METHOD 1
       * Graph API
       */

      if (accessToken) {
        try {
          console.log(
            "[CHANGEAVATAR] Trying Graph API..."
          );

          const form = new FormData();

          form.append(
            "source",
            fs.createReadStream(imgPath)
          );

          form.append(
            "access_token",
            accessToken
          );

          const graphURL =
            `https://graph.facebook.com/v19.0/${botID}/picture`;

          const response =
            await axios.post(
              graphURL,
              form,
              {
                headers: {
                  ...form.getHeaders(),

                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",

                  "Accept":
                    "application/json"
                },

                timeout: 30000,

                maxContentLength:
                  20 * 1024 * 1024,

                maxBodyLength:
                  20 * 1024 * 1024
              }
            );

          console.log(
            "[CHANGEAVATAR] Graph response:",
            response.data
          );

          if (
            response.data &&
            (
              response.data.success === true ||
              response.data.success === undefined
            )
          ) {
            avatarChanged = true;
          }

        } catch (graphErr) {
          graphError = graphErr;

          console.error(
            "[CHANGEAVATAR] Graph API error:"
          );

          console.error(
            graphErr.response?.data ||
            graphErr.message
          );
        }
      } else {
        console.warn(
          "[CHANGEAVATAR] No access token found."
        );
      }

      /*
       * ==========================================
       * METHOD 2
       * api.changeAvatar
       *
       * IMPORTANT:
       * Keep the file because it may still be
       * needed by this method.
       * ==========================================
       */

      if (
        !avatarChanged &&
        typeof api.changeAvatar === "function"
      ) {
        try {
          console.log(
            "[CHANGEAVATAR] Trying api.changeAvatar..."
          );

          await new Promise(
            (resolve, reject) => {
              const stream =
                fs.createReadStream(imgPath);

              stream.on(
                "error",
                reject
              );

              api.changeAvatar(
                stream,
                (err) => {
                  if (err) {
                    reject(err);
                  } else {
                    resolve();
                  }
                }
              );
            }
          );

          avatarChanged = true;

        } catch (avatarError) {
          console.error(
            "[CHANGEAVATAR] api.changeAvatar error:",
            avatarError.message
          );
        }
      }

      /*
       * ==========================================
       * SUCCESS
       * ==========================================
       */

      if (avatarChanged) {
        const profileURL =
          `https://facebook.com/${botID}`;

        const successText =
          "╔═══ ✅ AVATAR CHANGED ═══╗\n" +
          "║\n" +
          "║ 👤 Profile: " +
          profileURL +
          "\n" +
          "║ 📸 New avatar applied!\n" +
          "║ ✅ Successfully updated\n" +
          "║\n" +
          "╚═══════════════════════════╝";

        try {
          await editProgress(
            successText
          );
        } catch (e) {
          await message.reply(
            successText
          );
        }

        return;
      }

      /*
       * ==========================================
       * FAILED
       * ==========================================
       */

      let errorMessage =
        "Unknown error.";

      if (graphError) {
        errorMessage =
          graphError.response?.data?.error?.message ||
          graphError.response?.data?.error?.error_user_msg ||
          graphError.message ||
          "Graph API request failed.";
      }

      const failedText =
        "╔═══ ❌ AVATAR FAILED ═══╗\n" +
        "║\n" +
        "║ ❌ Could not change avatar.\n" +
        "║\n" +
        "║ 📌 Reason:\n" +
        "║ " +
        errorMessage.substring(0, 500) +
        "\n" +
        "║\n" +
        "║ 💡 Check your bot API/token\n" +
        "║ and make sure avatar changing\n" +
        "║ is supported by your account.\n" +
        "║\n" +
        "╚═══════════════════════════╝";

      try {
        await editProgress(
          failedText
        );
      } catch (e) {
        await message.reply(
          failedText
        );
      }

    } catch (error) {
      console.error(
        "[CHANGEAVATAR] Fatal error:",
        error
      );

      try {
        await message.reply(
          "❌ **Avatar change failed.**\n\n" +
          `📌 Error: ${error.message}`
        );
      } catch (replyError) {
        console.error(
          "[CHANGEAVATAR] Reply error:",
          replyError
        );
      }

    } finally {
      /*
       * ==========================================
       * CLEANUP
       * ==========================================
       *
       * This happens ONLY after all avatar
       * operations have finished.
       */

      if (imgPath) {
        try {
          if (await fs.pathExists(imgPath)) {
            await fs.remove(imgPath);

            console.log(
              "[CHANGEAVATAR] Temporary image deleted."
            );
          }
        } catch (cleanupError) {
          console.error(
            "[CHANGEAVATAR] Cleanup error:",
            cleanupError.message
          );
        }
      }

      /*
       * Remove the handleReply entry
       */

      try {
        if (
          global.client &&
          Array.isArray(
            global.client.handleReply
          )
        ) {
          global.client.handleReply =
            global.client.handleReply.filter(
              item =>
                !(
                  item.name ===
                    this.config.name &&
                  item.messageID ===
                    handleReply.messageID &&
                  item.author ===
                    handleReply.author
                )
            );
        }
      } catch (cleanupReplyError) {
        console.error(
          "[CHANGEAVATAR] handleReply cleanup error:",
          cleanupReplyError.message
        );
      }
    }
  }
};
