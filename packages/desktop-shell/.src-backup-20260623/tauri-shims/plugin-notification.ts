// Web stub for @tauri-apps/plugin-notification — partial real fallback via the
// browser Notification API.
type Perm = 'granted' | 'denied' | 'default';

export function isPermissionGranted(): Promise<boolean> {
  if (typeof Notification === 'undefined') return Promise.resolve(false);
  return Promise.resolve(Notification.permission === 'granted');
}

export function requestPermission(): Promise<Perm> {
  if (typeof Notification === 'undefined') return Promise.resolve('denied');
  return Notification.requestPermission() as Promise<Perm>;
}

export function sendNotification(
  options: string | { title: string; body?: string; [k: string]: unknown },
): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    if (typeof options === 'string') {
      new Notification(options);
    } else {
      new Notification(options.title, { body: options.body });
    }
  } catch {
    /* ignore */
  }
}

export function registerActionTypes(_types: unknown[]): Promise<void> {
  return Promise.resolve();
}
export function onAction(_handler: (action: unknown) => void): Promise<() => void> {
  return Promise.resolve(() => {});
}
export function onNotificationReceived(_handler: (n: unknown) => void): Promise<() => void> {
  return Promise.resolve(() => {});
}
