const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

let mainWindow;

// ─── Config ───────────────────────────────────────────────────────────────────
const CONFIG_FILE = path.join(app.getPath('userData'), 'nexus-config.json');

let config = { clientId: '', clientSecret: '', region: 'eu', uid: '' };

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE))
      config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
  } catch {}
}
function saveConfig() {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); } catch {}
}
function isConfigured() {
  return config.clientId && config.clientSecret;
}

// ─── Tuya API ─────────────────────────────────────────────────────────────────
const HOSTS = { eu: 'openapi.tuyaeu.com', us: 'openapi.tuyaus.com', cn: 'openapi.tuyacn.com', in: 'openapi.tuyain.com' };

let accessToken = null;
let tokenExpiry = 0;

function hmac(str, secret) {
  return crypto.createHmac('sha256', secret).update(str).digest('hex').toUpperCase();
}

function buildHeaders(method, apiPath, body = '') {
  const t = Date.now().toString();
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const contentHash = crypto.createHash('sha256').update(body).digest('hex');
  const signStr = config.clientId + (accessToken || '') + t + nonce + `${method}\n${contentHash}\n\n${apiPath}`;
  const sign = hmac(signStr, config.clientSecret);
  return {
    'client_id': config.clientId,
    'access_token': accessToken || '',
    't': t, 'nonce': nonce, 'sign': sign,
    'sign_method': 'HMAC-SHA256',
    'Content-Type': 'application/json'
  };
}

function tuyaRequest(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const host = HOSTS[config.region] || HOSTS.eu;
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = { hostname: host, path: apiPath, method, headers: buildHeaders(method, apiPath, bodyStr) };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  const res = await tuyaRequest('GET', '/v1.0/token?grant_type=1');
  if (!res.success) throw new Error(res.msg || 'Token failed');
  accessToken = res.result.access_token;
  tokenExpiry = Date.now() + res.result.expire_time * 1000 - 60000;
  return accessToken;
}

async function getTokenForQR() {
  // Token without access_token for QR generation
  const t = Date.now().toString();
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const contentHash = crypto.createHash('sha256').update('').digest('hex');
  const signStr = config.clientId + '' + t + nonce + `GET\n${contentHash}\n\n/v1.0/token?grant_type=1`;
  const sign = hmac(signStr, config.clientSecret);
  const headers = { 'client_id': config.clientId, 'access_token': '', 't': t, 'nonce': nonce, 'sign': sign, 'sign_method': 'HMAC-SHA256', 'Content-Type': 'application/json' };
  return new Promise((resolve, reject) => {
    const host = HOSTS[config.region] || HOSTS.eu;
    const req = https.request({ hostname: host, path: '/v1.0/token?grant_type=1', method: 'GET', headers }, res => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } });
    });
    req.on('error', reject); req.end();
  });
}

// ─── Device helpers ───────────────────────────────────────────────────────────
function detectCategory(device) {
  const cat = (device.category || '').toLowerCase();
  if (['dj', 'dd', 'xdd', 'fwd', 'dc', 'jsq'].includes(cat)) return 'light';
  if (['cz', 'pc', 'kg'].includes(cat)) return 'switch';
  return 'generic';
}

// ─── IPC ──────────────────────────────────────────────────────────────────────
ipcMain.handle('get-config', () => config);
ipcMain.handle('is-configured', () => isConfigured());

ipcMain.handle('save-config', (e, c) => {
  config = { ...config, ...c };
  accessToken = null;
  saveConfig();
  return true;
});

ipcMain.handle('generate-qr-token', async () => {
  try {
    const res = await getTokenForQR();
    if (!res.success) return { success: false, msg: res.msg };
    return { success: true, token: res.result.access_token };
  } catch (err) { return { success: false, msg: err.message }; }
});

ipcMain.handle('get-qr-code', async () => {
  try {
    await getToken();
    const res = await tuyaRequest('GET', `/v1.0/iot-03/users/login/qrcode/create?time_out=300&old_login=false`);
    return res;
  } catch (err) { return { success: false, msg: err.message }; }
});

ipcMain.handle('poll-qr', async (e, qrcode) => {
  try {
    await getToken();
    const res = await tuyaRequest('GET', `/v1.0/iot-03/users/login/qrcode/state?qrcode=${encodeURIComponent(qrcode)}`);
    return res;
  } catch (err) { return { success: false, msg: err.message }; }
});

ipcMain.handle('get-devices', async () => {
  try {
    await getToken();
    const res = await tuyaRequest('GET', `/v2.0/cloud/thing/device?page_no=1&page_size=50`);
    if (res.success && res.result) {
      res.result.devices = (res.result.devices || res.result.list || []).map(d => ({
        ...d, _category: detectCategory(d)
      }));
    }
    return res;
  } catch (err) { return { success: false, msg: err.message }; }
});

ipcMain.handle('get-device-status', async (e, deviceId) => {
  try {
    await getToken();
    return await tuyaRequest('GET', `/v1.0/devices/${deviceId}/status`);
  } catch (err) { return { success: false, msg: err.message }; }
});

ipcMain.handle('send-command', async (e, deviceId, commands) => {
  try {
    await getToken();
    return await tuyaRequest('POST', `/v1.0/devices/${deviceId}/commands`, { commands });
  } catch (err) { return { success: false, msg: err.message }; }
});

ipcMain.handle('close-window', () => mainWindow?.close());
ipcMain.handle('minimize-window', () => mainWindow?.minimize());

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 700,
    minWidth: 380,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0c0c10',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  loadConfig();
  createWindow();
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
