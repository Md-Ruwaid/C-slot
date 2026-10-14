#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread::{self, sleep};
use std::time::Duration;

use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use serde_json::{json, Value};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, Wry};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const N: usize = 9;
const SLOT_CODES: [Code; N] = [
    Code::Numpad1, Code::Numpad2, Code::Numpad3,
    Code::Numpad4, Code::Numpad5, Code::Numpad6,
    Code::Numpad7, Code::Numpad8, Code::Numpad9,
];

struct AppState {
    slots: Mutex<Vec<Option<String>>>,
    next: Mutex<usize>,          // slot the next copy will fill
    last_seen: Mutex<String>,    // last clipboard text we know about
    enabled: AtomicBool,
    show_gen: AtomicU64,
    toggle_item: OnceLock<CheckMenuItem<Wry>>,
}

fn snapshot(st: &AppState) -> Value {
    let slots = st.slots.lock().unwrap();
    let contents = slots.clone();
    json!({
        "enabled": st.enabled.load(Ordering::SeqCst),
        "next": *st.next.lock().unwrap(),
        "slots": contents
    })
}

fn current_clipboard() -> String {
    Clipboard::new().and_then(|mut c| c.get_text()).unwrap_or_default()
}

fn read_clipboard(clipboard: &mut Option<Clipboard>) -> Option<String> {
    if clipboard.is_none() {
        *clipboard = Clipboard::new().ok();
    }

    let text = clipboard.as_mut()?.get_text();
    if text.is_err() {
        *clipboard = None;
    }
    text.ok()
}

fn show_popup(app: &AppHandle) {
    let state = app.state::<AppState>();
    if let Some(w) = app.get_webview_window("overlay") {
        if let (Ok(Some(monitor)), Ok(size)) = (w.primary_monitor(), w.outer_size()) {
            let (position, monitor_size, scale) =
                (monitor.position(), monitor.size(), monitor.scale_factor());
            let x = position.x + monitor_size.width as i32 - size.width as i32 - (24.0 * scale) as i32;
            let y = position.y + monitor_size.height as i32 - size.height as i32 - (64.0 * scale) as i32;
            let _ = w.set_position(PhysicalPosition::new(x, y));
        }
        let _ = w.show();
    }
    let generation = state.show_gen.fetch_add(1, Ordering::SeqCst) + 1;
    let app = app.clone();
    thread::spawn(move || {
        sleep(Duration::from_millis(2500));
        let state = app.state::<AppState>();
        if state.show_gen.load(Ordering::SeqCst) == generation {
            if let Some(w) = app.get_webview_window("overlay") {
                let _ = w.hide();
            }
        }
    });
}

fn notify(app: &AppHandle) {
    let st = app.state::<AppState>();
    let _ = app.emit("slots", snapshot(&st));
    show_popup(app);
}

fn set_enabled(app: &AppHandle, on: bool) {
    let st = app.state::<AppState>();
    st.enabled.store(on, Ordering::SeqCst);
    let gs = app.global_shortcut();
    for code in SLOT_CODES {
        let sc = Shortcut::new(Some(Modifiers::CONTROL), code);
        if on { let _ = gs.register(sc); } else { let _ = gs.unregister(sc); }
    }
    if on {
        // don't capture whatever was already on the clipboard
        *st.last_seen.lock().unwrap() = current_clipboard();
    }
    if let Some(item) = st.toggle_item.get() {
        let _ = item.set_checked(on);
    }
    notify(app);
}

fn clear(app: &AppHandle) {
    let st = app.state::<AppState>();
    st.slots.lock().unwrap().iter_mut().for_each(|s| *s = None);
    *st.next.lock().unwrap() = 0;
    notify(app);
}

fn paste_slot(app: AppHandle, idx: usize) {
    thread::spawn(move || {
        let st = app.state::<AppState>();
        let text = match st.slots.lock().unwrap()[idx].clone() {
            Some(t) => t,
            None => return,
        };
        let mut cb = match Clipboard::new() { Ok(c) => c, Err(_) => return };
        let original = cb.get_text().ok();

        // tell the watcher this change is ours, so it isn't stored as a new copy
        *st.last_seen.lock().unwrap() = text.clone();
        if cb.set_text(text).is_err() { return; }
        sleep(Duration::from_millis(40));

        // Ctrl is still physically held (we trigger on key-down), so only V is needed
        if let Ok(mut e) = Enigo::new(&Settings::default()) {
            let _ = e.key(Key::Unicode('v'), Direction::Click);
        }

        // give the target app time to read the clipboard, then put the original back
        sleep(Duration::from_millis(250));
        if let Some(o) = original {
            *st.last_seen.lock().unwrap() = o.clone();
            let _ = cb.set_text(o);
        }
    });
}

fn start_clipboard_watcher(app: AppHandle) {
    thread::spawn(move || {
        let mut clipboard = None;
        loop {
            sleep(Duration::from_millis(150));
            let st = app.state::<AppState>();
            if !st.enabled.load(Ordering::SeqCst) { continue; }
            let Some(text) = read_clipboard(&mut clipboard) else {
                continue;
            };
            if text.is_empty() { continue; }
            {
                let mut last = st.last_seen.lock().unwrap();
                if *last == text { continue; }
                *last = text.clone();
            }
            {
                let mut slots = st.slots.lock().unwrap();
                let mut next = st.next.lock().unwrap();
                slots[*next] = Some(text);
                *next = (*next + 1) % N; // 10th copy replaces slot 1
            }
            notify(&app);
        }
    });
}

#[tauri::command]
fn get_state(state: tauri::State<AppState>) -> Value {
    snapshot(&state)
}

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, sc, event| {
                    if event.state() != ShortcutState::Pressed { return; }
                    if sc.mods == (Modifiers::CONTROL | Modifiers::ALT) {
                        match sc.key {
                            Code::Numpad0 => {
                                let on = !app.state::<AppState>().enabled.load(Ordering::SeqCst);
                                set_enabled(app, on);
                            }
                            Code::NumpadDecimal => clear(app),
                            _ => {}
                        }
                    } else if sc.mods == Modifiers::CONTROL {
                        if let Some(i) = SLOT_CODES.iter().position(|c| *c == sc.key) {
                            paste_slot(app.clone(), i);
                        }
                    }
                })
                .build(),
        )
        .manage(AppState {
            slots: Mutex::new(vec![None; N]),
            next: Mutex::new(0),
            last_seen: Mutex::new(String::new()),
            enabled: AtomicBool::new(false),
            show_gen: AtomicU64::new(0),
            toggle_item: OnceLock::new(),
        })
        .invoke_handler(tauri::generate_handler![get_state])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(|app| {
            let handle = app.handle().clone();

            let toggle = CheckMenuItem::with_id(app, "toggle", "Enabled (Ctrl+Alt+Num0)", true, true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show slots", true, None::<&str>)?;
            let clear_i = MenuItem::with_id(app, "clear", "Clear slots (Ctrl+Alt+Num.)", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&toggle, &show, &clear_i, &sep, &quit])?;
            let _ = app.state::<AppState>().toggle_item.set(toggle);

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Numpad Clipboard")
                .menu(&menu)
                .on_menu_event(|app, ev| match ev.id().as_ref() {
                    "toggle" => {
                        let on = !app.state::<AppState>().enabled.load(Ordering::SeqCst);
                        set_enabled(app, on);
                    }
                    "show" => notify(app),
                    "clear" => clear(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // toggle + clear hotkeys are always live; slot hotkeys only while enabled
            let gs = app.global_shortcut();
            let ca = Modifiers::CONTROL | Modifiers::ALT;
            let _ = gs.register(Shortcut::new(Some(ca), Code::Numpad0));
            let _ = gs.register(Shortcut::new(Some(ca), Code::NumpadDecimal));

            start_clipboard_watcher(handle.clone());
            set_enabled(&handle, true);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Numpad Clipboard");
}
