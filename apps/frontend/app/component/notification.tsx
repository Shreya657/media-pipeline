'use client';

import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCheck, Trash2, Clock, CheckCircle2, AlertTriangle, Layers, Film, Image as ImageIcon } from 'lucide-react';
// import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface NotificationItem {
  notificationId: string;
  dbRecordId: string;
  message: string;
  isRead: boolean;
  timestamp: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  mediaType: 'IMAGE' | 'VIDEO';
}

interface NotificationCenterProps {
  userId: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/notifications/user/${userId}`);
      const data = await res.json();
      // console.log("data: ",data);
      if (data.success && data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.notifications.filter((n: NotificationItem) => !n.isRead).length);
      }
    } catch (err) {
      console.error('Failed to sync notification history ledger:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [userId]);

  useEffect(() => {
    const handleLiveRefresh = () => {
      fetchNotifications();
    };
    window.addEventListener('refresh-notifications', handleLiveRefresh);
    return () => window.removeEventListener('refresh-notifications', handleLiveRefresh);
  }, []);

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      setNotifications(prev =>
        prev.map(n => n.notificationId === item.notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/${item.notificationId}/read`, {
          method: 'PATCH',
        });
      } catch (err) {
        console.error('Database unread toggle failed:', err);
      }
    }

    const focusEvent = new CustomEvent('focus-pipeline-asset', {
      detail: { dbRecordId: item.dbRecordId, status: item.status }
    });
    window.dispatchEvent(focusEvent);
    
    setIsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/user/${userId}/read-all`, {
        method: 'PATCH',
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All updates marked as read.');
    } catch (err) {
      console.error('Failed processing continuous batch state clear:', err);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation(); 
    
    const targetItem = notifications.find(n => n.notificationId === notificationId);
    
    setNotifications(prev => prev.filter(n => n.notificationId !== notificationId));
    if (targetItem && !targetItem.isRead) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Database record drop execution abort failure:', err);
      fetchNotifications(); 
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-950">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Activity Registry</h2>
            {unreadCount > 0 && (
              <span className="text-[10px] bg-indigo-500/10 text-indigo-500 font-bold px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="p-1.5 text-zinc-400 hover:text-indigo-500 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                title="Mark all as read"
              >
                <CheckCheck className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {isLoading && notifications.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-zinc-400 font-mono">
              Synchronizing ledger tracks...
            </div>
          ) : notifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
              <Bell className="h-8 w-8 text-zinc-300 dark:text-zinc-700 stroke-[1.5]" />
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Workspace Inbox Clean</p>
              <p className="text-[11px] text-zinc-400 max-w-[200px]">
                Completed media pipeline variant alerts will manifest inside this tray interface thread.
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const isSuccess = item.status === 'COMPLETED';
              return (
                <div
                  key={item.notificationId}
                  onClick={() => handleItemClick(item)}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition relative group ${
                    !item.isRead
                      ? 'bg-zinc-50/80 dark:bg-indigo-950/5 border-zinc-200 dark:border-indigo-900/30 shadow-sm'
                      : 'bg-white dark:bg-zinc-900/40 border-zinc-100 dark:border-zinc-800/60 hover:border-zinc-200 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 border ${
                    isSuccess 
                      ? 'bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-500 border-emerald-500/10' 
                      : 'bg-rose-500/5 dark:bg-rose-500/10 text-rose-500 border-rose-500/10'
                  }`}>
                    {item.mediaType === 'VIDEO' ? <Film className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                  </div>

                  <div className="flex-1 min-w-0 pr-6 space-y-1">
                    <p className={`text-xs truncate transition-colors group-hover:text-indigo-500 ${
                      !item.isRead ? 'font-bold text-zinc-800 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'
                    }`}>
                      {item.message}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-medium">
                      <span className="flex items-center gap-1">
                        {isSuccess ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-rose-500" />
                        )}
                        <span className="capitalize">{item.status.toLowerCase()}</span>
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[9px]">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {!item.isRead && (
                      <span className="h-2 w-2 rounded-full bg-indigo-500 group-hover:scale-0 transition-transform duration-200 shrink-0" />
                    )}
                    <button
                      onClick={(e) => handleDeleteNotification(e, item.notificationId)}
                      className="p-1.5 rounded-md text-zinc-400 hover:text-rose-500 hover:bg-rose-500/5 dark:hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0"
                      title="Delete log"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};