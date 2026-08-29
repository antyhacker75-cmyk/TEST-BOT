const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

module.exports = {
  config: {
    name: "checkbotallpost",
    version: "1.0.0",
    author: "Renz",
    role: 2,
    usePrefix: true,
    description: "Check and delete bot's posts",
    guide: "{pn} [page]",
    category: "operator",
    cooldowns: 10,
    aliases: ["botposts", "myposts"]
  },

  onStart: async function ({ api, event, args, message }) {
    const { threadID, messageID, senderID } = event;
    const botID = api.getCurrentUserID();
    
    // Initialize onReply if it doesn't exist
    if (!global.GoatBot) global.GoatBot = {};
    if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
    
    // Get page number from args (default: 1)
    let page = parseInt(args[0]) || 1;
    if (page < 1) page = 1;
    
    const limit = 10; // Posts per page
    const offset = (page - 1) * limit;
    
    try {
      // Show loading message
      const loadingMsg = await api.sendMessage('📥 Fetching your posts...', threadID);
      
      // Get bot's posts using GraphQL
      const posts = await getBotPosts(api, botID, limit, offset);
      
      // Delete loading message
      await api.unsendMessage(loadingMsg.messageID);
      
      if (!posts || posts.length === 0) {
        return api.sendMessage(
          `📭 You don't have any posts on page ${page}.\n\nTotal posts: 0`,
          threadID,
          messageID
        );
      }
      
      // Calculate total pages (approximate from count if available)
      const totalPosts = posts.length < limit ? offset + posts.length : offset + limit + 10; // Approximate
      const totalPages = Math.ceil(totalPosts / limit);
      
      // Build post list message
      let postList = `📋 **BOT'S POSTS**\n\n`;
      postList += `👤 Bot ID: ${botID}\n`;
      postList += `📄 Page ${page}/${totalPages}\n`;
      postList += `📊 Showing ${offset + 1}-${offset + posts.length}\n\n`;
      
      // Create selectable options
      const options = [];
      const postMap = {};
      
      posts.forEach((post, index) => {
        const num = index + 1;
        const postId = post.id || post.post_id;
        const messageText = post.message || post.text || "(No caption)";
        const shortText = messageText.length > 40 ? messageText.substring(0, 40) + "..." : messageText;
        const time = post.created_time || post.time || "";
        
        postMap[num] = postId;
        postMap[`post_${num}`] = post;
        
        // Show emoji for post type
        let emoji = "📝";
        if (post.attachments && post.attachments.length > 0) {
          const hasPhoto = post.attachments.some(a => a.type === "photo");
          const hasVideo = post.attachments.some(a => a.type === "video");
          if (hasPhoto && hasVideo) emoji = "🎬";
          else if (hasPhoto) emoji = "🖼️";
          else if (hasVideo) emoji = "🎥";
        }
        
        postList += `${num}. ${emoji} ${shortText}\n`;
        postList += `   🆔 ${postId}\n`;
        postList += `   📅 ${time}\n\n`;
      });
      
      postList += `\n━━━━━━━━━━━━━━━━━━━\n`;
      postList += `📌 **Instructions:**\n`;
      postList += `• Reply with numbers to select posts (e.g., "1 3 5")\n`;
      postList += `• Reply with "all" to select all posts\n`;
      postList += `• Reply with "next" for next page\n`;
      postList += `• Reply with "prev" for previous page\n`;
      postList += `• Reply with "cancel" to exit\n\n`;
      postList += `⚠️ Selected posts will be **DELETED PERMANENTLY**!`;
      
      // Store post data for reply handling
      if (!global.GoatBot.postSelection) global.GoatBot.postSelection = {};
      global.GoatBot.postSelection[senderID] = {
        posts: posts,
        postMap: postMap,
        page: page,
        totalPages: totalPages,
        limit: limit,
        selected: [],
        confirmed: false
      };
      
      const msg = await api.sendMessage(postList, threadID);
      
      // Store reply handler
      if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
      global.GoatBot.onReply.set(msg.messageID, {
        commandName: this.config.name,
        author: senderID,
        type: "selectPosts"
      });
      
    } catch (error) {
      console.error('Error fetching posts:', error);
      return api.sendMessage(
        `❌ Failed to fetch posts: ${error.message || 'Unknown error'}`,
        threadID,
        messageID
      );
    }
  },

  onReply: async function ({ api, event, Reply, getLang }) {
    console.log('onReply triggered for checkbotallpost:', event.body);
    
    const { author, type } = Reply;
    const { threadID, messageID, senderID, body } = event;
    
    if (!Reply || event.senderID != author) return;
    
    // Get user's selection data
    if (!global.GoatBot.postSelection) {
      return api.sendMessage('❌ Session expired. Please run the command again.', threadID, messageID);
    }
    
    const userData = global.GoatBot.postSelection[senderID];
    if (!userData) {
      return api.sendMessage('❌ No active session. Please run the command again.', threadID, messageID);
    }
    
    const { posts, postMap, page, totalPages, limit, selected } = userData;
    
    const input = body.trim().toLowerCase();
    
    // Handle navigation
    if (input === 'next') {
      if (page >= totalPages) {
        return api.sendMessage('📭 You are already on the last page.', threadID, messageID);
      }
      
      // Unsend current message and restart with next page
      await api.unsendMessage(Reply.messageID);
      
      const newArgs = [page + 1];
      return this.onStart({ api, event: { ...event, args: newArgs }, args: newArgs, message: { reply: api.sendMessage } });
    }
    
    if (input === 'prev') {
      if (page <= 1) {
        return api.sendMessage('📭 You are already on the first page.', threadID, messageID);
      }
      
      await api.unsendMessage(Reply.messageID);
      
      const newArgs = [page - 1];
      return this.onStart({ api, event: { ...event, args: newArgs }, args: newArgs, message: { reply: api.sendMessage } });
    }
    
    if (input === 'cancel') {
      // Clear session
      delete global.GoatBot.postSelection[senderID];
      await api.unsendMessage(Reply.messageID);
      return api.sendMessage('❌ Operation cancelled.', threadID, messageID);
    }
    
    // Handle selection
    if (input === 'all') {
      // Select all posts
      const allIds = posts.map(p => p.id || p.post_id);
      userData.selected = allIds;
      
      const selectionMsg = showSelectedPosts(allIds, posts);
      const msg = await api.sendMessage(
        `${selectionMsg}\n\nReply with "confirm" to delete these posts or "cancel" to go back.`,
        threadID
      );
      
      // Update handler for confirmation
      if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
      global.GoatBot.onReply.set(msg.messageID, {
        commandName: this.config.name,
        author: senderID,
        type: "confirmDelete"
      });
      
      return;
    }
    
    // Parse numbers (e.g., "1 3 5")
    const numbers = input.split(/\s+/).map(n => parseInt(n)).filter(n => !isNaN(n) && n > 0);
    
    if (numbers.length === 0) {
      return api.sendMessage(
        `❌ Invalid input. Please reply with numbers (e.g., "1 3 5"), "all", "next", "prev", or "cancel".`,
        threadID,
        messageID
      );
    }
    
    // Check if numbers are valid
    const validNumbers = numbers.filter(n => n <= posts.length);
    if (validNumbers.length === 0) {
      return api.sendMessage(
        `❌ Invalid post numbers. Please choose numbers between 1 and ${posts.length}.`,
        threadID,
        messageID
      );
    }
    
    // Get selected post IDs
    const selectedIds = validNumbers.map(n => postMap[n]).filter(id => id);
    
    if (selectedIds.length === 0) {
      return api.sendMessage('❌ No valid posts selected.', threadID, messageID);
    }
    
    userData.selected = selectedIds;
    
    const selectionMsg = showSelectedPosts(selectedIds, posts);
    const msg = await api.sendMessage(
      `${selectionMsg}\n\nReply with "confirm" to delete these posts or "cancel" to go back.`,
      threadID
    );
    
    // Update handler for confirmation
    if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
    global.GoatBot.onReply.set(msg.messageID, {
      commandName: this.config.name,
      author: senderID,
      type: "confirmDelete"
    });
  },

  handleReply: async function ({ api, event, Reply, getLang }) {
    console.log('handleReply triggered for checkbotallpost:', event.body);
    
    const { author, type } = Reply;
    const { threadID, messageID, senderID, body } = event;
    
    if (!Reply || event.senderID != author) return;
    
    // Get user's selection data
    if (!global.GoatBot.postSelection) {
      return api.sendMessage('❌ Session expired. Please run the command again.', threadID, messageID);
    }
    
    const userData = global.GoatBot.postSelection[senderID];
    if (!userData) {
      return api.sendMessage('❌ No active session. Please run the command again.', threadID, messageID);
    }
    
    const { posts, selected } = userData;
    const input = body.trim().toLowerCase();
    
    if (input === 'cancel') {
      delete global.GoatBot.postSelection[senderID];
      await api.unsendMessage(Reply.messageID);
      return api.sendMessage('❌ Operation cancelled.', threadID, messageID);
    }
    
    if (input === 'confirm') {
      // Delete selected posts
      await api.unsendMessage(Reply.messageID);
      
      const deletingMsg = await api.sendMessage('🗑️ Deleting selected posts...', threadID);
      
      let deletedCount = 0;
      let failedCount = 0;
      const failedIds = [];
      
      for (const postId of selected) {
        try {
          await deletePost(api, postId);
          deletedCount++;
          console.log(`Deleted post: ${postId}`);
        } catch (error) {
          failedCount++;
          failedIds.push(postId);
          console.error(`Failed to delete post ${postId}:`, error);
        }
      }
      
      await api.unsendMessage(deletingMsg.messageID);
      
      // Clear session
      delete global.GoatBot.postSelection[senderID];
      
      let resultMsg = `✅ **DELETE COMPLETE!**\n\n`;
      resultMsg += `🗑️ Successfully deleted: ${deletedCount} post(s)\n`;
      
      if (failedCount > 0) {
        resultMsg += `❌ Failed to delete: ${failedCount} post(s)\n`;
        resultMsg += `Failed IDs: ${failedIds.join(', ')}\n\n`;
        resultMsg += `💡 Some posts may require manual deletion from Facebook.`;
      } else {
        resultMsg += `\n🎉 All selected posts have been deleted successfully!`;
      }
      
      return api.sendMessage(resultMsg, threadID, messageID);
    }
    
    return api.sendMessage('❌ Invalid response. Please reply with "confirm" or "cancel".', threadID, messageID);
  }
};

// Helper function to get bot's posts
async function getBotPosts(api, botID, limit, offset) {
  try {
    // Try using GraphQL to fetch posts
    const form = {
      fb_api_req_friendly_name: "ProfileCometTimelineFeedQuery",
      fb_api_caller_class: "RelayModern",
      doc_id: "6466815830162383",
      variables: JSON.stringify({
        id: botID,
        scale: 3,
        first: limit,
        after: offset > 0 ? offset.toString() : null,
        __relay_internal__pv__IsMergQAPollsrelayprovider: false,
        __relay_internal__pv__IsWorkUserrelayprovider: false,
        __relay_internal__pv__StoriesArmadilloReplyEnabledrelayprovider: false
      })
    };
    
    const result = await new Promise((resolve, reject) => {
      api.httpPost('https://www.facebook.com/api/graphql/', form, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
    
    let data = result;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data.replace('for (;;);', ''));
      } catch (e) {
        console.log('Failed to parse GraphQL response');
      }
    }
    
    // Try to extract posts from different response structures
    let posts = [];
    
    // Structure 1: data.viewer.actor_profile.timeline_feed.units.edges
    if (data?.data?.viewer?.actor_profile?.timeline_feed?.units?.edges) {
      posts = data.data.viewer.actor_profile.timeline_feed.units.edges
        .filter(edge => edge.node)
        .map(edge => {
          const node = edge.node;
          return {
            id: node.id || node.post_id,
            post_id: node.post_id || node.id,
            message: node.message?.text || node.message || node.title || "",
            created_time: node.creation_time || node.created_time || "",
            attachments: node.attachments || []
          };
        });
    }
    // Structure 2: data.viewer.actor_profile.timeline_feed.edges
    else if (data?.data?.viewer?.actor_profile?.timeline_feed?.edges) {
      posts = data.data.viewer.actor_profile.timeline_feed.edges
        .filter(edge => edge.node)
        .map(edge => {
          const node = edge.node;
          return {
            id: node.id || node.post_id,
            post_id: node.post_id || node.id,
            message: node.message?.text || node.message || node.title || "",
            created_time: node.creation_time || node.created_time || "",
            attachments: node.attachments || []
          };
        });
    }
    // Structure 3: data.data.viewer.actor_profile.timeline_feed.edges
    else if (data?.data?.viewer?.actor_profile?.timeline_feed?.edges) {
      posts = data.data.viewer.actor_profile.timeline_feed.edges
        .filter(edge => edge.node)
        .map(edge => {
          const node = edge.node;
          return {
            id: node.id || node.post_id,
            post_id: node.post_id || node.id,
            message: node.message?.text || node.message || node.title || "",
            created_time: node.creation_time || node.created_time || "",
            attachments: node.attachments || []
          };
        });
    }
    // Structure 4: Direct array
    else if (Array.isArray(data?.data?.viewer?.actor_profile?.timeline_feed?.edges)) {
      posts = data.data.viewer.actor_profile.timeline_feed.edges
        .filter(edge => edge.node)
        .map(edge => {
          const node = edge.node;
          return {
            id: node.id || node.post_id,
            post_id: node.post_id || node.id,
            message: node.message?.text || node.message || node.title || "",
            created_time: node.creation_time || node.created_time || "",
            attachments: node.attachments || []
          };
        });
    }
    
    // If GraphQL failed, try alternative method using feed endpoint
    if (posts.length === 0) {
      console.log('GraphQL method failed, trying alternative...');
      
      const feedForm = {
        profile_id: botID,
        limit: limit,
        offset: offset,
        source: "timeline"
      };
      
      const feedResult = await new Promise((resolve, reject) => {
        api.httpPost('https://www.facebook.com/ajax/feed/', feedForm, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
      
      let feedData = feedResult;
      if (typeof feedData === 'string') {
        try {
          feedData = JSON.parse(feedData.replace('for (;;);', ''));
        } catch (e) {}
      }
      
      if (feedData?.payload?.actions) {
        posts = feedData.payload.actions
          .filter(action => action.type === "story")
          .map(action => ({
            id: action.post_id || action.story_id,
            post_id: action.post_id || action.story_id,
            message: action.title || action.text || "",
            created_time: action.created_time || action.time || "",
            attachments: action.attachments || []
          }));
      }
    }
    
    return posts;
    
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

// Helper function to delete a post
async function deletePost(api, postId) {
  try {
    // Method 1: Using GraphQL
    const form = {
      fb_api_req_friendly_name: "CometStoryDeleteMutation",
      fb_api_caller_class: "RelayModern",
      doc_id: "9901477099476197",
      variables: JSON.stringify({
        story_id: postId,
        actor_id: api.getCurrentUserID(),
        client_mutation_id: Math.floor(Math.random() * 17)
      })
    };
    
    const result = await new Promise((resolve, reject) => {
      api.httpPost('https://www.facebook.com/api/graphql/', form, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
    
    let data = result;
    if (typeof data === 'string') {
      data = JSON.parse(data.replace('for (;;);', ''));
    }
    
    if (data?.errors) {
      throw new Error(data.errors[0]?.message || 'GraphQL error');
    }
    
    return true;
    
  } catch (error) {
    console.error('Error deleting post:', error);
    
    // Method 2: Try using direct deletion endpoint
    try {
      const deleteForm = {
        post_id: postId,
        __a: 1
      };
      
      const result = await new Promise((resolve, reject) => {
        api.httpPost('https://www.facebook.com/ajax/feed/delete.php', deleteForm, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
      
      let data = result;
      if (typeof data === 'string') {
        data = JSON.parse(data.replace('for (;;);', ''));
      }
      
      if (data?.success) {
        return true;
      }
      
      throw new Error('Delete failed');
      
    } catch (err2) {
      console.error('Alternative deletion also failed:', err2);
      throw error; // Throw original error
    }
  }
}

// Helper function to show selected posts
function showSelectedPosts(selectedIds, posts) {
  let msg = `📋 **SELECTED POSTS**\n\n`;
  
  selectedIds.forEach((id, index) => {
    const post = posts.find(p => (p.id || p.post_id) === id);
    if (post) {
      const text = post.message || post.text || "(No caption)";
      const shortText = text.length > 40 ? text.substring(0, 40) + "..." : text;
      msg += `${index + 1}. ${shortText}\n`;
      msg += `   🆔 ${id}\n`;
    }
  });
  
  msg += `\n━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 Total selected: ${selectedIds.length} post(s)\n`;
  msg += `⚠️ These posts will be **PERMANENTLY DELETED**!`;
  
  return msg;
}

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
