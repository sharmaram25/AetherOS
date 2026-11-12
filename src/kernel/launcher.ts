import { wm } from './windows';
import { vfs } from './vfs';
import { kindOf, mimeOf } from '../lib/mime';
import { basename, dirname, extname, HOME, stem, TRASH, isInside } from '../lib/path';
import { dialog } from './dialog';
import { notify, toast } from './notify';
import { settings } from './settings';
import { installApp, validateManifest } from '../sdk/apps';
import { openWithPassword, type Sealed } from './crypto';
import { logAccess } from './privacy';

export function appForPath(path: string): string {
  const node = vfs.stat(path);
  const kind = kindOf(path, node?.kind === 'dir');
  switch (kind) {
    case 'folder': return 'files';
    case 'markdown': return 'notes';
    case 'image': return 'photos';
    case 'audio': case 'video': return 'media';
    case 'sheet': return 'sheets';
    case 'pdf': return 'preview';
    case 'calendar': return 'calendar';
    case 'app': return 'store';
    default: return node && node.size > 5_000_000 && kind === 'unknown' ? 'preview' : 'code';
  }
}

export async function openPath(path: string, withApp?: string) {
  const node = vfs.stat(path);
  if (!node) return;
  if (isInside(path, TRASH) && !withApp) {
    toast('Restore this item to open it', 'warn');
    return;
  }
  const kind = kindOf(path, node.kind === 'dir');
  if (!withApp && kind === 'app') {
    try {
      const m = validateManifest(JSON.parse(await vfs.readText(path)));
      const ok = await dialog.confirm({
        title: `Install “${m.name}”?`,
        message: `${m.description ?? ''}\n\nRequested permissions: ${m.permissions.length ? m.permissions.join(', ') : 'none'}.\nThe app will run in an isolated sandbox with no network access.`,
        confirmLabel: 'Install',
      });
      if (ok) {
        await installApp(m);
        notify({ appId: 'store', title: `${m.name} installed`, tone: 'success', actions: [{ label: 'Open', run: () => wm.open('ext:' + m.id) }] });
      }
    } catch (e) {
      notify({ title: 'Could not install app', body: (e as Error).message, tone: 'error' });
    }
    return;
  }
  if (!withApp && kind === 'sealed') {
    await unsealFile(path);
    return;
  }
  const app = withApp ?? appForPath(path);
  wm.open(app, { path });
  logAccess(app, 'open-file', true, basename(path));
}

export async function unsealFile(path: string) {
  const pw = await dialog.prompt({ title: 'Unseal file', message: `Enter the password used to seal “${basename(path)}”.`, password: true, confirmLabel: 'Unseal' });
  if (!pw) return;
  try {
    const sealed = JSON.parse(await vfs.readText(path)) as Sealed & { name?: string };
    const bytes = await openWithPassword(pw, sealed);
    const name = sealed.name ?? stem(path);
    const dest = vfs.uniquePath(dirname(path), name);
    await vfs.writeBytes(dest, bytes, mimeOf(name));
    toast(`Unsealed to ${basename(dest)}`, 'success');
  } catch {
    notify({ title: 'Wrong password', body: 'The file could not be decrypted.', tone: 'error' });
  }
}

/** Re-encode an image through canvas, discarding EXIF/GPS/XMP metadata. */
export async function stripImageMetadata(file: Blob): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bmp = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close();
  return canvas.convertToBlob({ type: file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality: 0.92 });
}

/** Import files from the host OS (drag & drop or picker) into the encrypted VFS. */
export async function importHostFiles(files: FileList | File[], destDir = `${HOME}/Downloads`) {
  const list = Array.from(files);
  if (!list.length) return [];
  const out: string[] = [];
  let stripped = 0;
  for (const f of list) {
    let blob: Blob = f;
    if (settings().stripMetadata && /^image\/(jpeg|webp)$/.test(f.type)) {
      try { blob = await stripImageMetadata(f); stripped++; } catch { /* keep original */ }
    }
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const target = vfs.uniquePath(destDir + (rel.includes('/') ? '/' + dirname('/' + rel).slice(1) : ''), basename(rel));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await vfs.writeBytes(target, bytes, f.type || mimeOf(f.name));
    out.push(target);
  }
  notify({
    appId: 'files',
    title: `Imported ${out.length} item${out.length > 1 ? 's' : ''}`,
    body: `Encrypted and saved to ${destDir.replace(HOME, '~')}${stripped ? ` · removed hidden metadata from ${stripped} photo${stripped > 1 ? 's' : ''}` : ''}`,
    tone: 'success',
    actions: [{ label: 'Show', run: () => wm.open('files', { path: destDir }) }],
  });
  return out;
}

export function pickHostFiles(opts: { accept?: string; multiple?: boolean; directory?: boolean } = {}): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (opts.accept) input.accept = opts.accept;
    input.multiple = opts.multiple ?? true;
    if (opts.directory) (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.oncancel = () => resolve([]);
    input.click();
  });
}

/** Export (decrypt) a file to the host's downloads. */
export async function exportToHost(path: string) {
  const blob = await vfs.readBlob(path);
  downloadBlob(blob, basename(path));
  logAccess('files', 'export', true, basename(path));
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function newFileName(dir: string, base: string) {
  return basename(vfs.uniquePath(dir, base));
}

export const isMarkdown = (p: string) => ['md', 'markdown'].includes(extname(p));
