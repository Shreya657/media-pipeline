import React from 'react';
import { Toaster } from 'sonner';
import { SocketProvider } from '../context/socketContext';
import { NotificationRegistryWatcher } from './watcher';
import { auth } from '@clerk/nextjs/server';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  // const currentUserId = "user_3FmKTy98aHZT2lTto3jAMux43uB"; 
  const { userId } = await auth();

  const activeUserId = userId || "guest_user";

  return (
    <SocketProvider userId={activeUserId}>
      <Toaster richColors />
      <NotificationRegistryWatcher />
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 ">
    
          {children}
    
      
      </main>
    </SocketProvider>
  );
}