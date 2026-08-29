const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

module.exports = {
  config: {
    name: "createpost",
    version: "2.0.0",
    author: "Renz",
    role: 2,
    usePrefix: true,
    description: "Create a new post on your Facebook timeline with full control",
    guide: "{pn} [content]",
    category: "operator",
    cooldowns: 5,
    aliases: ["bot_post", "post"]
  },

  onStart: async function ({ api, event, args, message }) {
    const { threadID, messageID, senderID } = event;
    const uuid = getGUID();
    
    // Initialize onReply if it doesn't exist
    if (!global.GoatBot) global.GoatBot = {};
    if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
    
    // If there are arguments, use them as the post content
    if (args && args.length > 0) {
      const content = args.join(' ');
      
      // Create a post directly with the content
      const formData = {
        input: {
          composer_entry_point: "inline_composer",
          composer_source_surface: "timeline",
          idempotence_token: uuid + "_FEED",
          source: "WWW",
          attachments: [],
          audience: {
            privacy: {
              allow: [],
              base_state: "EVERYONE",
              deny: [],
              tag_expansion_state: "UNSPECIFIED"
            }
          },
          message: {
            ranges: [],
            text: content
          },
          with_tags_ids: [],
          inline_activities: [],
          explicit_place_id: "0",
          text_format_preset_id: "0",
          logging: {
            composer_session_id: uuid
          },
          tracking: [null],
          actor_id: api.getCurrentUserID(),
          client_mutation_id: Math.floor(Math.random() * 17)
        },
        displayCommentsFeedbackContext: null,
        displayCommentsContextEnableComment: null,
        displayCommentsContextIsAdPreview: null,
        displayCommentsContextIsAggregatedShare: null,
        displayCommentsContextIsStorySet: null,
        feedLocation: "TIMELINE",
        feedbackSource: 0,
        focusCommentID: null,
        gridMediaWidth: 230,
        groupID: null,
        scale: 3,
        privacySelectorRenderLocation: "COMET_STREAM",
        renderLocation: "timeline",
        useDefaultActor: false,
        inviteShortLinkKey: null,
        isFeed: false,
        isFundraiser: false,
        isFunFactPost: false,
        isGroup: false,
        isTimeline: true,
        isSocialLearning: false,
        isPageNewsFeed: false,
        isProfileReviews: false,
        isWorkSharedDraft: false,
        UFI2CommentsProvider_commentsKey: "ProfileCometTimelineRoute",
        hashtag: null,
        canUserManageOffers: false
      };

      const botID = api.getCurrentUserID();
      
      // Create the post
      const form = {
        av: botID,
        fb_api_req_friendly_name: "ComposerStoryCreateMutation",
        fb_api_caller_class: "RelayModern",
        doc_id: "7711610262190099",
        variables: JSON.stringify(formData)
      };

      const creatingMsg = await message.reply('📝 Creating your post...');

      api.httpPost('https://www.facebook.com/api/graphql/', form, (e, info) => {
        try {
          if (e) throw e;
          if (typeof info == "string") {
            info = JSON.parse(info.replace("for (;;);", ""));
          }
          
          const postID = info.data?.story_create?.story?.legacy_story_hideable_id;
          const urlPost = info.data?.story_create?.story?.url;
          
          if (!postID) throw info.errors || new Error('Failed to create post');
          
          api.unsendMessage(creatingMsg.messageID);
          
          return api.sendMessage(
            `✅ Post created successfully!\n\n📌 Post ID: ${postID}\n🔗 Link: ${urlPost}`,
            threadID,
            messageID
          );
        } catch (err) {
          console.error('Post creation error:', err);
          api.unsendMessage(creatingMsg.messageID);
          return api.sendMessage(
            `❌ Failed to create post. Please try again later.`,
            threadID,
            messageID
          );
        }
      });
      
      return;
    }

    // If no arguments, start the interactive flow
    const postData = {
      formData: {
        input: {
          composer_entry_point: "inline_composer",
          composer_source_surface: "timeline",
          idempotence_token: uuid + "_FEED",
          source: "WWW",
          attachments: [],
          audience: {
            privacy: {
              allow: [],
              base_state: "FRIENDS",
              deny: [],
              tag_expansion_state: "UNSPECIFIED"
            }
          },
          message: {
            ranges: [],
            text: ""
          },
          with_tags_ids: [],
          inline_activities: [],
          explicit_place_id: "0",
          text_format_preset_id: "0",
          logging: {
            composer_session_id: uuid
          },
          tracking: [null],
          actor_id: api.getCurrentUserID(),
          client_mutation_id: Math.floor(Math.random() * 17)
        },
        displayCommentsFeedbackContext: null,
        displayCommentsContextEnableComment: null,
        displayCommentsContextIsAdPreview: null,
        displayCommentsContextIsAggregatedShare: null,
        displayCommentsContextIsStorySet: null,
        feedLocation: "TIMELINE",
        feedbackSource: 0,
        focusCommentID: null,
        gridMediaWidth: 230,
        groupID: null,
        scale: 3,
        privacySelectorRenderLocation: "COMET_STREAM",
        renderLocation: "timeline",
        useDefaultActor: false,
        inviteShortLinkKey: null,
        isFeed: false,
        isFundraiser: false,
        isFunFactPost: false,
        isGroup: false,
        isTimeline: true,
        isSocialLearning: false,
        isPageNewsFeed: false,
        isProfileReviews: false,
        isWorkSharedDraft: false,
        UFI2CommentsProvider_commentsKey: "ProfileCometTimelineRoute",
        hashtag: null,
        canUserManageOffers: false
      },
      audience: "FRIENDS",
      caption: "",
      // images: [],
      // imageIds: []
    };

    // Send the initial message
    const msg = await api.sendMessage(
      `📝 Choose who can see this post:\n\n1️⃣ Everyone\n2️⃣ Friends\n3️⃣ Only Me`,
      threadID
    );

    // Store the reply handler in GoatBot.onReply (Map)
    if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
    global.GoatBot.onReply.set(msg.messageID, {
      commandName: this.config.name,
      author: senderID,
      postData: postData,
      type: "whoSee"
    });

    return;
  },

  onReply: async function ({ api, event, Reply, getLang }) {
    console.log('onReply triggered:', event.body);
    
    // Extract data from Reply object
    const { author, postData, type } = Reply;
    const { threadID, messageID, senderID, attachments, body } = event;
    const botID = api.getCurrentUserID();

    if (!Reply) {
      console.log('No Reply found');
      return;
    }

    if (event.senderID != author) {
      console.log('Not the author');
      return;
    }

    /* // COMMENTED OUT: Image upload functionality
    // Helper to upload images using the correct method
    async function uploadImages(attachments) {
      const uploadedIds = [];
      const cacheDir = path.join(__dirname, 'cache');
      
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      for (const attachment of attachments) {
        if (attachment.type !== "photo") continue;
        
        try {
          const pathImage = path.join(cacheDir, `upload_${Date.now()}.png`);
          
          // Download image
          const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
          fs.writeFileSync(pathImage, Buffer.from(response.data));
          
          // Create form data for upload
          const formData = new FormData();
          formData.append('file', fs.createReadStream(pathImage));
          formData.append('profile_id', botID);
          formData.append('photo_source', '57');
          formData.append('av', botID);
          
          // Use api.httpPostFormData if available, otherwise use the alternative
          let uploadResult;
          try {
            // Try using httpPostFormData
            uploadResult = await api.httpPostFormData(
              `https://www.facebook.com/profile/picture/upload/?profile_id=${botID}&photo_source=57&av=${botID}`,
              { file: fs.createReadStream(pathImage) }
            );
          } catch (err) {
            // Alternative method using httpPost with FormData
            const form = new FormData();
            form.append('file', fs.createReadStream(pathImage));
            form.append('profile_id', botID);
            form.append('photo_source', '57');
            form.append('av', botID);
            
            uploadResult = await new Promise((resolve, reject) => {
              api.httpPost(
                `https://www.facebook.com/profile/picture/upload/?profile_id=${botID}&photo_source=57&av=${botID}`,
                form,
                (err, res) => {
                  if (err) reject(err);
                  else resolve(res);
                }
              );
            });
          }
          
          let result = uploadResult;
          if (typeof result === 'string') {
            result = JSON.parse(result.replace('for (;;);', ''));
          }
          
          if (result && result.payload && result.payload.fbid) {
            uploadedIds.push(result.payload.fbid.toString());
          }
          
          // Cleanup
          try { fs.unlinkSync(pathImage); } catch(e) {}
          
        } catch (err) {
          console.error('Upload error for image:', err);
        }
      }
      
      return uploadedIds;
    }
    */

    // Helper to show overview (without images)
    function showOverview(data) {
      const privacyMap = {
        "EVERYONE": "🌍 Everyone",
        "FRIENDS": "👥 Friends",
        "SELF": "🔒 Only Me"
      };
      
      return `📋 **POST OVERVIEW**

👁️ Audience: ${privacyMap[data.audience] || data.audience}
📝 Caption: ${data.caption || "(Empty)"}

1️⃣ Edit
2️⃣ Confirm
3️⃣ Cancel`;
    }

    if (type == "whoSee") {
      // Validate the input
      if (!["1", "2", "3"].includes(body.trim())) {
        return api.sendMessage('❌ Please choose 1, 2, or 3', threadID, messageID);
      }
      
      // Set the privacy based on user choice
      const privacyMap = {
        "1": "EVERYONE",
        "2": "FRIENDS",
        "3": "SELF"
      };
      
      postData.audience = privacyMap[body.trim()];
      postData.formData.input.audience.privacy.base_state = postData.audience;
      
      // Unsend the previous message
      await api.unsendMessage(Reply.messageID);
      
      const msg = await api.sendMessage(
        `👥 Audience: ${postData.audience}\n\n📝 Enter your caption (or reply "skip" to ignore)`,
        threadID
      );

      // Store the next reply handler
      if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
      global.GoatBot.onReply.set(msg.messageID, {
        commandName: this.config.name,
        author: senderID,
        postData: postData,
        type: "caption"
      });
    }
    else if (type == "caption") {
      // Save the content
      if (body.trim().toLowerCase() != "skip" && body.trim() != "") {
        postData.caption = body;
        postData.formData.input.message.text = body;
      }
      
      // Unsend the previous message
      await api.unsendMessage(Reply.messageID);
      
      /* // COMMENTED OUT: Skip image step and go directly to overview
      const msg = await api.sendMessage(
        `📝 Caption: ${postData.caption || "(Empty)"}\n\n🖼️ Send image(s) or reply "skip" to ignore`,
        threadID
      );

      // Store the next reply handler
      if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
      global.GoatBot.onReply.set(msg.messageID, {
        commandName: this.config.name,
        author: senderID,
        postData: postData,
        type: "images"
      });
      */
      
      // Skip image step - go directly to overview
      const overview = showOverview(postData);
      const msg = await api.sendMessage(overview, threadID);

      if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
      global.GoatBot.onReply.set(msg.messageID, {
        commandName: this.config.name,
        author: senderID,
        postData: postData,
        type: "overview"
      });
    }
    /* // COMMENTED OUT: Image handling step
    else if (type == "images") {
      // Process images if any
      if (body.trim().toLowerCase() != "skip" && attachments && attachments.length > 0) {
        const imageIds = await uploadImages(attachments);
        if (imageIds.length > 0) {
          postData.imageIds = imageIds;
          for (const id of imageIds) {
            postData.formData.input.attachments.push({
              "photo": { "id": id }
            });
          }
        }
      }

      // Unsend the previous message
      await api.unsendMessage(Reply.messageID);
      
      // Show overview
      const overview = showOverview(postData);
      const msg = await api.sendMessage(overview, threadID);

      // Store the next reply handler
      if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
      global.GoatBot.onReply.set(msg.messageID, {
        commandName: this.config.name,
        author: senderID,
        postData: postData,
        type: "overview"
      });
    }
    */
    else if (type == "overview") {
      const choice = body.trim();
      
      if (choice === "1") {
        // Edit
        await api.unsendMessage(Reply.messageID);
        
        const msg = await api.sendMessage(
          `✏️ What do you want to edit?\n\n1️⃣ Audience\n2️⃣ Caption`,
          threadID
        );
        
        if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
        global.GoatBot.onReply.set(msg.messageID, {
          commandName: this.config.name,
          author: senderID,
          postData: postData,
          type: "editChoice"
        });
      }
      else if (choice === "2") {
        // Confirm - Create the post
        await api.unsendMessage(Reply.messageID);
        
        const creatingMsg = await api.sendMessage('⏳ Creating your post...', threadID);
        
        const form = {
          av: botID,
          fb_api_req_friendly_name: "ComposerStoryCreateMutation",
          fb_api_caller_class: "RelayModern",
          doc_id: "7711610262190099",
          variables: JSON.stringify(postData.formData)
        };
        
        api.httpPost('https://www.facebook.com/api/graphql/', form, (e, info) => {
          try {
            if (e) throw e;
            if (typeof info == "string") {
              info = JSON.parse(info.replace("for (;;);", ""));
            }
            
            const postID = info.data?.story_create?.story?.legacy_story_hideable_id;
            const urlPost = info.data?.story_create?.story?.url;
            
            if (!postID) throw info.errors || new Error('Failed to create post');
            
            // Clean up cache
            try {
              const cacheDir = path.join(__dirname, 'cache');
              if (fs.existsSync(cacheDir)) {
                const files = fs.readdirSync(cacheDir);
                for (const file of files) {
                  if (file.includes('upload_') || file.includes('imagePost') || file.includes('videoPost')) {
                    fs.unlinkSync(path.join(cacheDir, file));
                  }
                }
              }
            } catch(cleanupErr) {
              // Ignore cleanup errors
            }
            
            api.unsendMessage(creatingMsg.messageID);
            
            const privacyMap = {
              "EVERYONE": "🌍 Everyone",
              "FRIENDS": "👥 Friends",
              "SELF": "🔒 Only Me"
            };
            
            return api.sendMessage(
              `✅ **POST CREATED SUCCESSFULLY!**\n\n` +
              `👁️ Audience: ${privacyMap[postData.audience]}\n` +
              `📝 Caption: ${postData.caption || "(Empty)"}\n\n` +
              `📌 Post ID: ${postID}\n` +
              `🔗 Link: ${urlPost}`,
              threadID,
              messageID
            );
          } catch (err) {
            console.error('Post creation error:', err);
            api.unsendMessage(creatingMsg.messageID);
            return api.sendMessage(
              `❌ Failed to create post. Error: ${err.message || 'Unknown error'}`,
              threadID,
              messageID
            );
          }
        });
      }
      else if (choice === "3") {
        // Cancel
        await api.unsendMessage(Reply.messageID);
        return api.sendMessage('❌ Post creation cancelled.', threadID, messageID);
      }
      else {
        return api.sendMessage('❌ Invalid choice. Please choose 1, 2, or 3', threadID, messageID);
      }
    }
    else if (type == "editChoice") {
      const choice = body.trim();
      
      if (choice === "1") {
        // Edit Audience
        await api.unsendMessage(Reply.messageID);
        
        const msg = await api.sendMessage(
          `📝 Choose who can see this post:\n\n1️⃣ Everyone\n2️⃣ Friends\n3️⃣ Only Me`,
          threadID
        );
        
        if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
        global.GoatBot.onReply.set(msg.messageID, {
          commandName: this.config.name,
          author: senderID,
          postData: postData,
          type: "editAudience"
        });
      }
      else if (choice === "2") {
        // Edit Caption
        await api.unsendMessage(Reply.messageID);
        
        const msg = await api.sendMessage(
          `📝 Enter new caption (or reply "skip" to keep current)`,
          threadID
        );
        
        if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
        global.GoatBot.onReply.set(msg.messageID, {
          commandName: this.config.name,
          author: senderID,
          postData: postData,
          type: "editCaption"
        });
      }
      /* // COMMENTED OUT: Edit images option
      else if (choice === "3") {
        // Edit Attached File
        await api.unsendMessage(Reply.messageID);
        
        // Clear existing images
        postData.imageIds = [];
        postData.formData.input.attachments = [];
        
        const msg = await api.sendMessage(
          `🖼️ Send new image(s) or reply "skip" to keep none`,
          threadID
        );
        
        if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
        global.GoatBot.onReply.set(msg.messageID, {
          commandName: this.config.name,
          author: senderID,
          postData: postData,
          type: "editImages"
        });
      }
      */
      else {
        return api.sendMessage('❌ Invalid choice. Please choose 1, 2, or 3', threadID, messageID);
      }
    }
    else if (type == "editAudience") {
      if (!["1", "2", "3"].includes(body.trim())) {
        return api.sendMessage('❌ Please choose 1, 2, or 3', threadID, messageID);
      }
      
      const privacyMap = {
        "1": "EVERYONE",
        "2": "FRIENDS",
        "3": "SELF"
      };
      
      postData.audience = privacyMap[body.trim()];
      postData.formData.input.audience.privacy.base_state = postData.audience;
      
      await api.unsendMessage(Reply.messageID);
      
      const overview = showOverview(postData);
      const msg = await api.sendMessage(overview, threadID);
      
      if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
      global.GoatBot.onReply.set(msg.messageID, {
        commandName: this.config.name,
        author: senderID,
        postData: postData,
        type: "overview"
      });
    }
    else if (type == "editCaption") {
      if (body.trim().toLowerCase() !== "skip" && body.trim() !== "") {
        postData.caption = body;
        postData.formData.input.message.text = body;
      }
      
      await api.unsendMessage(Reply.messageID);
      
      const overview = showOverview(postData);
      const msg = await api.sendMessage(overview, threadID);
      
      if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
      global.GoatBot.onReply.set(msg.messageID, {
        commandName: this.config.name,
        author: senderID,
        postData: postData,
        type: "overview"
      });
    }
    /* // COMMENTED OUT: Edit images handler
    else if (type == "editImages") {
      // Clear existing images first
      postData.imageIds = [];
      postData.formData.input.attachments = [];
      
      if (body.trim().toLowerCase() !== "skip" && attachments && attachments.length > 0) {
        const imageIds = await uploadImages(attachments);
        if (imageIds.length > 0) {
          postData.imageIds = imageIds;
          for (const id of imageIds) {
            postData.formData.input.attachments.push({
              "photo": { "id": id }
            });
          }
        }
      }
      
      await api.unsendMessage(Reply.messageID);
      
      const overview = showOverview(postData);
      const msg = await api.sendMessage(overview, threadID);
      
      if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
      global.GoatBot.onReply.set(msg.messageID, {
        commandName: this.config.name,
        author: senderID,
        postData: postData,
        type: "overview"
      });
    }
    */
  }
};

function getGUID() {
  var sectionLength = Date.now();
  var id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = Math.floor((sectionLength + Math.random() * 16) % 16);
    sectionLength = Math.floor(sectionLength / 16);
    var _guid = (c == "x" ? r : (r & 7) | 8).toString(16);
    return _guid;
  });
  return id;
}
