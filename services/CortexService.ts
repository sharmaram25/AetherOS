
import { CreateMLCEngine, MLCEngine, InitProgressCallback } from '@mlc-ai/web-llm';
import { useFileSystem } from '../store/useFileSystem';
import { useWindowManager } from '../store/useWindowManager';

// We use a small quantized model for browser compatibility
const MODEL_ID = 'Llama-3-8B-Instruct-q4f32_1-MLC'; 

class CortexService {
  private engine: MLCEngine | null = null;
  private isInitialized = false;
  private listeners: ((msg: string) => void)[] = [];

  // Function calling definition for the OS
  private tools = [
    {
      type: "function",
      function: {
        name: "open_app",
        description: "Open an application in the OS",
        parameters: {
          type: "object",
          properties: {
            appId: {
              type: "string",
              enum: ["aether-text", "system-monitor", "terminal", "wormhole", "image-filter", "files", "chronos", "abacus", "lens", "cortex", "epoch", "settings", "scribe", "grid"],
              description: "The ID of the app to launch"
            }
          },
          required: ["appId"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_file",
        description: "Create a new file in the virtual file system",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "The full path (e.g., /home/user/poem.txt)" },
            content: { type: "string", description: "The content of the file" }
          },
          required: ["path", "content"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "list_files",
        description: "List files from a directory in the virtual file system",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory path (e.g., /home/user/documents)" },
            limit: { type: "number", description: "Maximum number of entries" }
          },
          required: ["path"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_file",
        description: "Read text content from a file",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "The full file path" }
          },
          required: ["path"]
        }
      }
    }
  ];

  public async init(onProgress: InitProgressCallback) {
    if (this.isInitialized) return;

    try {
      // Check for WebGPU
      if (!(navigator as any).gpu) {
        throw new Error("WebGPU not supported");
      }

      this.engine = await CreateMLCEngine(MODEL_ID, { 
        initProgressCallback: onProgress 
      });
      this.isInitialized = true;
    } catch (e) {
      console.error("Cortex failed to load:", e);
      throw e;
    }
  }

  public async chat(message: string, context: { fs: any, wm: any }): Promise<string> {
    // Mock Fallback if WebGPU fails or engine not loaded
    if (!this.engine) {
      return await this.mockResponse(message, context);
    }

    try {
      const response = await this.engine.chat.completions.create({
        messages: [{ role: "user", content: message }],
        tools: this.tools as any, 
      });

      const choice = response.choices[0];
      
      // Handle Function Calling
      if (choice.message.tool_calls) {
        const toolResults: string[] = [];

        for (const call of choice.message.tool_calls) {
          const args = JSON.parse(call.function.arguments);
          try {
            if (call.function.name === 'open_app') {
              context.wm.openWindow(args.appId, args.appId.toUpperCase());
              toolResults.push(`Opening ${args.appId}...`);
            }
            if (call.function.name === 'create_file') {
              await context.fs.writeFile(args.path, args.content);
              toolResults.push(`Created file at ${args.path}`);
            }
            if (call.function.name === 'list_files') {
              const entries = context.fs.readdir(args.path).slice(0, args.limit || 20);
              if (entries.length === 0) toolResults.push(`No files in ${args.path}`);
              else toolResults.push(`Files in ${args.path}: ${entries.map((entry: any) => entry.name).join(', ')}`);
            }
            if (call.function.name === 'read_file') {
              const content = await context.fs.readFile(args.path);
              toolResults.push(`Read ${args.path}: ${content.slice(0, 280)}`);
            }
          } catch (e) {
            toolResults.push(`Tool ${call.function.name} failed.`);
          }
        }

        if (toolResults.length > 0) return toolResults.join('\n');
      }

      return choice.message.content || "I didn't understand that.";

    } catch (e) {
      return "Error communicating with Cortex Core.";
    }
  }

  // Fallback Logic for demonstration purposes without downloading 4GB model
  private async mockResponse(message: string, context: { fs: any, wm: any }): Promise<string> {
    const lower = message.toLowerCase();
    
    // Simulate thinking delay
    await new Promise(r => setTimeout(r, 1000));

    if (lower.includes('open') && lower.includes('text')) {
      context.wm.openWindow('aether-text', 'Aether Text');
      return "I've opened the text editor for you.";
    }

    if (lower.includes('open') && (lower.includes('files') || lower.includes('file manager'))) {
      context.wm.openWindow('files', 'Aether Files');
      return "Opening Aether Files.";
    }
    
    if (lower.includes('monitor') || lower.includes('system')) {
        context.wm.openWindow('system-monitor', 'System Monitor');
        return "Launching System Monitor.";
    }

    if (lower.includes('write') && lower.includes('poem')) {
        const poem = "In wires deep where data flows,\nA digital wind softly blows.\nAether shines in pixel light,\nA guide through the electric night.";
        await context.fs.writeFile('/home/user/documents/cortex_poem.txt', poem);
        context.wm.openWindow('files', 'Aether Files');
        return "I wrote a poem and saved it to /home/user/documents/cortex_poem.txt. You can open it from Aether Files.";
    }

    if (lower.includes('list') && lower.includes('documents')) {
      const entries = context.fs.readdir('/home/user/documents');
      if (!entries.length) return "Your documents folder is empty.";
      return `Documents: ${entries.map((entry: any) => entry.name).join(', ')}`;
    }

    return "Cortex (Safe Mode): I can help you open apps or write files. Try 'Open text editor' or 'Write a poem'. (WebGPU Model not loaded)";
  }
}

export const cortexService = new CortexService();
