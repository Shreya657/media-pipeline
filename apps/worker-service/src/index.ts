
// import dotenv from 'dotenv';
// dotenv.config();
// console.log("DATABASE_URL:", process.env.DATABASE_URL);
// console.log("Current Working Directory:", process.cwd());
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import axios from 'axios';
import { executeImagePipeline } from './utils/img-processor.js';
import { prisma } from '@project/db';
import { executeVideoPipeline } from './utils/video-processor.js';


// dotenv.config();

console.log('High-Performance Background Worker booting up...');

//connection to local docker redis instance
const redisConnection = new Redis.default({
   host: 'localhost',
   port: 6379,
   maxRetriesPerRequest: null 
  });

const mediaWorker = new Worker(
  'media-processing',
  async (job: Job) => {
    const { uploadId, originalUrl, mediaType, options } = job.data;
    console.log(`\n [JOB STARTED] Processing Asset ID: ${uploadId} (Type: ${mediaType})`);

    // 1. mark state as PROCESSING and set progress tracker to 10%
    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: 'PROCESSING', progress: 10 }
    });

    try {
      if (mediaType === 'IMAGE') {
        // 2. fetch raw file data down into an in-memory buffer array safely
        console.log(` Downloading asset into RAM: ${originalUrl}`);
        const response = await axios.get(originalUrl, { responseType: 'arraybuffer' });
        const rawBuffer = Buffer.from(response.data);
        
        await job.updateProgress(40);
        await prisma.upload.update({
          where: { id: uploadId },
          data: { progress: 40 }
        });

        // 3. execute the chainable Sharp transformation engine
        console.log(` Core compute engine running...`);
        const processedOutputs = await executeImagePipeline(rawBuffer, uploadId, options);
        
        await job.updateProgress(80);
        await prisma.upload.update({
          where: { id: uploadId },
          data: { progress: 80 }
        });

        // 4. update the DB state to absolute completion, saving the output URLs
        await prisma.upload.update({
          where: { id: uploadId },
          data: {
            status: 'COMPLETED',
            progress: 100,
             processingOpts: processedOutputs // Saves JSON object containing URLs
          }
        });

        console.log(`✅ [JOB COMPLETED] Asset successfully transformed:`, processedOutputs);
        return { success: true, outputs: processedOutputs };
      } else if (mediaType === 'VIDEO') {
      console.log(`Video optimization job detected. Spinning up FFmpeg processing engine...`);
  
  //  Fire the streaming loop and feed back live db updates dynamically
  const processedOutputs = await executeVideoPipeline(
    originalUrl, 
    uploadId, 
    options,
    async (progressPercentage: number) => {
      // Stream incremental progress up to the db in real-time
      await job.updateProgress(progressPercentage);
      await prisma.upload.update({
        where: { id: uploadId },
        data: { progress: progressPercentage }
      });
      console.log(` Video ${uploadId} compilation progress: ${progressPercentage}%`);
      }
    );
    await prisma.upload.update({
    where: { id: uploadId },
    data: {
      status: 'COMPLETED',
      progress: 100,
      processingOpts: processedOutputs // Saves keys: res_720p, res_480p, thumbnail
    }
  });

  console.log(`✅ [JOB COMPLETED] Video successfully transcoded:`, processedOutputs);
  return { success: true, outputs: processedOutputs };
    }} catch (error: any) {
      console.error(` Processing execution failure inside worker loop:`, error.message);
      throw error; 
    }
  },
  { 
    connection: redisConnection as any, 
    concurrency: 2 // Processes up to 2 items in parallel 
  }
);

// CRASH RECOVERY & SYSTEM FAULT HANDLERS


// catch jobs that fail an individual attempt lifecycle step
mediaWorker.on('failed', async (job, err) => {
  if (!job)
   return;
  const { uploadId } = job.data;
  console.error(`❌ Job ${job.id} failed an attempt because of:`, err.message);
  
  // check if the job has burned through all its retry attempts
  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    console.error(`[CRITICAL FAULT] Job ${job.id} failed permanently after maximum retries. Logging trace.`);
    
    // update DB status to FAILED 
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: 'FAILED',
        failReason: err.message || 'Unknown processing runtime collapse.'
      }
    });
  } else {
    console.warn(`[RETRYING TASK] Job ${job.id} failed an attempt (Made: ${job.attemptsMade}). Retrying with exponential backoff...`);
  }
});