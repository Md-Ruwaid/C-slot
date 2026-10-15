# Ctrl Slot

Copy things as usual (Ctrl+C / Ctrl+X). Each new copy fills the next slot, 1 through 9.
Press **Ctrl + 1–9** (or **Ctrl + Numpad 1–9**) to paste that slot. The 10th copy replaces slot 1.

Shortcuts:
- **Ctrl + Alt + 0** (or Ctrl + Alt + Num 0): Toggles capture and paste on/off.
- **Ctrl + Alt + .** (or Ctrl + Alt + Num .): Clears all 9 slots.

The small popup shows your slots whenever you copy something. Capture starts
enabled. Works on laptops (top number row) and full keyboards with Numpads. Slots live in
memory only and are gone when you quit.

## Run it (Development)
1. `npm install`
2. `npm start`

## Build .exe (Production)
```bash
npm run dist
```
This generates two Windows executables in the `dist/` folder:
- **`Ctrl Slot-Portable.exe`**: Standalone single executable (no installation needed).
- **`Ctrl Slot Setup 0.1.0.exe`**: Standard installer wizard (Start Menu shortcut & uninstaller).


