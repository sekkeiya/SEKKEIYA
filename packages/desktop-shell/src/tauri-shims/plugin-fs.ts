// Web stub for @tauri-apps/plugin-fs
// Local filesystem access is desktop-only. All callers must be guarded by isTauri();
// reject loudly so any unguarded web path surfaces in dev.
const fail = (name: string) => (..._args: unknown[]) =>
  Promise.reject(new Error(`[web] fs.${name} unavailable on web`));

export const readFile = fail('readFile');
export const readTextFile = fail('readTextFile');
export const writeFile = fail('writeFile');
export const writeTextFile = fail('writeTextFile');
export const exists = (..._args: unknown[]) => Promise.resolve(false);
export const mkdir = fail('mkdir');
export const remove = fail('remove');
export const rename = fail('rename');
export const copyFile = fail('copyFile');
export const readDir = (..._args: unknown[]) => Promise.resolve([]);
export const stat = fail('stat');
export const lstat = fail('lstat');
export const create = fail('create');
export const open = fail('open');
export const watch = (..._args: unknown[]) => Promise.resolve(() => {});
export const watchImmediate = (..._args: unknown[]) => Promise.resolve(() => {});

export const BaseDirectory = {} as Record<string, number>;
