
import React, { useState, useEffect, useRef } from 'react';
import { Send, Download, Wifi, WifiOff, File as FileIcon, Loader2 } from 'lucide-react';
import { useFileSystem } from '../../store/useFileSystem';

// --- Simple Peer Logic (Internal) ---
class WormholePeer {
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  private signaling: BroadcastChannel;
  public onStatus: (status: string) => void = () => {};
  public onData: (data: any) => void = () => {};

  constructor(code: string, isInitiator: boolean) {
    this.signaling = new BroadcastChannel(`wormhole_${code}`);
    this.pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    this.setupSignaling(isInitiator);
    this.setupPeer(isInitiator);
  }

  private setupSignaling(isInitiator: boolean) {
    this.signaling.onmessage = async (ev) => {
        const { type, data } = ev.data;
        if (type === 'offer' && !isInitiator) {
            await this.pc.setRemoteDescription(data);
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            this.signaling.postMessage({ type: 'answer', data: answer });
        } else if (type === 'answer' && isInitiator) {
            await this.pc.setRemoteDescription(data);
        } else if (type === 'candidate') {
            await this.pc.addIceCandidate(data);
        }
    };
  }

  private setupPeer(isInitiator: boolean) {
    this.pc.onicecandidate = (event) => {
        if (event.candidate) {
            this.signaling.postMessage({ type: 'candidate', data: event.candidate });
        }
    };

    this.pc.onconnectionstatechange = () => {
        this.onStatus(this.pc.connectionState);
    };

    if (isInitiator) {
        this.channel = this.pc.createDataChannel("file-transfer");
        this.setupChannel();
        this.pc.createOffer().then(offer => {
            this.pc.setLocalDescription(offer);
            this.signaling.postMessage({ type: 'offer', data: offer });
        });
    } else {
        this.pc.ondatachannel = (event) => {
            this.channel = event.channel;
            this.setupChannel();
        };
    }
  }

  private setupChannel() {
    if (!this.channel) return;
    this.channel.onopen = () => this.onStatus('connected');
    this.channel.onmessage = (ev) => this.onData(JSON.parse(ev.data));
  }

  public send(data: any) {
    this.channel?.send(JSON.stringify(data));
  }

  public close() {
    this.pc.close();
    this.signaling.close();
  }
}

// --- Component ---

export const Wormhole = () => {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
  const [logs, setLogs] = useState<string[]>(["Waiting for connection code..."]);
  const [transferProgress, setTransferProgress] = useState(0);
  const peerRef = useRef<WormholePeer | null>(null);
  
  const { files, readFile, writeFile } = useFileSystem();
  const fileList = Object.values(files).filter(f => f.type === 'FILE');

  const log = (msg: string) => setLogs(prev => [...prev, msg]);

  useEffect(() => {
    return () => peerRef.current?.close();
  }, []);

  const startSession = (isHost: boolean) => {
    if (!code) return;
    setStatus('connecting');
    log(isHost ? `Hosting session ${code}...` : `Joining session ${code}...`);

    const peer = new WormholePeer(code, isHost);
    peerRef.current = peer;

    peer.onStatus = (s) => {
        log(`Connection status: ${s}`);
        if (s === 'connected') setStatus('connected');
        if (s === 'failed' || s === 'disconnected') setStatus('failed');
    };

    peer.onData = async (payload) => {
        if (payload.type === 'file') {
            log(`Receiving file: ${payload.name} (${payload.content.length} bytes)`);
            await writeFile(`/home/user/downloads/${payload.name}`, payload.content);
            log(`File saved to /home/user/downloads/${payload.name}`);
        }
    };
  };

  const sendFile = async (path: string) => {
    if (!peerRef.current || status !== 'connected') return;
    try {
        log(`Reading ${path}...`);
        const content = await readFile(path);
        const name = path.split('/').pop();
        log(`Sending ${name}...`);
        peerRef.current.send({ type: 'file', name, content });
        log(`Sent!`);
    } catch (e) {
        log("Error reading file");
    }
  };

  return (
    <div className="h-full bg-slate-900 text-white flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
         <h2 className="text-xl font-bold flex items-center gap-2">
            <Wifi className={status === 'connected' ? "text-green-400" : "text-gray-500"} />
            Wormhole P2P
         </h2>
         <span className={`text-xs px-2 py-1 rounded-full ${status === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-white/10'}`}>
            {status.toUpperCase()}
         </span>
      </div>

      {status === 'idle' && (
         <div className="flex flex-col gap-4 max-w-sm mx-auto w-full mt-10">
            <input 
               type="text" 
               placeholder="Enter 6-digit Code" 
               className="bg-white/5 border border-white/10 p-3 rounded text-center text-2xl tracking-widest focus:outline-none focus:border-indigo-500"
               value={code}
               onChange={e => setCode(e.target.value)}
               maxLength={6}
            />
            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={() => startSession(true)} 
                    className="bg-indigo-600 hover:bg-indigo-500 py-3 rounded font-medium transition-colors"
                >
                    Create
                </button>
                <button 
                    onClick={() => startSession(false)} 
                    className="bg-gray-700 hover:bg-gray-600 py-3 rounded font-medium transition-colors"
                >
                    Join
                </button>
            </div>
            <p className="text-xs text-center text-white/30 mt-4">
                Tip: Open a second tab, enter the same code, and click 'Join' to test locally.
            </p>
         </div>
      )}

      {status === 'connected' && (
        <div className="flex-1 flex flex-col gap-4">
            <div className="flex-1 bg-black/20 rounded-lg p-4 border border-white/5 overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Your Files</h3>
                <div className="grid grid-cols-1 gap-2">
                    {fileList.map(f => (
                        <button 
                            key={f.path} 
                            onClick={() => sendFile(f.path)}
                            className="flex items-center gap-3 p-3 rounded bg-white/5 hover:bg-white/10 transition-colors text-left group"
                        >
                            <FileIcon size={16} className="text-indigo-400" />
                            <span className="flex-1 truncate text-sm">{f.name}</span>
                            <Send size={14} className="opacity-0 group-hover:opacity-100 text-indigo-400" />
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="h-32 bg-black text-xs font-mono p-2 overflow-y-auto text-green-500 rounded border border-white/10">
                {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
        </div>
      )}

      {status === 'connecting' && (
          <div className="flex-1 flex items-center justify-center flex-col gap-4">
              <Loader2 className="animate-spin text-indigo-500" size={48} />
              <div className="text-white/50">Establishing secure channel...</div>
              <div className="h-32 w-full bg-black text-xs font-mono p-2 overflow-y-auto text-green-500 rounded border border-white/10 mt-8">
                {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
      )}
    </div>
  );
};

export default Wormhole;
