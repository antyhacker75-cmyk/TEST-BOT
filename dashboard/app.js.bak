const express = require("express");
const app = express();
const fileUpload = require("express-fileupload");
const rateLimit = require("express-rate-limit");
const fs = require("fs-extra");
const session = require("express-session");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const cookieParser = require("cookie-parser");
const flash = require("connect-flash");
const Passport = require("passport");
const bcrypt = require("bcrypt");
const axios = require("axios");
const mimeDB = require("mime-db");
const http = require("http");
const server = http.createServer(app);
const path = require("path");

const { botModel, userModel, getAdminConfig, setAdminConfig } = require('./firebase.js');
const { startBotProcess, stopBotProcess, getRunningBots, restoreRunningBots } = require('./botManager.js');

const imageExt = ["png", "gif", "webp", "jpeg", "jpg"];
const videoExt = ["webm", "mkv", "flv", "vob", "ogv", "ogg", "rrc", "gifv",
        "mng", "mov", "avi", "qt", "wmv", "yuv", "rm", "asf", "amv", "mp4",
        "m4p", "m4v", "mpg", "mp2", "mpeg", "mpe", "mpv", "m4v", "svi", "3gp",
        "3g2", "mxf", "roq", "nsv", "flv", "f4v", "f4p", "f4a", "f4b", "mod"
];
const audioExt = ["3gp", "aa", "aac", "aax", "act", "aiff", "alac", "amr",
        "ape", "au", "awb", "dss", "dvf", "flac", "gsm", "iklax", "ivs",
        "m4a", "m4b", "m4p", "mmf", "mp3", "mpc", "msv", "nmf",
        "ogg", "oga", "mogg", "opus", "ra", "rm", "raw", "rf64", "sln", "tta",
        "voc", "vox", "wav", "wma", "wv", "webm", "8svx", "cd"
];

module.exports = async (api) => {
        if (!api)
                await require("./connectDB.js")();

        const { utils, utils: { drive } } = global;
        const { config } = global.GoatBot;
        const { expireVerifyCode } = config.dashBoard;
        const { gmailAccount, gRecaptcha } = config.credentials;

        const getText = global.utils.getText;

        const {
                email,
                clientId,
                clientSecret,
                refreshToken
        } = gmailAccount;

        const OAuth2 = google.auth.OAuth2;
        const OAuth2_client = new OAuth2(clientId, clientSecret);
        OAuth2_client.setCredentials({ refresh_token: refreshToken });
        let accessToken = "";
        try {
                accessToken = await OAuth2_client.getAccessToken();
        }
        catch (err) {
                utils.log.warn("DASHBOARD", getText("Goat", "googleApiRefreshTokenExpired"));
        }

        const transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                service: "Gmail",
                auth: {
                        type: "OAuth2",
                        user: email,
                        clientId,
                        clientSecret,
                        refreshToken,
                        accessToken
                }
        });

        const {
                threadModel,
                userModel: dbUserModel,
                dashBoardModel,
                threadsData,
                usersData,
                dashBoardData
        } = global.db;

        // ===== DYNAMIC ADMIN CONFIG =====
        let adminConfig = await getAdminConfig();
        const finalAdminKey = adminConfig.adminKey || 'defaultAdminKey';

        // ===== SESSION SETUP =====
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(cookieParser());
        const sessionSecret = process.env.SESSION_SECRET
                || (finalAdminKey ? finalAdminKey + "_r3nz75_session_bot" : null)
                || randomStringApikey(32);
        app.use(session({
                secret: sessionSecret,
                resave: false,
                saveUninitialized: true,
                cookie: {
                        secure: false,
                        httpOnly: true,
                        maxAge: 1000 * 60 * 60 * 24 * 7
                }
        }));

        // public folder
        app.use("/css", express.static(`${__dirname}/css`));
        app.use("/js", express.static(`${__dirname}/js`));
        app.use("/images", express.static(`${__dirname}/images`));

        // ===== SERVE LOGIN PAGE =====
        app.get("/login", (req, res) => {
                res.sendFile(path.join(__dirname, "login.html"));
        });

        // ===== REDIRECT ROOT TO LOGIN =====
        app.get("/", (req, res) => {
                res.redirect("/login");
        });

        // ===== FIXED: serve static files =====
        app.use("/dashboard", express.static(__dirname));
        app.get("/dashboard", (req, res) => {
                res.sendFile(path.join(__dirname, "r3nz75.html"));
        });

        // ================================================================
        // ===== AUTH ROUTES =====
        // ================================================================

        // Register
        app.post("/api/auth/register", async (req, res) => {
                try {
                        const { fbid, password } = req.body;
                        if (!fbid || !password) {
                                return res.status(400).json({ error: "Facebook ID and password required" });
                        }
                        if (password.length < 6) {
                                return res.status(400).json({ error: "Password must be at least 6 characters" });
                        }

                        const exists = await userModel.exists(fbid);
                        if (exists) {
                                return res.status(400).json({ error: "User already exists. Please sign in." });
                        }

                        await userModel.create(fbid, password);
                        res.json({ success: true, message: "Account created successfully" });
                } catch (err) {
                        res.status(500).json({ error: err.message });
                }
        });

        // Login
        app.post("/api/auth/login", async (req, res) => {
                try {
                        const { fbid, password } = req.body;
                        if (!fbid || !password) {
                                return res.status(400).json({ error: "Facebook ID and password required" });
                        }

                        const user = await userModel.get(fbid);
                        if (!user) {
                                return res.status(401).json({ error: "User not found. Please register." });
                        }

                        if (user.password !== password) {
                                return res.status(401).json({ error: "Invalid password" });
                        }

                        req.session.admin = true;
                        req.session.facebookUserID = fbid;
                        req.session.isSuperAdmin = false;

                        const adminConfig = await getAdminConfig();
                        const trustedIDs = adminConfig.trustedAdminIDs || [];
                        if (trustedIDs.length === 0) {
                                await setAdminConfig({ trustedAdminIDs: [fbid] });
                                req.session.isSuperAdmin = true;
                        } else if (trustedIDs[0] === fbid) {
                                req.session.isSuperAdmin = true;
                        }

                        res.json({ success: true, fbid });
                } catch (err) {
                        res.status(500).json({ error: err.message });
                }
        });

        // Quick login
        app.get("/api/auth/quick/:fbid", async (req, res) => {
                try {
                        const fbid = req.params.fbid;
                        if (!fbid) {
                                return res.status(400).json({ error: "Facebook ID required" });
                        }

                        const user = await userModel.get(fbid);
                        if (!user) {
                                return res.status(401).json({ error: "User not found. Please register." });
                        }

                        req.session.admin = true;
                        req.session.facebookUserID = fbid;
                        req.session.isSuperAdmin = false;

                        const adminConfig = await getAdminConfig();
                        const trustedIDs = adminConfig.trustedAdminIDs || [];
                        if (trustedIDs.length === 0) {
                                await setAdminConfig({ trustedAdminIDs: [fbid] });
                                req.session.isSuperAdmin = true;
                        } else if (trustedIDs[0] === fbid) {
                                req.session.isSuperAdmin = true;
                        }

                        res.json({ success: true, fbid });
                } catch (err) {
                        res.status(500).json({ error: err.message });
                }
        });

        // Check session
        app.get("/api/auth/session", (req, res) => {
                if (req.session && req.session.facebookUserID) {
                        res.json({ loggedIn: true, fbid: req.session.facebookUserID });
                } else {
                        res.json({ loggedIn: false });
                }
        });

        // Logout
        app.get("/api/auth/logout", (req, res) => {
                req.session.destroy();
                res.json({ success: true });
        });

        // ===== DYNAMIC AUTH =====
        app.get("/dashboard/auth/:fbid", async (req, res) => {
                const fbid = req.params.fbid;
                let config = await getAdminConfig();
                let trustedIDs = config.trustedAdminIDs || [];

                const user = await userModel.get(fbid);
                if (!user) {
                        return res.redirect("/login?error=User not found. Please register first.");
                }

                if (trustedIDs.length === 0) {
                        await setAdminConfig({ 
                                trustedAdminIDs: [fbid],
                                adminKey: config.adminKey || 'defaultAdminKey'
                        });
                        req.session.admin = true;
                        req.session.facebookUserID = fbid;
                        req.session.isSuperAdmin = true;
                        return res.redirect("/dashboard");
                }

                if (trustedIDs.includes(fbid)) {
                        const isSuper = trustedIDs[0] === fbid;
                        req.session.admin = true;
                        req.session.facebookUserID = fbid;
                        req.session.isSuperAdmin = isSuper;
                        return res.redirect("/dashboard");
                }

                req.session.admin = true;
                req.session.facebookUserID = fbid;
                req.session.isSuperAdmin = false;
                return res.redirect("/dashboard");
        });

        // ===== MIDDLEWARE =====
        function isSuperAdmin(req, res, next) {
                if (req.session.isSuperAdmin) return next();
                return res.status(403).json({ error: "Super admin access required" });
        }

        // ===== ADMIN MANAGEMENT APIS =====
        app.get("/api/admins", async (req, res) => {
                const config = await getAdminConfig();
                const admins = config.trustedAdminIDs || [];
                const isSuper = admins.length > 0 && admins[0] === req.session.facebookUserID;
                res.json({ admins, isSuperAdmin: isSuper ? admins[0] : null });
        });

        app.post("/api/admins", async (req, res) => {
                if (!req.session.isSuperAdmin) {
                        return res.status(403).json({ error: "Only super admin can add users" });
                }
                const { fbid } = req.body;
                if (!fbid) return res.status(400).json({ error: "FB ID required" });
                const config = await getAdminConfig();
                let admins = config.trustedAdminIDs || [];
                if (!admins.includes(fbid)) {
                        admins.push(fbid);
                        await setAdminConfig({ trustedAdminIDs: admins });
                }
                res.json({ success: true });
        });

        app.delete("/api/admins", async (req, res) => {
                if (!req.session.isSuperAdmin) {
                        return res.status(403).json({ error: "Only super admin can remove users" });
                }
                const { fbid } = req.body;
                const config = await getAdminConfig();
                let admins = config.trustedAdminIDs || [];
                if (admins.length <= 1) {
                        return res.status(400).json({ error: "Cannot remove the only super admin" });
                }
                admins = admins.filter(id => id !== fbid);
                await setAdminConfig({ trustedAdminIDs: admins });
                res.json({ success: true });
        });

        // ===== BOT MANAGEMENT API =====

        // GET all bots
        app.get("/api/bots", async (req, res) => {
                try {
                        const isSuper = req.session.isSuperAdmin === true;
                        const ownerFbid = req.session.facebookUserID;
                        let queryOwner = null;
                        if (!isSuper) {
                                if (!ownerFbid) return res.status(401).json({ error: "Not authenticated" });
                                queryOwner = ownerFbid;
                        }
                        const bots = await botModel.getAll(queryOwner);
                        const running = getRunningBots();
                        const botsWithStatus = bots.map(bot => {
                                const isRunning = running.some(r => r.id === bot.id);
                                return { ...bot, running: isRunning };
                        });
                        res.json(botsWithStatus);
                } catch (err) {
                        res.status(500).json({ error: err.message });
                }
        });

        // CREATE bot
        app.post("/api/bots", async (req, res) => {
                try {
                        const { fbstate, botName, ownerFbid } = req.body;
                        if (!fbstate) return res.status(400).json({ error: "fbstate is required" });
                        if (!ownerFbid) return res.status(400).json({ error: "Admin ID (ownerFbid) is required" });

                        const isSuper = req.session.isSuperAdmin === true;
                        const sessionFbid = req.session.facebookUserID;

                        if (!isSuper && ownerFbid !== sessionFbid) {
                                return res.status(403).json({ 
                                        error: "You can only create bots with your own Admin ID." 
                                });
                        }

                        const bot = await botModel.create({
                                ownerFbid,
                                fbstate,
                                botName: botName || "My Bot",
                                active: false,
                                running: false,
                                pid: null
                        });
                        res.status(201).json(bot);
                } catch (err) {
                        res.status(500).json({ error: err.message });
                }
        });

        // DELETE bot
        app.delete("/api/bots/:id", async (req, res) => {
                try {
                        const bot = await botModel.getById(req.params.id);
                        if (!bot) return res.status(404).json({ error: "Bot not found" });
                        const isSuper = req.session.isSuperAdmin === true;
                        const ownerFbid = req.session.facebookUserID;
                        if (!isSuper && bot.ownerFbid !== ownerFbid) {
                                return res.status(403).json({ error: "Permission denied" });
                        }
                        
                        if (bot.running) {
                                await stopBotProcess(req.params.id);
                        }
                        
                        await botModel.delete(req.params.id);
                        res.json({ success: true });
                } catch (err) {
                        res.status(500).json({ error: err.message });
                }
        });

        // START bot
        app.post("/api/bots/:id/start", async (req, res) => {
                try {
                        const bot = await botModel.getById(req.params.id);
                        if (!bot) return res.status(404).json({ error: "Bot not found" });
                        const isSuper = req.session.isSuperAdmin === true;
                        const ownerFbid = req.session.facebookUserID;
                        if (!isSuper && bot.ownerFbid !== ownerFbid) {
                                return res.status(403).json({ error: "Permission denied" });
                        }
                        
                        const result = await startBotProcess(req.params.id);
                        res.json(result);
                } catch (err) {
                        res.status(500).json({ error: err.message });
                }
        });

        // STOP bot
        app.post("/api/bots/:id/stop", async (req, res) => {
                try {
                        const bot = await botModel.getById(req.params.id);
                        if (!bot) return res.status(404).json({ error: "Bot not found" });
                        const isSuper = req.session.isSuperAdmin === true;
                        const ownerFbid = req.session.facebookUserID;
                        if (!isSuper && bot.ownerFbid !== ownerFbid) {
                                return res.status(403).json({ error: "Permission denied" });
                        }
                        
                        const result = await stopBotProcess(req.params.id);
                        res.json(result);
                } catch (err) {
                        res.status(500).json({ error: err.message });
                }
        });

        // ACTIVATE bot
        app.post("/api/bots/:id/activate", async (req, res) => {
                try {
                        const bot = await botModel.getById(req.params.id);
                        if (!bot) return res.status(404).json({ error: "Bot not found" });
                        const isSuper = req.session.isSuperAdmin === true;
                        const ownerFbid = req.session.facebookUserID;
                        if (!isSuper && bot.ownerFbid !== ownerFbid) {
                                return res.status(403).json({ error: "Permission denied" });
                        }

                        const allBots = await botModel.getAll();
                        for (const b of allBots) {
                                if (b.active) {
                                        await botModel.update(b.id, { active: false });
                                }
                        }
                        await botModel.update(req.params.id, { active: true });

                        if (!bot.running) {
                                await startBotProcess(req.params.id);
                        }

                        res.json({ success: true, message: "Bot activated!" });
                } catch (err) {
                        res.status(500).json({ error: err.message });
                }
        });

        // ===== PUBLIC SETUP-SESSION =====
        app.post("/api/setup-session", (req, res) => {
                const { fbstate, adminKey } = req.body;
                if (adminKey !== finalAdminKey) {
                        return res.json({ status: "error", message: "Wrong admin key." });
                }
                if (!fbstate || !fbstate.trim()) {
                        return res.json({ status: "error", message: "fbstate cannot be empty" });
                }
                const accountFile = process.cwd() + "/account.txt";
                try {
                        fs.writeFileSync(accountFile, fbstate.trim());
                        res.json({ status: "success", message: "Session saved! Bot is restarting now..." });
                        res.on("finish", () => setTimeout(() => process.exit(2), 500));
                } catch (err) {
                        res.json({ status: "error", message: "Failed to write session: " + err.message });
                }
        });

        // ================================================================
        // ===== ORIGINAL ROUTES =====
        // ================================================================

        async function checkAuthConfigDashboardOfThread(threadData, userID) {
                if (!isNaN(threadData))
                        threadData = await threadsData.get(threadData);
                return threadData.adminIDs?.includes(userID) || threadData.members?.some(m => m.userID == userID && m.permissionConfigDashboard == true) || false;
        }

        const middleWare = require("./middleware/index.js")(checkAuthConfigDashboardOfThread);

        const {
                unAuthenticated,
                isWaitVerifyAccount,
                isAuthenticated,
                isAdmin,
                isVeryfiUserIDFacebook,
                checkHasAndInThread,
                middlewareCheckAuthConfigDashboardOfThread
        } = middleWare;

        app.get("/raw/login", isAdmin, (req, res) => {
                res.setHeader("Content-Type", "text/plain; charset=utf-8");
                res.sendFile(path.join(__dirname, "../bot/login/login.js"));
        });

        app.get("/raw/handlerEvent", isAdmin, (req, res) => {
                res.setHeader("Content-Type", "text/plain; charset=utf-8");
                res.sendFile(path.join(__dirname, "../bot/handler/handlerEvent.js"));
        });

        app.get("/raw/database", isAdmin, (req, res) => {
                res.setHeader("Content-Type", "application/octet-stream");
                res.setHeader("Content-Disposition", "attachment; filename=database.sqlite");
                const dbPath = path.join(__dirname, "../Fca_Database/database.sqlite");
                if (!fs.existsSync(dbPath)) return res.status(404).json({ error: "Database file not found" });
                res.sendFile(dbPath);
        });

        app.get(["/health", "/ping", "/alive"], (req, res) => {
                res.status(200).json({
                        status: "ok",
                        bot: global.GoatBot?.config?.nameBot || "RENZ MESSENGER BOT",
                        uptime: Math.floor(process.uptime()),
                        timestamp: new Date().toISOString()
                });
        });

        app.get("/stats", async (req, res) => {
                let fcaVersion;
                try { fcaVersion = require("fca-r3nz75/package.json").version; }
                catch (e) { fcaVersion = "unknown"; }

                let botVersion;
                try { botVersion = require(process.cwd() + "/package.json").version; }
                catch (e) { botVersion = "unknown"; }

                const totalThread = (await threadsData.getAll()).filter(t => t.threadID.toString().length > 15).length;
                const totalUser = (await usersData.getAll()).length;
                const uptime = utils.convertTime(process.uptime() * 1000);

                const cfg = global.GoatBot?.config || {};
                const commandsCount = global.GoatBot?.commands?.size || 0;
                const eventsCount = global.GoatBot?.eventCommands?.size || 0;
                const isConnected = !!global.GoatBot?.fcaApi;
                const botID = global.GoatBot?.botID || null;

                const dbType = (() => {
                        try {
                                const uri = process.env.MONGODB_URI || process.env.MONGO_URL || cfg.database?.mongodb?.uri || "";
                                return uri ? "MongoDB" : "SQLite";
                        } catch { return "SQLite"; }
                })();

                res.json({
                        fcaVersion,
                        botVersion,
                        totalThread,
                        totalUser,
                        uptime,
                        uptimeSecond: process.uptime(),
                        commandsCount,
                        eventsCount,
                        isConnected,
                        botID,
                        prefix: cfg.prefix || ")",
                        language: cfg.language || "en",
                        nameBot: cfg.nameBot || "RENZ MESSENGER BOT",
                        dbType,
                        nodeVersion: process.version
                });
        });

        app.get("/profile", isAuthenticated, async (req, res) => {
                res.json({
                        userData: await usersData.get(req.user.facebookUserID) || {}
                });
        });

        app.get("/donate", (req, res) => {
                res.json({ message: "Donate endpoint" });
        });

        app.get("/logout", (req, res, next) => {
                req.logout(function (err) {
                        if (err)
                                return next(err);
                        res.redirect("/");
                });
        });

        app.post("/changefbstate", isAuthenticated, isVeryfiUserIDFacebook, (req, res) => {
                if (!global.GoatBot.config.adminBot.includes(req.user.facebookUserID))
                        return res.send({
                                status: "error",
                                message: getText("app", "notPermissionChangeFbstate")
                        });
                const { fbstate } = req.body;
                if (!fbstate)
                        return res.send({
                                status: "error",
                                message: getText("app", "notFoundFbstate")
                        });

                fs.writeFileSync(process.cwd() + (process.env.NODE_ENV == "production" || process.env.NODE_ENV == "development" ? "/account.dev.txt" : "/account.txt"), fbstate);
                res.send({
                        status: "success",
                        message: getText("app", "changedFbstateSuccess")
                });

                res.on("finish", () => {
                        process.exit(2);
                });
        });

        app.get("/uptime", global.responseUptimeCurrent);

        app.get("/changefbstate", isAuthenticated, isVeryfiUserIDFacebook, isAdmin, (req, res) => {
                res.json({
                        currentFbstate: fs.readFileSync(process.cwd() + (process.env.NODE_ENV == "production" || process.env.NODE_ENV == "development" ? "/account.dev.txt" : "/account.txt"), "utf8")
                });
        });

        app.get("*", (req, res) => {
                res.status(404).json({ error: "Not found" });
        });

        app.use((err, req, res, next) => {
                if (err.message == "Login sessions require session support. Did you forget to use `express-session` middleware?")
                        return res.status(500).send(getText("app", "serverError"));
        });

        // ====== START SERVER ======
        const PORT = process.env.PORT || config.dashBoard?.port || 5000;
        let dashBoardUrl;
        if (process.env.RENDER_EXTERNAL_URL) {
                dashBoardUrl = process.env.RENDER_EXTERNAL_URL;
        } else if (process.env.RAILWAY_PUBLIC_DOMAIN) {
                dashBoardUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
        } else if (process.env.RAILWAY_STATIC_URL) {
                dashBoardUrl = process.env.RAILWAY_STATIC_URL;
        } else if (process.env.REPL_OWNER) {
                dashBoardUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
        } else if (process.env.API_SERVER_EXTERNAL == "https://api.glitch.com") {
                dashBoardUrl = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
        } else if (process.env.KOYEB_APP_URL) {
                dashBoardUrl = process.env.KOYEB_APP_URL;
        } else if (process.env.CYCLIC_URL) {
                dashBoardUrl = process.env.CYCLIC_URL;
        } else if (process.env.BASE_URL) {
                dashBoardUrl = process.env.BASE_URL;
        } else {
                dashBoardUrl = `http://localhost:${PORT}`;
        }
        dashBoardUrl = dashBoardUrl.replace(/\/$/, "");
        
        // Restore running bots on startup
        await restoreRunningBots();
        
        await server.listen(PORT, "0.0.0.0");
        utils.log.info("DASHBOARD", `Dashboard is running: ${dashBoardUrl}`);
        if (config.serverUptime.socket.enable == true)
                require("../bot/login/socketIO.js")(server);
};

// ----- Helper functions -----
function randomStringApikey(max) {
        let text = "";
        const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i = 0; i < max; i++)
                text += possible.charAt(Math.floor(Math.random() * possible.length));
        return text;
}
function randomNumberApikey(maxLength) {
        let text = "";
        const possible = "0123456789";
        for (let i = 0; i < maxLength; i++)
                text += possible.charAt(Math.floor(Math.random() * possible.length));
        return text;
}
function validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
}
function convertSize(byte) {
        return byte > 1024 ? byte > 1024 * 1024 ? (byte / 1024 / 1024).toFixed(2) + " MB" : (byte / 1024).toFixed(2) + " KB" : byte + " Byte";
}