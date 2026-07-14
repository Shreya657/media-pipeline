"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser, UserButton, SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Layers, LayoutDashboard } from "lucide-react";

export default function Navbar() {
  const { isSignedIn, isLoaded } = useUser();
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md transition-colors duration-300">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-2xl font-black tracking-tight text-zinc-900 dark:text-white group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Layers className="h-5 w-5" />
          </div>
          <span>
            media<span className="text-blue-600 dark:text-blue-500 font-light">Forge</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </Button>

          {!isLoaded ? (
            <div className="h-9 w-24 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          ) : !isSignedIn ? (
            <div className="flex items-center gap-2">
              <SignInButton mode="modal">
                <Button variant="ghost" className="rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 font-medium">
                  Sign In
                </Button>
              </SignInButton>
              <SignInButton mode="modal">
                <Button className="rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-medium shadow-sm shadow-blue-500/10">
                  Get Started
                </Button>
              </SignInButton>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="outline" className="rounded-xl border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 font-medium flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <UserButton 
                appearance={{ 
                  elements: { 
                    avatarBox: "h-9 w-9 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-full" 
                  } 
                }} 
              />
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}