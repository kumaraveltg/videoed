// hooks/useVirtualFrames.js - Virtual frame loading hook
import { useState, useEffect, useRef } from 'react';

/**
 * Virtual Frame Loading Hook
 * 
 * Loads video frames on-demand based on viewport visibility.
 * Dramatically improves performance for long videos by only loading
 * frames that are currently visible or nearby.
 * 
 * @param {string} serverFilename - The video filename on the server
 * @param {number} videoDuration - Total video duration in seconds
 * @returns {Object} Frame cache management object
 */
export const useVirtualFrames = (serverFilename, videoDuration) => {
  const [frameCache, setFrameCache] = useState(new Map());
  const [loadingFrames, setLoadingFrames] = useState(new Set());
  const abortControllersRef = useRef(new Map());
  const loadedRangesRef = useRef(new Set()); // Track which ranges we've loaded

  /**
   * Load frames for a specific time range
   * @param {number} startTime - Start time in seconds
   * @param {number} endTime - End time in seconds
   */
  const loadFramesInRange = async (startTime, endTime) => {
    if (!serverFilename || videoDuration === 0) {
      console.log('[useVirtualFrames] No video loaded yet');
      return;
    }

    const startFrame = Math.floor(startTime);
    const endFrame = Math.ceil(endTime);
    
    console.log(`[useVirtualFrames] Loading range: ${startFrame}s - ${endFrame}s`);
    
    // Determine which frames need loading
    const framesToLoad = [];
    for (let i = startFrame; i <= endFrame; i++) {
      if (i >= 0 && i < videoDuration && !frameCache.has(i) && !loadingFrames.has(i)) {
        framesToLoad.push(i);
      }
    }

    if (framesToLoad.length === 0) {
      console.log('[useVirtualFrames] All frames in range already loaded/loading');
      return;
    }

    console.log(`[useVirtualFrames] Loading ${framesToLoad.length} new frames:`, framesToLoad);

    // Mark frames as loading
    setLoadingFrames(prev => {
      const next = new Set(prev);
      framesToLoad.forEach(f => next.add(f));
      return next;
    });

    // Load frames in parallel with AbortController for cancellation
    const promises = framesToLoad.map(async (frameIndex) => {
      const controller = new AbortController();
      abortControllersRef.current.set(frameIndex, controller);

      try {
        console.log(`[useVirtualFrames] Fetching frame ${frameIndex}...`);
        
        const response = await fetch(
          `http://localhost:8000/video/frame/${serverFilename}/${frameIndex}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Frame ${frameIndex} fetch failed: ${response.status}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        console.log(`[useVirtualFrames] ✅ Frame ${frameIndex} loaded`);

        setFrameCache(prev => {
          const next = new Map(prev);
          next.set(frameIndex, url);
          return next;
        });
        
        setLoadingFrames(prev => {
          const next = new Set(prev);
          next.delete(frameIndex);
          return next;
        });
        
        abortControllersRef.current.delete(frameIndex);
        
        return { frameIndex, url };
        
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error(`[useVirtualFrames] Failed to load frame ${frameIndex}:`, err);
        } else {
          console.log(`[useVirtualFrames] Frame ${frameIndex} load cancelled`);
        }
        
        setLoadingFrames(prev => {
          const next = new Set(prev);
          next.delete(frameIndex);
          return next;
        });
        
        return null;
      }
    });

    await Promise.allSettled(promises);
    
    console.log(`[useVirtualFrames] Batch load complete. Cache size: ${frameCache.size + framesToLoad.length}`);
  };

  /**
   * Cleanup frames outside viewport to save memory
   * @param {number} startTime - Current viewport start
   * @param {number} endTime - Current viewport end
   * @param {number} buffer - Additional buffer in seconds (default: 60)
   */
  const cleanupFrames = (startTime, endTime, buffer = 60) => {
    const startFrame = Math.floor(startTime) - buffer;
    const endFrame = Math.ceil(endTime) + buffer;

    let removedCount = 0;

    setFrameCache(prev => {
      const next = new Map();
      
      for (const [frameIndex, url] of prev.entries()) {
        if (frameIndex >= startFrame && frameIndex <= endFrame) {
          // Keep frame
          next.set(frameIndex, url);
        } else {
          // Remove frame and revoke blob URL
          URL.revokeObjectURL(url);
          removedCount++;
        }
      }
      
      return next;
    });

    if (removedCount > 0) {
      console.log(`[useVirtualFrames] Cleaned up ${removedCount} frames outside buffer`);
    }
  };

  /**
   * Cancel all pending frame loads
   */
  const cancelAllLoads = () => {
    console.log(`[useVirtualFrames] Cancelling ${abortControllersRef.current.size} pending loads`);
    
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current.clear();
    setLoadingFrames(new Set());
  };

  /**
   * Clear all cached frames and free memory
   */
  const clearCache = () => {
    console.log(`[useVirtualFrames] Clearing cache of ${frameCache.size} frames`);
    
    frameCache.forEach(url => URL.revokeObjectURL(url));
    setFrameCache(new Map());
    setLoadingFrames(new Set());
    loadedRangesRef.current.clear();
  };

  /**
   * Get cache statistics
   */
  const getCacheStats = () => {
    return {
      cachedFrames: frameCache.size,
      loadingFrames: loadingFrames.size,
      totalFrames: Math.ceil(videoDuration),
      cachePercentage: videoDuration > 0 
        ? ((frameCache.size / Math.ceil(videoDuration)) * 100).toFixed(1)
        : 0
    };
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[useVirtualFrames] Unmounting - cleaning up resources');
      cancelAllLoads();
      frameCache.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  return {
    frameCache,
    loadingFrames,
    loadFramesInRange,
    cleanupFrames,
    cancelAllLoads,
    clearCache,
    getCacheStats
  };
};

export default useVirtualFrames;
