module.exports = {
  config: {
    name: "pm",
    aliases: ["privatemessage"],
    version: "3.0",
    author: "luffy",
    countDown: 5,
    role: 2,

    shortDescription: {
      en: "Send a private message"
    },

    longDescription: {
      en: "Send a private message using ID, mention, or reply"
    },

    category: "box chat",

    guide: {
      en:
        "{p}pm USER_ID message\n" +
        "{p}pm @mention message\n" +
        "Reply to a message and use: {p}pm message"
    }
  },

  onStart: async function ({ api, event, args }) {
    try {
      let commandArgs = [...args];

      // Your fork includes "pm" in args.
      if (
        commandArgs[0] &&
        (
          commandArgs[0].toLowerCase() === "pm" ||
          commandArgs[0].toLowerCase() === "privatemessage"
        )
      ) {
        commandArgs.shift();
      }

      let targetID = null;
      let message = "";

      /*
       * ==============================
       * REPLY
       * ==============================
       */

      if (
        event.messageReply &&
        event.messageReply.senderID
      ) {
        targetID = event.messageReply.senderID;
        message = commandArgs.join(" ");
      }

      /*
       * ==============================
       * MENTION
       * ==============================
       */

      else if (
        event.mentions &&
        Object.keys(event.mentions).length > 0
      ) {
        targetID = Object.keys(event.mentions)[0];

        const mentionText =
          event.mentions[targetID];

        let text = commandArgs.join(" ");

        // Remove the COMPLETE mention.
        if (mentionText) {
          text = text.replace(mentionText, "");
        }

        message = text.trim();
      }

      /*
       * ==============================
       * USER ID
       * ==============================
       */

      else if (commandArgs.length >= 2) {
        targetID = commandArgs[0];

        message = commandArgs
          .slice(1)
          .join(" ");
      }

      /*
       * ==============================
       * VALIDATION
       * ==============================
       */

      if (!targetID) {
        return api.sendMessage(
          "❌ No user specified.\n\n" +
          "Examples:\n" +
          "pm 1000123456789 hello\n" +
          "pm @User hello\n" +
          "Reply to a message → pm hello",
          event.threadID,
          event.messageID
        );
      }

      if (!message.trim()) {
        return api.sendMessage(
          "❌ Message cannot be empty.",
          event.threadID,
          event.messageID
        );
      }

      console.log("========== PM DEBUG ==========");
      console.log("Target ID:", targetID);
      console.log("Message:", message);
      console.log("==============================");

      /*
       * ==============================
       * GET USER INFORMATION
       * ==============================
       */

      api.getUserInfo(
        targetID,
        (err, userInfo) => {

          if (err) {
            console.error(
              "[PM] getUserInfo ERROR:",
              err
            );

            return api.sendMessage(
              "❌ Cannot access that user's information.",
              event.threadID,
              event.messageID
            );
          }

          console.log(
            "[PM] User info:",
            userInfo
          );

          /*
           * ==============================
           * SEND
           * ==============================
           */

          api.sendMessage(
            {
              body: message.trim()
            },
            targetID,
            (sendErr, info) => {

              console.log(
                "[PM] sendMessage callback:",
                sendErr,
                info
              );

              if (sendErr) {
                console.error(
                  "[PM] SEND ERROR:",
                  sendErr
                );

                return api.sendMessage(
                  "❌ Failed to send private message.\n\n" +
                  "Error: " +
                  (
                    sendErr.errorDescription ||
                    sendErr.message ||
                    JSON.stringify(sendErr)
                  ),
                  event.threadID,
                  event.messageID
                );
              }

              /*
               * Some FCA versions return an object
               * with null IDs, so don't use that alone
               * as the success condition.
               */

              return api.sendMessage(
                "✅ Message sent to " +
                (
                  userInfo[targetID]?.name ||
                  "the user"
                ) +
                ".",
                event.threadID,
                event.messageID
              );
            }
          );
        }
      );

    } catch (error) {

      console.error(
        "[PM] FATAL ERROR:",
        error
      );

      return api.sendMessage(
        "❌ PM error:\n" + error.message,
        event.threadID,
        event.messageID
      );
    }
  }
};
