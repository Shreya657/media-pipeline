
import dotenv from 'dotenv';
dotenv.config();
// console.log("DATABASE_URL:", process.env.DATABASE_URL);
// console.log("Current Working Directory:", process.cwd());
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import axios from 'axios';
import { executeImagePipeline } from './utils/img-processor.js';
import { prisma } from '@project/db';
import { executeVideoPipeline, type JobCancellationTracker } from './utils/video-processor.js';


// dotenv.config();

console.log('High-Performance Background Worker booting up...');
// console.log("REDIS_URL =", process.env.REDIS_URL);




//connection to local docker redis instance
const redisConnection = new Redis.default(process.env.REDIS_URL!,{
   maxRetriesPerRequest: null 
  });


  //initializing for notification
  const redisPublisher =new Redis.default(process.env.REDIS_URL!,{
   maxRetriesPerRequest: null 
  });

  // EXTRA NETWORK HOOK:an isolated redis connection for the Pub/Sub listener
const redisSubscriber = new Redis.default(process.env.REDIS_URL!,{
   maxRetriesPerRequest: null 
  });

//memory mapping to monitor uploadId
const activeJobsMemoryStore = new Map<string, { cancelTracker: JobCancellationTracker; jobInstance: Job }>();

// connect to the messaging channel immediately on boot
redisSubscriber.subscribe('media-pipeline-cancellation', (err) => {
  if (err) {
    console.error('🥀Failed to bind cancellation subscription stream channel:', err);
  } else {
    console.log('Worker Network safely listening to [media-pipeline-cancellation] broadcast frequencies...');
  }
});

// Intercept messages passing across the cluster channel in real-time
redisSubscriber.on('message', async (channel, message) => {
  if (channel === 'media-pipeline-cancellation') {
    const { uploadId } = JSON.parse(message);
    
    // Check if this specific worker thread is the one processing the targeted asset
    if (activeJobsMemoryStore.has(uploadId)) {
      console.log(` CRITICAL KILL SIGNAL RECIEVED FOR ASSET: ${uploadId}!!`);
      const record = activeJobsMemoryStore.get(uploadId);

    if(!record){
      return;
    }
      
      if (record) {
        const { cancelTracker, jobInstance } = record;

        cancelTracker.cancelled = true;
        
        // If an FFmpeg transcode subprocess is currently ticking, execute a hard OS level abort kill
        if (cancelTracker.activeCommand && typeof cancelTracker.activeCommand.kill === 'function') {
          console.log('Killing active background FFmpeg OS subprocess execution link...');
          // cancelTracker.activeCommand.kill('SIGKILL'); // Kills the process instantly
          cancelTracker.activeCommand.kill('SIGTERM'); // Graceful termination signal
        }
        
        // Forcibly discard/fail the parent BullMQ job container from the queue stack cleanly
        try {
      await prisma.upload.update({
    where:{id:uploadId},
    data:{
    status:"CANCELLED"
    }
})
          await jobInstance.discard();
          await jobInstance.moveToFailed(new Error('Job terminated by explicit user cancellation command.'), 'CANCELED_BY_USER');
    
        } catch (queueErr) {
          console.warn(' Queue job step displacement caught during abort cycle:', queueErr);
        }
        
        // Wipe our tracking memory matrix record
        activeJobsMemoryStore.delete(uploadId);
      }
    }
  }
});

const mediaWorker = new Worker(
  'media-processing',
  async (job: Job) => {
    const { uploadId, originalUrl, mediaType, options,userId } = job.data;
    console.log(`\n [JOB STARTED] Processing Asset ID: ${uploadId} (Type: ${mediaType})`);

    // Initialize an isolated, trackable cancel reference container for this unique loop iteration
    const cancelTracker: JobCancellationTracker = { activeCommand: undefined,cancelled: false };
    
    // Register this live job into memory right before compute cycles commence
    activeJobsMemoryStore.set(uploadId, { cancelTracker, jobInstance: job });
    
    console.log(`\n[JOB CAPTURED] Transcoding Asset ID: ${uploadId} (Type: ${mediaType})`);
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
        const processedOutputs = await executeImagePipeline(rawBuffer, uploadId, options,cancelTracker);
        
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

        

        //notification
        const notificationText = `Image variation optimization processing complete for ${job.data.fileName || 'your image asset'}.`;
        await prisma.notification.create({
          data: {
            userId: userId || 'user_3FmKTy98aHZT2lTto3jAMux43uB', // Fallback safety seed
            uploadId: uploadId,
            message: notificationText,
            isRead: false,
            number: 1 // If required by schema constraints
          }
        });
        //publisher
        await redisPublisher.publish('media-pipeline-notifications', JSON.stringify({
          userId,
          dbRecordId: uploadId,
          fileName: job.data.fileName || 'Image Asset',
          status: 'COMPLETED',
          type: 'PROCESSING_COMPLETE'
        }));

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
      },
      cancelTracker
    );
    await prisma.upload.update({
    where: { id: uploadId },
    data: {
      status: 'COMPLETED',
      progress: 100,
      processingOpts: processedOutputs // Saves keys: res_720p, res_480p, thumbnail
    }
  });

//notification
const notificationText = `Video multi-bitrate transcoding complete for ${job.data.fileName || 'your video asset'}.`;
        await prisma.notification.create({
          data: {
            userId: userId || 'user_3FmKTy98aHZT2lTto3jAMux43uB',
            uploadId: uploadId,
            message: notificationText,
            isRead: false,
            number: 1
          }
        });
//notification publisher
        await redisPublisher.publish('media-pipeline-notifications', JSON.stringify({
          userId,
          dbRecordId: uploadId,
          fileName: job.data.fileName || 'Video Asset',
          status: 'COMPLETED',
          type: 'PROCESSING_COMPLETE'
        }));

  console.log(`✅ [JOB COMPLETED] Video successfully transcoded:`, processedOutputs);
  return { success: true, outputs: processedOutputs };
    }} catch (error: any) {
      // Check if this error was thrown because we deliberately triggered an OS process kill
      const currentStatus = await prisma.upload.findUnique({ where: { id: uploadId } });
      
      if (currentStatus?.status === 'CANCELLED' && cancelTracker.cancelled) {
        console.log(` Execution cleanup concluded for aborted asset: ${uploadId}`);
      } else {
        console.error(`🥀Pipeline crash caught during lifecycle run for ID: ${uploadId}:`, error);
        await prisma.upload.update({
          where: { id: uploadId },
          data: { status: 'FAILED' }
        });
      }

      try {
          const notificationText = `Processing anomaly encountered for ${job.data.fileName || 'your media file'}. Execution stalled.`;
          await prisma.notification.create({
            data: {
              userId: userId || 'user_3FmKTy98aHZT2lTto3jAMux43uB',
              uploadId: uploadId,
              message: notificationText,
              isRead: false,
              number: 2
            }
          });

          await redisPublisher.publish('media-pipeline-notifications', JSON.stringify({
            userId,
            dbRecordId: uploadId,
            fileName: job.data.fileName || 'Media Asset',
            status: 'FAILED',
            type: 'PROCESSING_FAILED'
          }));
        } catch (pubErr) {
          console.error('Failed to dispatch crash notification tracking metrics:', pubErr);
        }
      
      throw error;
    } finally {
      activeJobsMemoryStore.delete(uploadId);
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
    const upload = await prisma.upload.findUnique({
  where: { id: uploadId }
});

if (upload?.status === "CANCELLED") {
  return;
}
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



