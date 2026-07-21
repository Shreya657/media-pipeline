import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LogOut, UploadCloud } from "lucide-react";
import { MediaUploadWorkbench } from "../component/mediaUpload";
import { NotificationCenter } from "../component/notification";

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    redirect("/");
  }

  const userEmail = user.emailAddresses[0]?.emailAddress;
  const username = user.username;
  const imageUrl = user.imageUrl;
 

  try {
  
   const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        userId, 
        email: userEmail, 
        username, 
        imageUrl 
      }),
    });
    const data = await response.json();
   
  } catch (error) {
    console.error("Database sync failed:", error);
  }

 
  
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
      <header className=" sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Processing Engine Control Room</h1>
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md">
            welcome: {username}
          </span>
          <Link href="/">
            <Button variant="ghost" size="sm" className="rounded-xl flex items-center gap-2">
              <LogOut className="h-4 w-4" /> Exit
            </Button>
          </Link>
           
           <NotificationCenter userId={userId} />
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-4xl">
        <MediaUploadWorkbench userId={userId} />
      </main>
    </div>
  );

}