const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

let mainWindow;

// ─── Config ───────────────────────────────────────────────────────────────────
const CONFIG_FILE = path.join(app.getPath('userData'), 'nexus-config.json');
const ROOMS_FILE  = path.join(app.getPath('userData'), 'nexus-rooms.json');

let config = { clientId: '', clientSecret: '', region: 'eu' };
let rooms  = []; // [{ id, name, icon, deviceIds[] }]

function loadConfig() {
  try { if (fs.existsSync(CONFIG_FILE)) config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8')) }; } catch {}
  try { if (fs.existsSync(ROOMS_FILE))  rooms  = JSON.parse(fs.readFileSync(ROOMS_FILE,'utf8')); } catch {}
}
function saveConfig() { try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config,null,2)); } catch {} }
function saveRooms()  { try { fs.writeFileSync(ROOMS_FILE,  JSON.stringify(rooms,null,2));  } catch {} }
function isConfigured() { return !!(config.clientId && config.clientSecret); }

// ─── Tuya API ─────────────────────────────────────────────────────────────────
const HOSTS = { eu:'openapi.tuyaeu.com', us:'openapi.tuyaus.com', cn:'openapi.tuyacn.com', in:'openapi.tuyain.com' };
let accessToken = null, tokenExpiry = 0;

function hmac(str, secret) { return crypto.createHmac('sha256',secret).update(str).digest('hex').toUpperCase(); }

function buildHeaders(method, apiPath, body='') {
  const t = Date.now().toString(), nonce = crypto.randomUUID().replace(/-/g,'');
  const contentHash = crypto.createHash('sha256').update(body).digest('hex');
  const signStr = config.clientId+(accessToken||'')+t+nonce+`${method}\n${contentHash}\n\n${apiPath}`;
  return {
    'client_id':config.clientId,'access_token':accessToken||'','t':t,'nonce':nonce,
    'sign':hmac(signStr,config.clientSecret),'sign_method':'HMAC-SHA256','Content-Type':'application/json'
  };
}

function tuyaRequest(method, apiPath, body=null) {
  return new Promise((resolve,reject) => {
    const host = HOSTS[config.region]||HOSTS.eu, bodyStr = body?JSON.stringify(body):'';
    const req = https.request({ hostname:host, path:apiPath, method, headers:buildHeaders(method,apiPath,bodyStr) }, res => {
      let data=''; res.on('data',c=>data+=c);
      res.on('end',()=>{ try{resolve(JSON.parse(data))}catch{reject(new Error('Invalid JSON'))} });
    });
    req.on('error',reject); if(bodyStr) req.write(bodyStr); req.end();
  });
}

async function getToken() {
  if (accessToken && Date.now()<tokenExpiry) return accessToken;
  const res = await tuyaRequest('GET','/v1.0/token?grant_type=1');
  if (!res.success) throw new Error(res.msg||'Token failed');
  accessToken=res.result.access_token; tokenExpiry=Date.now()+res.result.expire_time*1000-60000;
  return accessToken;
}

function detectCategory(d) {
  const c=(d.category||'').toLowerCase();
  if(['dj','dd','xdd','fwd','dc','jsq'].includes(c)) return 'light';
  if(['cz','pc','kg'].includes(c)) return 'switch';
  return 'generic';
}

// ─── IPC ──────────────────────────────────────────────────────────────────────
ipcMain.handle('get-config',      ()  => config);
ipcMain.handle('is-configured',   ()  => isConfigured());
ipcMain.handle('save-config', (e,c)   => { config={...config,...c}; accessToken=null; saveConfig(); return true; });

ipcMain.handle('get-rooms',       ()  => rooms);
ipcMain.handle('save-rooms', (e,r)    => { rooms=r; saveRooms(); return true; });

ipcMain.handle('get-devices', async () => {
  try {
    await getToken();
    const res = await tuyaRequest('GET','/v1.0/iot-01/associated-users/devices?last_row_key=&page_size=50');
    if (res.success && res.result) {
      const list = res.result.devices||res.result.list||res.result||[];
      res.result = { devices:(Array.isArray(list)?list:[]).map(d=>({...d,_category:detectCategory(d)})) };
    }
    return res;
  } catch(err) { return {success:false,msg:err.message}; }
});

ipcMain.handle('get-tuya-homes', async () => {
  try {
    await getToken();
    const res = await tuyaRequest('GET','/v1.0/homes?page_no=1&page_size=20');
    return res;
  } catch(err) { return {success:false,msg:err.message}; }
});

ipcMain.handle('get-tuya-rooms', async (e, homeId) => {
  try {
    await getToken();
    const res = await tuyaRequest('GET',`/v1.0/homes/${homeId}/rooms`);
    return res;
  } catch(err) { return {success:false,msg:err.message}; }
});

ipcMain.handle('get-room-devices', async (e, homeId, roomId) => {
  try {
    await getToken();
    const res = await tuyaRequest('GET',`/v1.0/homes/${homeId}/rooms/${roomId}/devices`);
    return res;
  } catch(err) { return {success:false,msg:err.message}; }
});

ipcMain.handle('get-device-status', async (e, deviceId) => {
  try { await getToken(); return await tuyaRequest('GET',`/v1.0/devices/${deviceId}/status`); }
  catch(err) { return {success:false,msg:err.message}; }
});

ipcMain.handle('send-command', async (e, deviceId, commands) => {
  try { await getToken(); return await tuyaRequest('POST',`/v1.0/devices/${deviceId}/commands`,{commands}); }
  catch(err) { return {success:false,msg:err.message}; }
});

ipcMain.handle('close-window',    () => mainWindow?.close());
ipcMain.handle('minimize-window', () => mainWindow?.minimize());

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:480, height:720, minWidth:420, minHeight:600,
    frame:false, backgroundColor:'#0c0c10',
    icon: path.join(__dirname,'assets','icon.ico'),
    webPreferences:{ nodeIntegration:true, contextIsolation:false }
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => { loadConfig(); createWindow(); autoUpdater.checkForUpdatesAndNotify().catch(()=>{}); });
app.on('window-all-closed', () => { if(process.platform!=='darwin') app.quit(); });
