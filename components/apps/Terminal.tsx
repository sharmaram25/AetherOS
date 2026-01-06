
import React, { useState, useRef, useEffect } from 'react';
import { useFileSystem } from '../../store/useFileSystem';
import { useWindowManager } from '../../store/useWindowManager';

const INITIAL_WELCOME = [
  "AetherOS Terminal [Version 1.0.2]",
  "(c) Aether Corp. All rights reserved.",
  "",
  "Type 'help' for available commands.",
  ""
];

export const Terminal = () => {
  const { files, readdir, readFile, writeFile, mkdir, deleteFile } = useFileSystem();
  const windowManager = useWindowManager();
  
  const [history, setHistory] = useState<string[]>(INITIAL_WELCOME);
  const [cwd, setCwd] = useState('/home/user');
  const [input, setInput] = useState('');
  const [isReplMode, setIsReplMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Focus input on click
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const resolvePath = (path: string): string => {
    if (path === '/') return '/';
    if (path.startsWith('/')) return path; // Absolute
    
    // Relative
    const parts = cwd.split('/').filter(Boolean);
    const segments = path.split('/').filter(Boolean);
    
    for (const segment of segments) {
      if (segment === '.') continue;
      if (segment === '..') {
        parts.pop();
      } else {
        parts.push(segment);
      }
    }
    
    const resolved = '/' + parts.join('/');
    return resolved === '//' ? '/' : resolved;
  };

  const handleCommand = async (cmd: string) => {
    if (!cmd.trim()) {
      setHistory(prev => [...prev, `${isReplMode ? '>>' : cwd + ' $'} `]);
      return;
    }

    const newHistory = [...history, `${isReplMode ? '>>' : cwd + ' $'} ${cmd}`];

    if (isReplMode) {
      if (cmd === 'exit') {
        setIsReplMode(false);
        setHistory([...newHistory, "Exited REPL mode."]);
      } else {
        try {
          // Dangerous: Eval in context
          // Expose APIs to the REPL
          (window as any).os = {
            fs: { files, readFile, writeFile },
            wm: windowManager
          };
          const result = eval(cmd);
          setHistory([...newHistory, `<- ${String(result)}`]);
        } catch (e: any) {
          setHistory([...newHistory, `Error: ${e.message}`]);
        }
      }
    } else {
      // Shell Mode
      const args = cmd.split(' ');
      const command = args[0];
      const arg1 = args[1];
      const arg2 = args[2];

      try {
        switch (command) {
          case 'help':
            setHistory([...newHistory, 
              "Available commands:",
              "  ls           List directory contents",
              "  cd [dir]     Change directory",
              "  mkdir [dir]  Create directory",
              "  touch [file] Create empty file",
              "  rm [file]    Remove file",
              "  echo [text]  Print text (supports > file.txt)",
              "  clear        Clear screen",
              "  js           Enter JavaScript REPL mode"
            ]);
            break;

          case 'clear':
            setHistory([]);
            return; // Skip default setHistory

          case 'ls': {
            const targetPath = arg1 ? resolvePath(arg1) : cwd;
            const contents = readdir(targetPath);
            if (contents.length === 0) {
               setHistory([...newHistory]);
            } else {
               const output = contents.map(f => {
                   return f.type === 'DIRECTORY' ? `<DIR> ${f.name}` : `      ${f.name}`;
               });
               setHistory([...newHistory, ...output]);
            }
            break;
          }

          case 'cd': {
            const target = arg1 ? resolvePath(arg1) : '/home/user';
            // Simple check if exists and is dir (naive)
            if (files[target] && files[target].type === 'DIRECTORY') {
                setCwd(target);
                setHistory(newHistory);
            } else if (target === '/') {
                setCwd('/');
                setHistory(newHistory);
            } else {
                setHistory([...newHistory, `bash: cd: ${arg1}: No such directory`]);
            }
            break;
          }

          case 'mkdir':
            if (!arg1) throw new Error("missing operand");
            await mkdir(resolvePath(arg1));
            setHistory(newHistory);
            break;
          
          case 'touch':
            if (!arg1) throw new Error("missing operand");
            await writeFile(resolvePath(arg1), "");
            setHistory(newHistory);
            break;

          case 'rm':
             if (!arg1) throw new Error("missing operand");
             await deleteFile(resolvePath(arg1));
             setHistory(newHistory);
             break;

          case 'echo': {
            // Handle redirection: echo "hello" > file.txt
            const redirIndex = args.indexOf('>');
            if (redirIndex !== -1) {
                const text = args.slice(1, redirIndex).join(' ').replace(/^"|"$/g, '');
                const filePath = args[redirIndex + 1];
                if (!filePath) throw new Error("Syntax error");
                await writeFile(resolvePath(filePath), text);
                setHistory(newHistory);
            } else {
                const text = args.slice(1).join(' ').replace(/^"|"$/g, '');
                setHistory([...newHistory, text]);
            }
            break;
          }

          case 'js':
            setIsReplMode(true);
            setHistory([...newHistory, "Entering JS REPL Mode. Global 'os' object available. Type 'exit' to quit."]);
            break;

          default:
            setHistory([...newHistory, `bash: ${command}: command not found`]);
        }
      } catch (e: any) {
        setHistory([...newHistory, `Error: ${e.message}`]);
      }
    }
    
    setInput('');
  };

  return (
    <div 
      className="h-full bg-black/90 text-green-400 font-mono text-sm p-4 overflow-y-auto flex flex-col"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex-1">
        {history.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap mb-1 break-all">{line}</div>
        ))}
      </div>
      <div className="flex mt-2">
        <span className="mr-2 text-blue-400">{isReplMode ? '>>' : `${cwd} $`}</span>
        <input 
          ref={inputRef}
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleCommand(input);
          }}
          className="flex-1 bg-transparent focus:outline-none text-gray-100"
          autoComplete="off"
        />
      </div>
      <div ref={bottomRef} />
    </div>
  );
};

export default Terminal;
