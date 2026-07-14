import Link from "next/link";
import { Button } from "@/components/ui/button";
import Navbar from "./component/navbar"; 
import { Video, Image as ImageIcon, Zap, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-300 antialiased">
      <Navbar />

      <main className="container mx-auto px-4 max-w-5xl">
        
        <section className="flex flex-col items-center justify-center text-center pt-20 pb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 shadow-sm mb-8">
            <Zap className="h-3 w-3 text-blue-600 fill-blue-600" /> High-Performance Background Engine
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight max-w-3xl mb-6 leading-tight text-zinc-900 dark:text-white">
            Transcode and optimize media <br />
            <span className="bg-blue-500 bg-clip-text text-transparent">
              without blocking your app.
            </span>
          </h1>
          
          <p className="text-md sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-xl mb-10 leading-relaxed">
            Drop heavy videos and raw images. Our isolated worker pipelines process jobs concurrently in the background while you grab a coffee.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto h-11 px-6 rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-medium flex items-center justify-center gap-2 shadow-md shadow-blue-500/10">
                Launch Engine <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-11 px-6 rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
              Read Architecture Blueprint
            </Button>
          </div>
        </section>

        <section className="py-8">
          <div className="grid sm:grid-cols-2 gap-6">
            
            <div className="flex flex-col items-start border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6 rounded-2xl shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
              <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                <ImageIcon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Sharp Image Pipelines</h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                Convert raw assets into modern WebP/AVIF images. Automatically scale targets, compress with minimal quality loss, or layer custom watermarks in isolated threads.
              </p>
            </div>

            <div className="flex flex-col items-start border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6 rounded-2xl shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
              <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                <Video className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">FFmpeg Video Transcoding</h3>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                Offload CPU-heavy multimedia jobs smoothly. Generate 1080p/720p renditions, extract keyframe preview thumbnails, or clip intervals without freezing your main web thread.
              </p>
            </div>

          </div>
        </section>

      </main>

      <footer className="mt-16 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-center py-6 text-xs text-zinc-400 dark:text-zinc-500 transition-colors">
        System Core: BullMQ Workers • Redis Execution Layer • Neon Serverless Storage Gateway
      </footer>
    </div>
  );
}