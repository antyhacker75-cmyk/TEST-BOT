const admin = require('firebase-admin');

let firebaseInitialized = false;
let db = null;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://ddos-c147a-default-rtdb.firebaseio.com'
      });
      firebaseInitialized = true;
      db = admin.database();
      console.log('[FIREBASE] ✅ Initialized successfully.');
    }
  } else {
    console.warn('[FIREBASE] ⚠️ FIREBASE_SERVICE_ACCOUNT env var not set.');
  }
} catch (err) {
  console.error('[FIREBASE] ❌ Initialization error:', err.message);
}

// ---- User Model ----
const userModel = {
  create: async (fbid, password) => {
    if (!firebaseInitialized) throw new Error('Firebase not initialized.');
    const ref = db.ref('users').child(fbid);
    await ref.set({
      password: password,
      createdAt: Date.now(),
      fbid: fbid
    });
    return { fbid };
  },
  get: async (fbid) => {
    if (!firebaseInitialized) return null;
    const snapshot = await db.ref('users').child(fbid).once('value');
    const user = snapshot.val();
    if (!user) return null;
    return { ...user, fbid };
  },
  exists: async (fbid) => {
    if (!firebaseInitialized) return false;
    const snapshot = await db.ref('users').child(fbid).once('value');
    return snapshot.exists();
  }
};

// ---- Bot Model ----
const botModel = {
  create: async (data) => {
    if (!firebaseInitialized) throw new Error('Firebase not initialized.');
    const ref = db.ref('bots').push();
    await ref.set({ 
      ...data, 
      createdAt: Date.now(), 
      active: data.active || false,
      running: false,
      pid: null // Process ID for the child process
    });
    return { id: ref.key, ...data };
  },
  getAll: async (ownerFbid = null) => {
    if (!firebaseInitialized) return [];
    const snapshot = await db.ref('bots').once('value');
    const bots = snapshot.val() || {};
    const entries = Object.entries(bots).map(([id, bot]) => ({ id, ...bot }));
    if (ownerFbid) return entries.filter(bot => bot.ownerFbid === ownerFbid);
    return entries;
  },
  getById: async (id) => {
    if (!firebaseInitialized) return null;
    const snapshot = await db.ref(`bots/${id}`).once('value');
    const bot = snapshot.val();
    if (!bot) return null;
    return { id, ...bot };
  },
  getRunning: async () => {
    if (!firebaseInitialized) return [];
    const allBots = await botModel.getAll();
    return allBots.filter(b => b.running === true);
  },
  update: async (id, data) => {
    if (!firebaseInitialized) throw new Error('Firebase not initialized.');
    await db.ref(`bots/${id}`).update(data);
    return await botModel.getById(id);
  },
  delete: async (id) => {
    if (!firebaseInitialized) throw new Error('Firebase not initialized.');
    await db.ref(`bots/${id}`).remove();
    return true;
  }
};

// ---- Admin config ----
const getAdminConfig = async () => {
  if (!firebaseInitialized) {
    return { adminKey: null, trustedAdminIDs: [] };
  }
  const snapshot = await db.ref('adminConfig').once('value');
  const config = snapshot.val() || {};
  return {
    adminKey: config.adminKey || null,
    trustedAdminIDs: config.trustedAdminIDs || []
  };
};

const setAdminConfig = async (data) => {
  if (!firebaseInitialized) throw new Error('Firebase not initialized.');
  await db.ref('adminConfig').update(data);
};

module.exports = { botModel, userModel, getAdminConfig, setAdminConfig };