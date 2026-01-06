
import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export const useTheme = () => {
  const { scale, reducedMotion, ecoMode, blurStrength, accentColor } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // Scaling
    root.style.fontSize = `${16 * scale}px`;
    
    // Appearance Variables
    root.style.setProperty('--glass-blur', `${blurStrength}px`);
    root.style.setProperty('--primary-accent', accentColor);

    // Reduced Motion
    if (reducedMotion) {
      body.classList.add('reduce-motion');
    } else {
      body.classList.remove('reduce-motion');
    }

    // Eco Mode
    if (ecoMode) {
      body.classList.add('eco-mode');
    } else {
      body.classList.remove('eco-mode');
    }

  }, [scale, reducedMotion, ecoMode, blurStrength, accentColor]);
};
