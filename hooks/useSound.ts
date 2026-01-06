
import { useCallback } from 'react';

const SFX = {
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // Crisp tick
  open: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3', // Swoosh
  error: 'https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3', // Thud
};

export const useSound = () => {
  const play = useCallback((type: keyof typeof SFX) => {
    try {
      const audio = new Audio(SFX[type]);
      audio.volume = 0.2; // Keep it subtle
      audio.play().catch(() => {}); // Ignore interaction errors
    } catch (e) {
      // Silent fail
    }
  }, []);

  return { play };
};
