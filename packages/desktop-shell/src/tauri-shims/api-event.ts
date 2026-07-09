// Web stub for @tauri-apps/api/event
export type UnlistenFn = () => void;

export interface Event<T> {
  event: string;
  id: number;
  payload: T;
}

export type EventCallback<T> = (event: Event<T>) => void;

export function listen<T = unknown>(
  _event: string,
  _handler: EventCallback<T>,
): Promise<UnlistenFn> {
  return Promise.resolve(() => {});
}

export function once<T = unknown>(
  _event: string,
  _handler: EventCallback<T>,
): Promise<UnlistenFn> {
  return Promise.resolve(() => {});
}

export function emit(_event: string, _payload?: unknown): Promise<void> {
  return Promise.resolve();
}

export function emitTo(
  _target: string,
  _event: string,
  _payload?: unknown,
): Promise<void> {
  return Promise.resolve();
}

export const TauriEvent = {} as Record<string, string>;
