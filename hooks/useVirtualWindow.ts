import { useMemo } from 'react';

export interface VirtualWindowConfig {
  itemCount: number;
  itemHeight: number;
  viewportHeight: number;
  scrollTop: number;
  overscan?: number;
}

export const useVirtualWindow = ({
  itemCount,
  itemHeight,
  viewportHeight,
  scrollTop,
  overscan = 4,
}: VirtualWindowConfig) => {
  return useMemo(() => {
    if (itemCount === 0 || viewportHeight <= 0) {
      return {
        startIndex: 0,
        endIndex: 0,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      };
    }

    const visibleCount = Math.ceil(viewportHeight / itemHeight);
    const rawStart = Math.floor(scrollTop / itemHeight);
    const startIndex = Math.max(0, rawStart - overscan);
    const endIndex = Math.min(itemCount, rawStart + visibleCount + overscan);

    const topSpacerHeight = startIndex * itemHeight;
    const bottomSpacerHeight = Math.max(0, (itemCount - endIndex) * itemHeight);

    return { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight };
  }, [itemCount, itemHeight, viewportHeight, scrollTop, overscan]);
};

export default useVirtualWindow;
