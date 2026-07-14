'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileVideo, FileImage, Loader2, CheckCircle2, AlertTriangle, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProcessingOptions } from './processingOptions';
import { uploadMedia, getJobStatus, cancelJob, getUserMediaLibrary } from '../api/lib/api';

interface WorkbenchProps {
  userId: string;
}

interface ActiveJob {
  id: string;
  fileName: string;
  mediaType: 'IMAGE' | 'VIDEO';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  outputs: Record<string, string> | null;
}

export const MediaUploadWorkbench: React.FC<WorkbenchProps> = ({ userId }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [fileType, setFileType] = useState<'IMAGE' | 'VIDEO' | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'COMPLETED' | 'ARCHIVED'>('ACTIVE');
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [options, setOptions] = useState({
    format: 'webp',
    width: '',
    height: '',
    generateThumbnail: true,
    targetResolutions: ['720p', '480p'],
    extractThumbnail: true,
  });

  useEffect(() => {
    const syncHistoricalRegistry = async () => {
      try {
        const res = await getUserMediaLibrary(userId);
        console.log("res: ",res);
        if (res.success && res.assets) {
          setActiveJobs(res.assets);
        }
      } catch (err) {
        console.error("Historical log pipeline hydration drop skipped:", err);
      }
    };
    syncHistoricalRegistry();
  }, [userId]);

  const handleFileDetection = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setError(null);

    const fileList = Array.from(selectedFiles);
    const firstFile = fileList[0];

    if (firstFile.type.startsWith('image/')) {
      setFileType('IMAGE');
    } else if (firstFile.type.startsWith('video/')) {
      setFileType('VIDEO');
    } else {
      setError('Unsupported format. Drop imagery or video files only.');
      return;
    }

    setFiles(fileList);
  };

  const executePipelineDispatch = async () => {
    if (files.length === 0 || !fileType) return;
    setIsIngesting(true);
    setError(null);

    const targetFilesInfo = files.map(f => ({ name: f.name, type: fileType }));

    try {
      const responseData = await uploadMedia({
        files,
        userId,
        ...options,
      });

      const assets = responseData.dispatchedAssets || [];
      if (assets.length === 0) {
        throw new Error('Infrastructure anomaly: Pipeline queue rejected target assets.');
      }
  
      const freshJobs: ActiveJob[] = assets.map((asset: any) => ({
        id: asset.dbRecordId,
        fileName: asset.fileName,
        mediaType: targetFilesInfo[0].type,
        status: asset.status || 'PENDING',
        progress: asset.status === 'COMPLETED' ? 100 : 0,
        outputs: asset.outputUrls || asset.processedOutputs || null,
      }));

     

      setActiveJobs((prev) => [...freshJobs, ...prev]);
      setActiveTab('ACTIVE');
      setFiles([]);
      setFileType(null);
    } catch (err: any) {
      setError(err.message || 'An error occurred initializing the ingestion pipeline.');
    } finally {
      setIsIngesting(false);
    }
  };

  useEffect(() => {
    const runningJobs = activeJobs.filter(
      (j) => j.status === 'PENDING' || j.status === 'PROCESSING'
    );
    if (runningJobs.length === 0) return;

    const syncInterval = setInterval(async () => {
      await Promise.all(
        runningJobs.map(async (job) => {
          try {
            const res = await getJobStatus(job.id);
            
            setActiveJobs((prev) =>
              prev.map((j) =>
                j.id === job.id
                  ? {
                      ...j,
                      status: res.status,
                      progress: res.progress,
                      outputs: res.processedOutputs || null,
                    }
                  : j
              )
            );
          } catch (pollingErr) {
            console.error(`Status sync handshake interrupted for job ${job.id}:`, pollingErr);
          }
        })
      );
    }, 1000);

    return () => clearInterval(syncInterval);
  }, [activeJobs]);

  const handleAbortSequence = async (jobId: string) => {
    try {
      await cancelJob(jobId);
      setActiveJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: 'CANCELLED', progress: 0 } : j))
      );
    } catch (err: any) {
      console.error('Cancellation handshake sequence rejected:', err);
    }
  };

  

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <div 
        onClick={() => fileInputRef.current?.click()}
        className={`border border-dashed rounded-3xl p-10 text-center cursor-pointer transition bg-white dark:bg-zinc-900/30 ${
          files.length > 0 
            ? 'border-indigo-500 bg-indigo-50/5 dark:bg-indigo-950/10' 
            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={(e) => handleFileDetection(e.target.files)}
          className="hidden" 
          accept="image/*,video/*"
        />

        <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center mb-4 mx-auto">
          {fileType === 'VIDEO' ? (
            <FileVideo className="h-5 w-5 text-indigo-500 animate-pulse" />
          ) : fileType === 'IMAGE' ? (
            <FileImage className="h-5 w-5 text-indigo-500 animate-pulse" />
          ) : (
            <UploadCloud className="h-5 w-5" />
          )}
        </div>

        {files.length > 0 ? (
          <div>
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-md mx-auto">
              Staged: {files[0].name}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">Options configured below apply to this asset thread.</p>
          </div>
        ) : (
          <div>
            <h2 className="text-base font-bold mb-1">Staging Area</h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-xs mx-auto">
              Drop production-grade assets here to construct targeted media variations.
            </p>
          </div>
        )}
      </div>

      <ProcessingOptions fileType={fileType} options={options} setOptions={setOptions} />

      {files.length > 0 && (
        <Button 
          onClick={executePipelineDispatch}
          disabled={isIngesting}
          className="w-full h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-medium transition flex items-center justify-center gap-2"
        >
          {isIngesting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Distributing Job Packets...</>
          ) : (
            'Initialize Pipeline Execution'
          )}
        </Button>
      )}

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl p-4 flex gap-3 text-rose-700 dark:text-rose-400 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
          <p>{error}</p>
        </div>
      )}

      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-6 text-sm font-semibold text-zinc-400 pt-4">
        <button 
          onClick={() => setActiveTab('ACTIVE')} 
          className={`pb-3 relative transition ${activeTab === 'ACTIVE' ? 'text-zinc-900 dark:text-zinc-100' : 'hover:text-zinc-600'}`}
        >
          Active Streams ({activeJobs.filter(j => j.status === 'PENDING' || j.status === 'PROCESSING').length})
          {activeTab === 'ACTIVE' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('COMPLETED')} 
          className={`pb-3 relative transition ${activeTab === 'COMPLETED' ? 'text-zinc-900 dark:text-zinc-100' : 'hover:text-zinc-600'}`}
        >
          Media Gallery ({activeJobs.filter(j => j.status === 'COMPLETED').length})
          {activeTab === 'COMPLETED' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />}
        </button>
        <button 
          onClick={() => setActiveTab('ARCHIVED')} 
          className={`pb-3 relative transition ${activeTab === 'ARCHIVED' ? 'text-zinc-900 dark:text-zinc-100' : 'hover:text-zinc-600'}`}
        >
          Cancelled Archives ({activeJobs.filter(j => j.status === 'CANCELLED' || j.status === 'FAILED').length})
          {activeTab === 'ARCHIVED' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />}
        </button>
      </div>

      <div className="space-y-4">
        
        {activeTab === 'ACTIVE' && (
          activeJobs.filter(j => j.status === 'PENDING' || j.status === 'PROCESSING').length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-xs bg-white dark:bg-zinc-900/10 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
              No active processing streams currently running.
            </div>
          ) : (
            activeJobs.filter(j => j.status === 'PENDING' || j.status === 'PROCESSING').map(job => (
              <div key={job.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{job.fileName}</p>
                    <p className="text-[10px] font-mono text-zinc-400">UUID: {job.id}</p>
                  </div>
                  <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-mono font-bold uppercase animate-pulse">
                    {job.status}
                  </span>
                </div>
                <div className="space-y-2 bg-zinc-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-zinc-900 dark:bg-zinc-100 h-full transition-all duration-300" style={{ width: `${job.progress}%` }} />
                  </div>
                  <div className="flex justify-between items-center text-[11px] font-mono text-zinc-400">
                    <span>Processing tracks...</span>
                    <span>{job.progress}%</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleAbortSequence(job.id)} className="w-full h-8 text-[11px] font-medium bg-rose-500/5 hover:bg-rose-600 text-rose-500 hover:text-white rounded-lg transition">
                    <XCircle className="h-3.5 w-3.5 mr-2" /> Abort Background Job Execution
                  </Button>
                </div>
              </div>
            ))
          )
        )}

        {activeTab === 'COMPLETED' && (
          activeJobs.filter(j => j.status === 'COMPLETED').length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-xs bg-white dark:bg-zinc-900/10 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
              Your production asset gallery is currently empty.
            </div>
          ) : (
            <div className="space-y-8">
              {/* IMAGE SUB-SECTION */}
              {activeJobs.filter(j => j.status === 'COMPLETED' && j.mediaType === 'IMAGE').length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                    🖼️ Processed Imagery Assets
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {activeJobs.filter(j => j.status === 'COMPLETED' && j.mediaType === 'IMAGE').map(job => (
                      <div key={job.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="truncate">
                            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{job.fileName}</p>
                            <p className="text-[10px] font-mono text-zinc-400">Optimized Image Array Matrix</p>
                          </div>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-mono font-bold">COMPLETED</span>
                        </div>
                        {job.outputs && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                            {Object.entries(job.outputs).map(([key, url]) => (
                              <a key={key} href={url as string} target="_blank" rel="noreferrer" className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800 rounded-xl text-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition group font-medium">
                                <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300 capitalize">{key} variation</span>
                                <ExternalLink className="h-3.5 w-3.5 text-zinc-400 group-hover:text-indigo-500 transition" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeJobs.filter(j => j.status === 'COMPLETED' && j.mediaType === 'VIDEO').length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                    🎬 Transcoded Video Streams
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {activeJobs.filter(j => j.status === 'COMPLETED' && j.mediaType === 'VIDEO').map(job => (
                      <div key={job.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="truncate">
                            <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{job.fileName}</p>
                            <p className="text-[10px] font-mono text-zinc-400">Adaptive Streaming Multi-Bitrate</p>
                          </div>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded font-mono font-bold">COMPLETED</span>
                        </div>
                        {job.outputs && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                            {Object.entries(job.outputs).map(([key, url]) => (
                              <a key={key} href={url as string} target="_blank" rel="noreferrer" className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-100 dark:border-zinc-800 rounded-xl text-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition group font-medium">
                                <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300 capitalize">{key} variant</span>
                                <ExternalLink className="h-3.5 w-3.5 text-zinc-400 group-hover:text-indigo-500 transition" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {activeTab === 'ARCHIVED' && (
          activeJobs.filter(j => j.status === 'CANCELLED' || j.status === 'FAILED').length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-xs bg-white dark:bg-zinc-900/10 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
              No terminated or stalled operations found in history logs.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {activeJobs.filter(j => j.status === 'CANCELLED' || j.status === 'FAILED').map(job => (
                <div key={job.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm opacity-65">
                  <div className="truncate">
                    <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">{job.fileName}</p>
                    <p className="text-[10px] font-mono text-zinc-500">Pipeline Terminated Execution</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                    job.status === 'CANCELLED' ? 'bg-zinc-500/10 text-zinc-400' : 'bg-rose-500/10 text-rose-500'
                  }`}>
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};