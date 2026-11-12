/** Portable, password-encrypted backups (.aether). Readable only with the backup password. */
import { vfs, type FsNode } from './vfs';
import { sealWithPassword, openWithPassword, toB64, fromB64, utf8, fromUtf8, type Sealed } from './crypto';
import { downloadBlob } from './launcher';
import { useSettings, type Settings } from './settings';

interface Payload { nodes: Record<string, FsNode>; blobs: Record<string, string>; settings?: Partial<Settings> }

export async function createBackup(password: string) {
  const { nodes, blobs } = await vfs.exportAll();
  const b64: Record<string, string> = {};
  for (const [k, v] of Object.entries(blobs)) b64[k] = toB64(v);
  const { set: _s, reset: _r, ...prefs } = useSettings.getState();
  const payload: Payload = { nodes, blobs: b64, settings: prefs };
  const sealed = await sealWithPassword(password, utf8(JSON.stringify(payload)));
  const file = { format: 'aether-backup', created: new Date().toISOString(), files: Object.values(nodes).filter((n) => n.kind === 'file').length, ...sealed };
  const blob = new Blob([JSON.stringify(file)], { type: 'application/x-aether-backup' });
  downloadBlob(blob, `aether-backup-${new Date().toISOString().slice(0, 10)}.aether`);
  return file.files;
}

export async function readBackupInfo(file: File) {
  const json = JSON.parse(await file.text()) as Sealed & { format?: string; created?: string; files?: number };
  if (json.format !== 'aether-backup') throw new Error('This is not an AetherOS backup file');
  return json;
}

export async function restoreBackup(file: File, password: string, mode: 'merge' | 'replace', restoreSettings = false) {
  const json = await readBackupInfo(file);
  let bytes: Uint8Array;
  try {
    bytes = await openWithPassword(password, json);
  } catch {
    throw new Error('Incorrect backup password');
  }
  const payload = JSON.parse(fromUtf8(bytes)) as Payload;
  const blobs: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(payload.blobs)) blobs[k] = fromB64(v);
  await vfs.importAll({ nodes: payload.nodes, blobs }, mode);
  if (restoreSettings && payload.settings) useSettings.getState().set(payload.settings);
  return Object.values(payload.nodes).filter((n) => n.kind === 'file').length;
}
