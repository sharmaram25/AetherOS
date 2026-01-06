
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
              enum: ["aether-text", "system-monitor", "terminal", "wormhole", "image-filter"],
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
        for (const call of choice.message.tool_calls) {
          const args = JSON.parse(call.function.arguments);
          if (call.function.name === 'open_app') {
            context.wm.openWindow(args.appId, args.appId.toUpperCase());
            return `Opening ${args.appId}...`;
          }
          if (call.function.name === 'create_file') {
            await context.fs.writeFile(args.path, args.content);
            return `Created file at ${args.path}`;
          }
        }
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
    
    if (lower.includes('monitor') || lower.includes('system')) {
        context.wm.openWindow('system-monitor', 'System Monitor');
        return "Launching System Monitor.";
    }

    if (lower.includes('write') && lower.includes('poem')) {
        const poem = "In wires deep where data flows,\nA digital wind softly blows.\nAether shines in pixel light,\nA guide through the electric night.";
        await context.fs.writeFile('/home/user/documents/cortex_poem.txt', poem);
        context.wm.openWindow('aether-text', 'Aether Text');
        return "I wrote a poem and saved it to /home/user/documents/cortex_poem.txt";
    }

    return "Cortex (Safe Mode): I can help you open apps or write files. Try 'Open text editor' or 'Write a poem'. (WebGPU Model not loaded)";
  }
}

export const cortexService = new CortexService();
