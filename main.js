const { app, BrowserWindow, globalShortcut, clipboard, Tray, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const koffi = require('koffi');

// ==========================================
// Windows Native Keystroke Simulation (koffi)
// ==========================================
// Calls user32.dll directly in-process for instant (<0.05ms) paste response.
const user32 = koffi.load('user32.dll');
const keybd_event = user32.func('void __stdcall keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr_t dwExtraInfo)');
const GetAsyncKeyState = user32.func('int16 __stdcall GetAsyncKeyState(int32 vKey)');

const VK_CONTROL = 0x11;
const VK_V = 0x56;
const KEYEVENTF_KEYUP = 0x0002;

function simulatePaste() {
  // Check if the user is physically holding the Ctrl key right now
  const isCtrlHeld = (GetAsyncKeyState(VK_CONTROL) & 0x8000) !== 0;

  if (isCtrlHeld) {
    // CRITICAL FIX: If user is physically holding Ctrl, do NOT release or re-press Ctrl!
    // Releasing Ctrl virtually destroys Windows modifier state for chained shortcuts (e.g. Ctrl+1, 2, 4, 3).
    // We only simulate tapping 'V'.
    keybd_event(VK_V, 0, 0, 0);
    keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0);
  } else {
    // User released Ctrl very quickly; simulate complete Ctrl+V sequence
    keybd_event(VK_CONTROL, 0, 0, 0);
    keybd_event(VK_V, 0, 0, 0);
    keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0);
    keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
  }
}

// ==========================================
// Application State
// ==========================================
const N = 9;
let slots = Array(N).fill(null);
let next = 0;              // Next slot index to fill (0-8)
let lastSeen = '';         // Last clipboard text seen (prevents self-looping)
let enabled = true;        // Master toggle for hotkeys and watching

let overlayWindow = null;
let tray = null;
let hideTimer = null;
let watcherInterval = null;

// Paste session state (prevents timer collisions during rapid pastes)
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

// ==========================================
// Window & Popup Management
// ==========================================
function positionOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;
  const width = 300;
  const height = 372;

  // Dock to bottom-right corner, respecting Windows taskbar
  const x = workArea.x + workArea.width - width - 24;
  const y = workArea.y + workArea.height - height - 24;
  overlayWindow.setBounds({ x, y, width, height });
}

function showPopup() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  positionOverlay();

  // showInactive prevents stealing focus from the active window/cursor
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

// ==========================================
// Actions & Core Logic
// ==========================================
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
  slots = Array(N).fill(null);
  next = 0;
  notify();
}

async function pasteSlot(idx) {
  const text = slots[idx];

  // If slot is empty, immediately show overlay so user gets visual feedback
  if (!text) {
    showPopup();
    return;
  }

  isPasting = true;

  // Cancel any existing restore timer from a rapid previous paste
  if (restoreTimer) {
    clearTimeout(restoreTimer);
    restoreTimer = null;
  }

  // Save the original clipboard once per paste session
  if (sessionOriginalClipboard === null) {
    try {
      const current = await clipboard.readText();
      if (current && !slots.includes(current)) {
        sessionOriginalClipboard = current;
      }
    } catch {
      // Ignored if clipboard is locked
    }
  }

  // Set clipboard to the selected slot
  lastSeen = text;
  clipboard.writeText(text);

  // Wait 35ms then trigger V
  setTimeout(() => {
    simulatePaste();

    // Debounce restore: wait 350ms of quiet time after the LAST paste before restoring
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

// ==========================================
// Global Shortcuts (Supports both Numpad & Top Number Row)
// ==========================================
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
  // Toggle enabled on/off (supports Ctrl+Alt+0 and Ctrl+Alt+Numpad0)
  ['Control+Alt+num0', 'Control+Alt+0'].forEach((sc) => {
    if (!globalShortcut.isRegistered(sc)) {
      globalShortcut.register(sc, () => {
        setEnabled(!enabled);
      });
    }
  });

  // Clear all slots (supports Ctrl+Alt+. and Ctrl+Alt+Numpad.)
  ['Control+Alt+numdec', 'Control+Alt+.'].forEach((sc) => {
    if (!globalShortcut.isRegistered(sc)) {
      globalShortcut.register(sc, () => {
        clearSlots();
      });
    }
  });

  // Register slot paste shortcuts if enabled
  registerSlotShortcuts(enabled);
}

// ==========================================
// Clipboard Watcher
// ==========================================
function startClipboardWatcher() {
  clipboard.readText().then((txt) => {
    if (txt) lastSeen = txt;
  });

  watcherInterval = setInterval(async () => {
    // Ignore watcher while app is disabled or actively performing a paste sequence
    if (!enabled || isPasting) return;

    try {
      const text = await clipboard.readText();
      if (!text || text === lastSeen) return;

      lastSeen = text;
      slots[next] = text;
      next = (next + 1) % N; // 10th copy replaces slot 1

      notify();
    } catch {
      // Ignored: clipboard temporarily locked by another process
    }
  }, 150);
}

// ==========================================
// System Tray
// ==========================================
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

// ==========================================
// Window Lifecycle
// ==========================================
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
    focusable: false, // Ensures typing focus stays with user's active window
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

// Single-instance lock
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
    tray.setToolTip('Ctrl Slot');
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
