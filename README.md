# Numpad Clipboard

Copy things as usual (Ctrl+C / Ctrl+X). Each new copy fills the next slot, 1 through 9.
Press Ctrl+Numpad 1-9 to paste that slot. The 10th copy replaces slot 1.

Shortcuts: Ctrl+Alt+Numpad 0 toggles on/off. Ctrl+Alt+Numpad . clears all slots.
The small popup shows your slots whenever you copy something. Capture starts
enabled; Ctrl+Alt+Numpad 0 toggles it on or off. Keep Num Lock on. Slots live in
memory only and are gone when you quit.

## Run it (Windows)
1. Install Rust (rustup.rs), Node.js, and the Visual Studio C++ Build Tools.
2. `npm install`
3. `npm run tauri icon app-icon.png`   (generates the icons folder)
4. `npm run tauri dev`
5. `npm run tauri build`   (installer ends up in src-tauri/target/release/bundle/nsis)
