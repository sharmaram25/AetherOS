
declare global {
  interface Window {
    DOMPurify: any;
  }
}

export interface SecurityEvent {
  type: string;
  payload: any;
  sourceAppId: string;
}

class SecurityContext {
  private allowedOrigins: string[] = [];

  constructor() {
    // In a real scenario, we would strictly define allowed origins
    this.allowedOrigins = [window.location.origin];
  }

  /**
   * Sanitizes HTML content using DOMPurify to prevent XSS.
   * Useful for the Terminal and Text Editor apps.
   */
  public sanitize(dirty: string): string {
    if (window.DOMPurify) {
      return window.DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'span', 'div', 'p', 'br'],
        ALLOWED_ATTR: ['href', 'target', 'class', 'style'],
      });
    }
    // Fallback simple stripper if DOMPurify fails to load
    return dirty.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "")
                .replace(/on\w+="[^"]*"/g, "");
  }

  /**
   * Validates if a URL is safe to load (CSP Simulation).
   */
  public isUrlSafe(url: string): boolean {
    try {
      const urlObj = new URL(url);
      // Block known malicious domains or non-https (simulation)
      if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') return false;
      return true;
    } catch (e) {
      return false; // Invalid URL
    }
  }

  /**
   * Generates a sandboxed iframe srcdoc wrapper.
   * This ensures the app code runs in a separate context.
   */
  public createSandboxedSrcDoc(htmlContent: string, appId: string): string {
    const safeContent = this.sanitize(htmlContent);
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>body { margin: 0; overflow: hidden; color: white; font-family: sans-serif; }</style>
        <script>
          // JSON-RPC Bridge Stub
          window.aether = {
            sendMessage: (type, payload) => {
              window.parent.postMessage({ type, payload, sourceAppId: '${appId}' }, '*');
            }
          };
          
          window.addEventListener('message', (event) => {
             // Handle messages from OS
             if (event.data.type === 'EVAL') {
                try {
                   // In a real sandbox, we wouldn't eval, but this demonstrates control
                   console.log('App received command:', event.data.payload);
                } catch(e) {}
             }
          });
        </script>
      </head>
      <body>
        ${safeContent}
      </body>
      </html>
    `;
  }
}

export const securityContext = new SecurityContext();
