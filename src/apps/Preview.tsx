import { useEffect, useState } from 'react';
import { Download, FileQuestion, ExternalLink } from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { vfs } from '../kernel/vfs';
import { wm } from '../kernel/windows';
import { exportToHost, openPath } from '../kernel/launcher';
import { basename } from '../lib/path';
import { kindOf, formatBytes } from '../lib/mime';
import { Button, Empty, useObjectUrl } from '../ui';

export default function Preview({ win }: AppProps) {
  const path = win.data?.path as string | undefined;
  const node = path ? vfs.stat(path) : undefined;
  const kind = path ? kindOf(path) : 'unknown';
  const url = useObjectUrl(path && kind === 'pdf' ? () => vfs.objectUrl(path) : null, [path]);
  const [hex, setHex] = useState('');

  useEffect(() => { if (path) wm.setTitle(win.id, `${basename(path)} — Preview`); }, [path, win.id]);
  useEffect(() => {
    if (!path || kind === 'pdf') return;
    void vfs.readBytes(path).then((b) => {
      const rows: string[] = [];
      for (let i = 0; i < Math.min(b.length, 1024); i += 16) {
        const s = b.slice(i, i + 16);
        rows.push(`${i.toString(16).padStart(8, '0')}  ${Array.from(s, (x) => x.toString(16).padStart(2, '0')).join(' ').padEnd(48)}  ${Array.from(s, (x) => (x >= 32 && x < 127 ? String.fromCharCode(x) : '.')).join('')}`);
      }
      setHex(rows.join('\n'));
    });
  }, [path, kind]);

  if (!path || !node) return <Empty icon={FileQuestion} title="Nothing to preview" />;
  if (kind === 'pdf') return url ? <iframe title="pdf" src={url} className="w-full h-full border-0 bg-white" /> : null;

  return (
    <div className="h-full flex flex-col">
      <div className="p-5 flex items-center gap-4 border-b border-line">
        <div className="flex-1"><div className="font-semibold">{node.name}</div><div className="text-[12px] text-muted">{node.mime} · {formatBytes(node.size)}</div></div>
        <Button icon={ExternalLink} onClick={() => void openPath(path, 'code')}>Open as text</Button>
        <Button icon={Download} variant="primary" onClick={() => void exportToHost(path)}>Export</Button>
      </div>
      <pre className="flex-1 overflow-auto p-4 font-mono text-[11.5px] text-muted selectable">{hex}{node.size > 1024 ? `\n… ${formatBytes(node.size - 1024)} more` : ''}</pre>
    </div>
  );
}
