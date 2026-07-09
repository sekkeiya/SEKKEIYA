// Platform detection shared across the desktop shell when embedded in the web build.
// On the Tauri desktop app, the runtime injects `__TAURI_INTERNALS__` on window.
// In the web build (vite aliases @tauri-apps/* to stubs) this is always false,
// so native-only code paths (FS, global shortcuts, capture, Rhino, Blender setup)
// can be guarded off cleanly.
export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const isWeb = (): boolean => !isTauri();
