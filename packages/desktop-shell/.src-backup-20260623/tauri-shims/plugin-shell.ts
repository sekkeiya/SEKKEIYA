// Web stub for @tauri-apps/plugin-shell
// `open` (open a path/URL with the OS) maps to window.open for URLs; spawning
// processes is impossible on web and rejects.
export function open(path: string, _openWith?: string): Promise<void> {
  if (typeof path === 'string' && /^https?:\/\//i.test(path)) {
    window.open(path, '_blank', 'noopener,noreferrer');
    return Promise.resolve();
  }
  return Promise.reject(new Error('[web] shell.open unavailable on web'));
}

export class Command {
  constructor(..._args: unknown[]) {}
  execute(): Promise<never> {
    return Promise.reject(new Error('[web] shell.Command unavailable on web'));
  }
  spawn(): Promise<never> {
    return Promise.reject(new Error('[web] shell.Command unavailable on web'));
  }
  static create(..._args: unknown[]): Command {
    return new Command();
  }
}
