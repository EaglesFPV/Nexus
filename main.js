const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

let mainWindow;
let tray;

// ─── Tuya Cloud Config ────────────────────────────────────────────────────────
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

let config = {
  clientId: '',
  clientSecret: '',
  region: 'eu',
  devices: []
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    }
  } catch {}
}

function saveConfig() {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); } catch {}
}

// ─── Tuya Cloud API ───────────────────────────────────────────────────────────
const TUYA_REGIONS = {
  eu: 'openapi.tuyaeu.com',
  us: 'openapi.tuyaus.com',
  cn: 'openapi.tuyacn.com',
  in: 'openapi.tuyain.com'
};

let accessToken = null;
let tokenExpiry = 0;

function hmacSha256(str, secret) {
  return crypto.createHmac('sha256', secret).update(str).digest('hex').toUpperCase();
}

function buildHeaders(method, path, body = '') {
  const t = Date.now().toString();
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const contentHash = crypto.createHash('sha256').update(body).digest('hex');
  const signStr = config.clientId + (accessToken || '') + t + nonce + `${method}\n${contentHash}\n\n${path}`;
  const sign = hmacSha256(signStr, config.clientSecret);
  return {
    'client_id': config.clientId,
    'access_token': accessToken || '',
    't': t,
    'nonce': nonce,
    'sign': sign,
    'sign_method': 'HMAC-SHA256',
    'Content-Type': 'application/json'
  };
}

function tuyaRequest(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const host = TUYA_REGIONS[config.region] || TUYA_REGIONS.eu;
    const bodyStr = body ? JSON.stringify(body) : '';
    const headers = buildHeaders(method, apiPath, bodyStr);

    const options = {
      hostname: host,
      path: apiPath,
      method,
      headers
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON response')); }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  const res = await tuyaRequest('GET', '/v1.0/token?grant_type=1');
  if (res.success) {
    accessToken = res.result.access_token;
    tokenExpiry = Date.now() + (res.result.expire_time * 1000) - 60000;
    return accessToken;
  }
  throw new Error('Token error: ' + res.msg);
}

async function sendCommand(deviceId, commands) {
  await getToken();
  const res = await tuyaRequest('POST', `/v1.0/devices/${deviceId}/commands`, { commands });
  return res;
}

async function getDeviceStatus(deviceId) {
  await getToken();
  const res = await tuyaRequest('GET', `/v1.0/devices/${deviceId}/status`);
  return res;
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('get-config', () => config);

ipcMain.handle('save-config', (e, newConfig) => {
  config = { ...config, ...newConfig };
  saveConfig();
  accessToken = null; // reset token when config changes
  return true;
});

ipcMain.handle('turn-on', async (e, deviceId) => {
  try {
    return await sendCommand(deviceId, [{ code: 'switch_led', value: true }]);
  } catch (err) { return { success: false, msg: err.message }; }
});

ipcMain.handle('turn-off', async (e, deviceId) => {
  try {
    return await sendCommand(deviceId, [{ code: 'switch_led', value: false }]);
  } catch (err) { return { success: false, msg: err.message }; }
});

ipcMain.handle('set-brightness', async (e, deviceId, value) => {
  try {
    return await sendCommand(deviceId, [
      { code: 'work_mode', value: 'white' },
      { code: 'bright_value_v2', value: Math.round(value) }
    ]);
  } catch (err) { return { success: false, msg: err.message }; }
});

ipcMain.handle('set-color', async (e, deviceId, h, s, v) => {
  try {
    return await sendCommand(deviceId, [
      { code: 'work_mode', value: 'colour' },
      { code: 'colour_data_v2', value: { h, s, v } }
    ]);
  } catch (err) { return { success: false, msg: err.message }; }
});

ipcMain.handle('set-temp', async (e, deviceId, value) => {
  try {
    return await sendCommand(deviceId, [
      { code: 'work_mode', value: 'white' },
      { code: 'temp_value_v2', value: Math.round(value) }
    ]);
  } catch (err) { return { success: false, msg: err.message }; }
});

ipcMain.handle('get-status', async (e, deviceId) => {
  try {
    return await getDeviceStatus(deviceId);
  } catch (err) { return { success: false, msg: err.message }; }
});

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 680,
    resizable: false,
    frame: false,
    backgroundColor: '#0f0f13',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  loadConfig();
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
