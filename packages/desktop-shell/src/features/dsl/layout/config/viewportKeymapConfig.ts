// src/features/dsl/layout/config/viewportKeymapConfig.ts

export type KeymapBinding = {
  key: string;       // e.code representation, e.g., 'KeyT', 'Digit1'
  ctrl?: boolean;    // Requires Ctrl/Cmd modifier
  shift?: boolean;   // Requires Shift modifier
  alt?: boolean;     // Requires Alt/Option modifier
};

export type ViewportKeymap = {
  speed: {
    inspect: KeymapBinding;
    walk: KeymapBinding;
    cycle: KeymapBinding;
    drive: KeymapBinding;
    fly: KeymapBinding;
  };
  view: {
    top: KeymapBinding;
    perspective: KeymapBinding;
    front: KeymapBinding;
    right: KeymapBinding;
  };
};

export const DEFAULT_KEYMAP: ViewportKeymap = {
  speed: {
    inspect: { key: "Digit1" },
    walk: { key: "Digit2" },
    cycle: { key: "Digit3" },
    drive: { key: "Digit4" },
    fly: { key: "Digit5" },
  },
  view: {
    perspective: { key: "Digit1", ctrl: true },
    top: { key: "Digit2", ctrl: true },
    front: { key: "Digit3", ctrl: true },
    right: { key: "Digit4", ctrl: true },
  },
};

/**
 * Utility to match an incoming KeyboardEvent with a KeymapBinding
 */
export const matchKeymap = (e: KeyboardEvent, binding: KeymapBinding): boolean => {
  if (!!binding.ctrl !== (e.ctrlKey || e.metaKey)) return false; // Map ctrl or cmd
  if (!!binding.shift !== e.shiftKey) return false;
  if (!!binding.alt !== e.altKey) return false;

  if (e.code === binding.key) return true;

  // Allow Numpad aliases for Digit keys
  if (binding.key.startsWith('Digit') && e.code === `Numpad${binding.key.slice(5)}`) return true;
  if (binding.key.startsWith('Numpad') && e.code === `Digit${binding.key.slice(6)}`) return true;

  return false;
};
