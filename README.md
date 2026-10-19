# C-Slot

<p align="center">
  <img src="icon.png" width="128" height="128" alt="C-Slot Icon" />
</p>

<p align="center">
  <strong>Minimalist, Ultra-Fast Clipboard Slot Manager for Windows</strong>
</p>

<p align="center">
  <a href="https://github.com/Md-Ruwaid/Ctrl-slot/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078D6.svg" alt="Platform" />
  <img src="https://img.shields.io/badge/electron-v44-47848F.svg" alt="Electron" />
</p>

---

## What is C-Slot?

**C-Slot** is a lightweight Windows productivity utility that turns your clipboard into a 9-slot buffer. 

Instead of constantly switching windows back and forth to copy-paste multiple items, just copy everything in one pass (<kbd>Ctrl</kbd> + <kbd>C</kbd>) and paste any slot instantly using numbered hotkeys (<kbd>Ctrl</kbd> + <kbd>1</kbd>–<kbd>9</kbd>).

---

## Key Features

- **⚡ Instant Native Keystrokes**: Direct C++ Win32 API calls via `koffi` and `user32.dll` for sub-millisecond paste simulation.
- **🖥️ Multi-Monitor Aware**: Automatically detects your mouse position and pops up on whichever monitor you are currently using.
- **⌨️ Universal Keyboard Support**: Full support for both the top number row (<kbd>Ctrl</kbd> + <kbd>1</kbd>–<kbd>9</kbd>) and dedicated Numpads (<kbd>Ctrl</kbd> + <kbd>Num 1</kbd>–<kbd>Num 9</kbd>).
- **🔒 Privacy First**: All clipboard slots live strictly in memory (RAM). Nothing is ever written to disk or sent over a network.
- **🎯 Non-Intrusive HUD**: The sleek dark-mode popup appears unobtrusively when copying and automatically disappears without stealing typing focus.
- **🔄 Smart Clipboard Preservation**: Pasting from a slot doesn't permanently overwrite your active clipboard text.

---

## Hotkey Reference

| Action | Shortcut | Description |
| :--- | :--- | :--- |
| **Copy into next slot** | <kbd>Ctrl</kbd> + <kbd>C</kbd> / <kbd>X</kbd> | Automatically rotates through slots 1–9 |
| **Paste Slot 1–9** | <kbd>Ctrl</kbd> + <kbd>1</kbd> – <kbd>9</kbd> | Paste specific slot instantly |
| **Paste Numpad 1–9** | <kbd>Ctrl</kbd> + <kbd>Num 1</kbd> – <kbd>Num 9</kbd> | Dedicated Numpad support |
| **Toggle On / Off** | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>0</kbd> | Pause/resume capture and shortcuts |
| **Clear All Slots** | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>.</kbd> | Instantly wipe all 9 slots |

---

## Getting Started (Development)

### Prerequisites
- Node.js (v18+)
- Windows 10 or 11

### Installation & Run
```bash
git clone https://github.com/Md-Ruwaid/Ctrl-slot.git
cd Ctrl-slot
npm install
npm start
```

### Launch Web Download Portal & Landing Page
To run the high-performance download portal and interactive HUD sandbox locally:
```bash
npm run web
```
Then visit [http://localhost:3000](http://localhost:3000) to try the live simulator or download the installer binaries.

---

## Build Executable (Production)

To compile standalone Windows binaries:

```bash
npm run dist
```

Outputs will be generated in the `dist/` folder:
- **`C-Slot-Portable.exe`**: Zero-install standalone executable (drop it anywhere or run from USB).
- **`C-Slot Setup 0.1.0.exe`**: Full Windows installer with Start Menu integration and clean uninstaller.

---

## Architecture Overview

```
[ User Copies Text (Ctrl+C) ]
          │
          ▼
[ Windows System Clipboard ]
          │ (Polled every 150ms)
[ Electron Main Process (main.js) ]
  ├── koffi + user32.dll  ──► Instant native keybd_event simulation
  └── Tray & GlobalHotkeys
          │ (IPC)
[ Floating Overlay Window (src/) ]
  ├── index.html ── Clean semantic layout (with strict CSP)
  ├── style.css  ── Dark obsidian theme with smooth transitions
  └── renderer.js ── Fast DOM update with safe preview truncation
```

---

## License

This project is open-source under the [MIT License](LICENSE).
