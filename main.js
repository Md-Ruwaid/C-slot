const { app, BrowserWindow, globalShortcut, clipboard, Tray, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const koffi = require('koffi');

// Windows native keystroke simulation via user32.dll
const user32 = koffi.load('user32.dll');
const keybd_event = user32.func('void __stdcall keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr_t dwExtraInfo)');
const GetAsyncKeyState = user32.func('int16 __stdcall GetAsyncKeyState(int32 vKey)');

const VK_CONTROL = 0x11;
const VK_V = 0x56;
const KEYEVENTF_KEYUP = 0x0002;

function simulatePaste() {
  const isCtrlHeld = (GetAsyncKeyState(VK_CONTROL) & 0x8000) !== 0;

  if (isCtrlHeld) {
    // If Ctrl is physically held down, tap V only (keeps modifier state intact for rapid chaining)
    keybd_event(VK_V, 0, 0, 0);
    keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0);
  } else {
    // Ctrl was released quickly; simulate a full Ctrl+V press and release
    keybd_event(VK_CONTROL, 0, 0, 0);
    keybd_event(VK_V, 0, 0, 0);
    keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0);
    keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
  }
}

// Application State
const SLOT_COUNT = 9;
let slots = Array(SLOT_COUNT).fill(null);
let next = 0;
let lastSeen = '';
let enabled = true;

let overlayWindow = null;
let tray = null;
let hideTimer = null;
let watcherInterval = null;

// Paste session state
let isPasting = false;
let restoreTimer = null;
let sessionOriginalClipboard = null;

function getSnapshot() {
  return {
    enabled,
    next,
    slots: [...slots]
  };
}

// Window & Popup Management
function positionOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;
  const width = 300;
  const height = 372;

  // Dock to bottom-right corner above taskbar
  const x = workArea.x + workArea.width - width - 24;
  const y = workArea.y + workArea.height - height - 24;
  overlayWindow.setBounds({ x, y, width, height });
}

function showPopup() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  positionOverlay();

  // Show without stealing focus from the active window
  overlayWindow.showInactive();

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.hide();
    }
  }, 2500);
}

function notify() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('slots', getSnapshot());
  }
  showPopup();
}

// Actions & Core Logic
function setEnabled(on) {
  enabled = on;
  registerSlotShortcuts(on);

  if (on) {
    clipboard.readText().then((txt) => {
      if (txt) lastSeen = txt;
    });
  }

  updateTrayMenu();
  notify();
}

function clearSlots() {
  slots = Array(SLOT_COUNT).fill(null);
  next = 0;
  notify();
}

async function pasteSlot(idx) {
  const text = slots[idx];

  if (!text) {
    showPopup();
    return;
  }

  isPasting = true;

  if (restoreTimer) {
    clearTimeout(restoreTimer);
    restoreTimer = null;
  }

  if (sessionOriginalClipboard === null) {
    try {
      const current = await clipboard.readText();
      if (current && !slots.includes(current)) {
        sessionOriginalClipboard = current;
      }
    } catch {
      // Ignored if clipboard is locked by another app
    }
  }

  lastSeen = text;
  clipboard.writeText(text);

  setTimeout(() => {
    simulatePaste();

    // Debounce restore: wait for quiet time after rapid pastes
    if (restoreTimer) clearTimeout(restoreTimer);
    restoreTimer = setTimeout(async () => {
      if (sessionOriginalClipboard !== null) {
        lastSeen = sessionOriginalClipboard;
        clipboard.writeText(sessionOriginalClipboard);
        sessionOriginalClipboard = null;
      }
      isPasting = false;
      restoreTimer = null;
    }, 350);
  }, 35);
}

// Global Shortcuts (both Numpad and Top Number row)
const SLOT_SHORTCUTS = [
  ['Control+num1', 'Control+1'],
  ['Control+num2', 'Control+2'],
  ['Control+num3', 'Control+3'],
  ['Control+num4', 'Control+4'],
  ['Control+num5', 'Control+5'],
  ['Control+num6', 'Control+6'],
  ['Control+num7', 'Control+7'],
  ['Control+num8', 'Control+8'],
  ['Control+num9', 'Control+9']
];

function registerSlotShortcuts(active) {
  SLOT_SHORTCUTS.forEach((keys, i) => {
    keys.forEach((sc) => {
      if (active) {
        if (!globalShortcut.isRegistered(sc)) {
          globalShortcut.register(sc, () => pasteSlot(i));
        }
      } else {
        if (globalShortcut.isRegistered(sc)) {
          globalShortcut.unregister(sc);
        }
      }
    });
  });
}

function registerGlobalHotkeys() {
  // Toggle enabled on/off
  ['Control+Alt+num0', 'Control+Alt+0'].forEach((sc) => {
    if (!globalShortcut.isRegistered(sc)) {
      globalShortcut.register(sc, () => {
        setEnabled(!enabled);
      });
    }
  });

  // Clear all slots
  ['Control+Alt+numdec', 'Control+Alt+.'].forEach((sc) => {
    if (!globalShortcut.isRegistered(sc)) {
      globalShortcut.register(sc, () => {
        clearSlots();
      });
    }
  });

  registerSlotShortcuts(enabled);
}

// Clipboard Watcher
function startClipboardWatcher() {
  clipboard.readText().then((txt) => {
    if (txt) lastSeen = txt;
  });

  watcherInterval = setInterval(async () => {
    if (!enabled || isPasting) return;

    try {
      const text = await clipboard.readText();
      if (!text || text === lastSeen) return;

      lastSeen = text;
      slots[next] = text;
      next = (next + 1) % SLOT_COUNT;

      notify();
    } catch {
      // Ignored if clipboard is momentarily locked by another process
    }
  }, 150);
}

// System Tray
function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Enabled',
      type: 'checkbox',
      checked: enabled,
      click: (item) => setEnabled(item.checked)
    },
    {
      label: 'Show Slots',
      click: () => notify()
    },
    {
      label: 'Clear All',
      click: () => clearSlots()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

// Window Lifecycle
function createWindow() {
  overlayWindow = new BrowserWindow({
    width: 300,
    height: 372,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  overlayWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      overlayWindow.hide();
    }
  });
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    notify();
  });

  ipcMain.handle('get_state', () => getSnapshot());

  app.whenReady().then(() => {
    createWindow();

    const iconPath = path.join(__dirname, 'icon.ico');
    tray = new Tray(iconPath);
    tray.setToolTip('C-Slot');
    tray.on('click', () => notify());
    updateTrayMenu();

    registerGlobalHotkeys();
    startClipboardWatcher();
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    if (watcherInterval) clearInterval(watcherInterval);
  });
}
