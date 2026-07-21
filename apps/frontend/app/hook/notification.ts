'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../context/socketContext';
import { toast } from 'sonner';

export interface PipelineEventData {
  type: 'PROCESSING_COMPLETE' | 'PROCESSING_FAILED';
  fileName: string;
  status: 'COMPLETED' | 'FAILED';
  dbRecordId: string;
  timestamp: string;
  notificationId?: string; 
}

export const usePipelineNotifications = () => {
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<PipelineEventData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleNotificationAction = useCallback(async (event: PipelineEventData) => {
    const targetId = event.notificationId || event.dbRecordId;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/${targetId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error syncing read state with database:', err);
    }

    const elementId = `asset-${event.dbRecordId}`;
    const targetCard = document.getElementById(elementId);
    
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      targetCard.classList.add('ring-4', 'ring-indigo-500', 'animate-pulse');
      setTimeout(() => {
        targetCard.classList.remove('ring-4', 'ring-indigo-500', 'animate-pulse');
      }, 3000);
    } else {
      toast.info('Item is loaded! Refresh the dashboard if it does not show below.');
    }
  }, []);

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
        console.warn('Audio playback delayed:', err);
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
      console.log('Pipeline event packet received:', data);
      
      const isSuccess = data.status === 'COMPLETED';
      const alertTitle = isSuccess ? 'Transcoding Success!' : 'Processing Anomaly!';
      const alertBody = isSuccess 
        ? `Asset "${data.fileName}" optimized successfully.` 
        : `Execution stalled for "${data.fileName}".`;

      playNotificationChime();

      setNotifications(prev => [data, ...prev]);
      setUnreadCount(prev => prev + 1);

      if (document.hidden && Notification.permission === 'granted') {
        const desktopNotification = new Notification(alertTitle, {
          body: alertBody,
          tag: data.dbRecordId,
        });

        desktopNotification.onclick = () => {
          window.focus();
          handleNotificationAction(data);
        };

        flashBrowserTabTitle(isSuccess ? 'Success!' : 'Error!');
      }
 //pop-up
      toast[isSuccess ? 'success' : 'error'](alertTitle, {
        description: alertBody,
        duration: 8000,
        position: 'top-right',
        action: {
          label: 'View Job',
          onClick: () => handleNotificationAction(data)
        }
      });
    });

    return () => {
      socket.off('pipeline-event');
    };
  }, [socket, handleNotificationAction]);

  return {
    notifications,
    unreadCount,
    setUnreadCount,
    handleNotificationAction
  };
};