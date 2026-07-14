'use client';

import { useEffect } from 'react';
import { useSocket } from '../context/socketContext';
import { toast } from 'sonner';

interface PipelineEventData {
  type: 'PROCESSING_COMPLETE' | 'PROCESSING_FAILED';
  fileName: string;
  status: 'COMPLETED' | 'FAILED';
  dbRecordId: string;
  timestamp: string;
}

export const usePipelineNotifications = () => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    const playNotificationChime = () => {
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-500.wav');
        audio.volume = 0.4;
        audio.play();
      } catch (err) {
        console.warn('Audio playback delayed or blocked by browser permissions:', err);
      }
    };

    const flashBrowserTabTitle = (message: string) => {
      if (document.hidden) {
        const originalTitle = document.title;
        let isFlashing = true;

        const flashInterval = setInterval(() => {
          document.title = isFlashing ? `🔔 ${message}` : originalTitle;
          isFlashing = !isFlashing;
        }, 1000);

        const cleanFocusHook = () => {
          clearInterval(flashInterval);
          document.title = originalTitle;
          window.removeEventListener('focus', cleanFocusHook);
        };
        window.addEventListener('focus', cleanFocusHook);
      }
    };

    socket.on('pipeline-event', (data: PipelineEventData) => {
      console.log('Pipeline event packet received in client thread:', data);
      
      const isSuccess = data.status === 'COMPLETED';
      const alertTitle = isSuccess ? 'Transcoding Success!' : 'Processing Anomaly!';
      const alertBody = isSuccess 
        ? `Asset "${data.fileName}" optimized successfully into target variations.` 
        : `Execution stalled for "${data.fileName}". Review system tracking traces.`;

      playNotificationChime();

      if (document.hidden && Notification.permission === 'granted') {
        new Notification(alertTitle, {
          body: alertBody,
          tag: data.dbRecordId, // Prevents duplicate stacks for the same exact asset
        });
        flashBrowserTabTitle(isSuccess ? 'Success!' : 'Error!');
      }

      toast[isSuccess ? 'success' : 'error'](alertTitle, {
        description: alertBody,
        duration: 6000,
        position: 'top-right',
      });
    });

    return () => {
      socket.off('pipeline-event');
    };
  }, [socket]);
};