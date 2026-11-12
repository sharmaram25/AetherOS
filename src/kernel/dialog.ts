import { create } from 'zustand';
import { randomId } from './crypto';

export interface ConfirmOpts { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean; requireText?: string }
export interface PromptOpts { title: string; message?: string; label?: string; value?: string; placeholder?: string; password?: boolean; confirmLabel?: string; validate?: (v: string) => string | null; selectStem?: boolean }
export interface PickOpts { title?: string; mode: 'open' | 'save' | 'folder'; startDir?: string; extensions?: string[]; defaultName?: string; multiple?: boolean }
export interface PermissionOpts { appId: string; appName: string; perm: string; reason?: string }

type DialogSpec =
  | { kind: 'confirm'; opts: ConfirmOpts }
  | { kind: 'prompt'; opts: PromptOpts }
  | { kind: 'alert'; opts: ConfirmOpts }
  | { kind: 'pick'; opts: PickOpts }
  | { kind: 'permission'; opts: PermissionOpts };

export type Dialog = DialogSpec & { id: string; resolve: (v: any) => void };

export const useDialogs = create<{ stack: Dialog[] }>(() => ({ stack: [] }));

function push<T>(spec: DialogSpec): Promise<T> {
  return new Promise<T>((resolve) => {
    const id = randomId(8);
    const d = { ...spec, id, resolve: (v: T) => { useDialogs.setState((s) => ({ stack: s.stack.filter((x) => x.id !== id) })); resolve(v); } } as Dialog;
    useDialogs.setState((s) => ({ stack: [...s.stack, d] }));
  });
}

export const dialog = {
  confirm: (opts: ConfirmOpts) => push<boolean>({ kind: 'confirm', opts }),
  alert: (opts: ConfirmOpts) => push<void>({ kind: 'alert', opts }),
  prompt: (opts: PromptOpts) => push<string | null>({ kind: 'prompt', opts }),
  pick: (opts: PickOpts) => push<string | string[] | null>({ kind: 'pick', opts }),
  open: (opts: Omit<PickOpts, 'mode'> = {}) => push<string | null>({ kind: 'pick', opts: { ...opts, mode: 'open' } }),
  save: (opts: Omit<PickOpts, 'mode'> = {}) => push<string | null>({ kind: 'pick', opts: { ...opts, mode: 'save' } }),
  folder: (opts: Omit<PickOpts, 'mode'> = {}) => push<string | null>({ kind: 'pick', opts: { ...opts, mode: 'folder' } }),
  permission: (opts: PermissionOpts) => push<'once' | 'always' | 'deny'>({ kind: 'permission', opts }),
  dismissAll() {
    useDialogs.getState().stack.forEach((d) => d.resolve(d.kind === 'confirm' ? false : null));
  },
};
