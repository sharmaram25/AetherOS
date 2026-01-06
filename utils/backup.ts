
import JSZip from 'jszip';
import { useFileSystem } from '../store/useFileSystem';
import { FileType } from '../types';

export const createBackup = async () => {
  const zip = new JSZip();
  const fs = useFileSystem.getState().files;
  
  // Filter for files in /home
  const userFiles = Object.values(fs).filter(f => 
    f.path.startsWith('/home') && f.type === FileType.FILE && f.content
  );

  userFiles.forEach(file => {
    // Remove leading / for zip structure
    const relativePath = file.path.substring(1); 
    zip.file(relativePath, file.content || '');
  });

  const content = await zip.generateAsync({ type: 'blob' });
  
  // Trigger Download
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aether-backup-${new Date().toISOString().split('T')[0]}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
