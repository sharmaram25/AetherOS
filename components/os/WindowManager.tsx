
import React, { Suspense } from 'react';
import { useWindowManager } from '../../store/useWindowManager';
import { WindowFrame } from './WindowFrame';
import { APP_REGISTRY } from '../../utils/appRegistry';

export const WindowManager = () => {
  const { windows } = useWindowManager();

  return (
    <div className="absolute inset-0 pointer-events-none">
      {Object.values(windows).map((win) => {
        const AppConfig = APP_REGISTRY[win.appId];
        
        if (!AppConfig) return null;
        
        const AppComponent = AppConfig.component;

        return (
          // Enable pointer events for windows, as container is none
          <div key={win.id} className="pointer-events-auto">
            <WindowFrame windowState={win}>
               <Suspense fallback={<div className="flex items-center justify-center h-full text-white/50">Loading process...</div>}>
                   {/* Error Boundary could wrap here */}
                   <AppComponent 
                        windowId={win.id} 
                        isFocused={false} // Managed by WM focusWindow logic in Frame
                        initialData={win.data}
                   />
               </Suspense>
            </WindowFrame>
          </div>
        );
      })}
    </div>
  );
};
