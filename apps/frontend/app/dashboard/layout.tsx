import React from 'react';

import { Toaster } from 'sonner';
import { SocketProvider } from '../context/socketContext';
import { NotificationRegistryWatcher } from './watcher';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUserId = "user_3FmKTy98aHZT2lTto3jAMux43uB"; 

  return (
    <SocketProvider userId={currentUserId}>
      <Toaster richColors />
      <NotificationRegistryWatcher />
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 ">
    
          {children}
    
      
      </main>
    </SocketProvider>
  );
}