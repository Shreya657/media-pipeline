
import express from 'express'
import {Queue} from 'bullmq'
import Redis from 'ioredis'
import cors from 'cors'
import dotenv from "dotenv";
import {  validateMediaUpload } from './middleware/upload.js';
import { streamUploadToCloudinary } from './utils/cloudinary.js';
import { prisma } from '@project/db'
import { createServer } from 'http';
import { Server } from 'socket.io';


dotenv.config();


const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL 
].filter(Boolean) as string[];


const app=express()


// express cors Handler 
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by security system CORS configuration matrix'));
    }
  },
  credentials: true
}));

app.use(express.json());
const httpServer = createServer(app);


//socket io w cors setup
const io = new Server(httpServer, {
  cors: {
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
        callback(null, true);
      } else {
        console.log(`Connection blocked by CORS engine: ${requestOrigin}`);
        callback(new Error('Blocked by security system CORS configuration matrix'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  path: '/socket.io/' 
});


//connection to local docker redis instance
const redisConnection = new Redis.default(process.env.REDIS_URL!,{
   maxRetriesPerRequest: null 
  });

//create the media processing queue channel
const mediaQueue=new Queue('media-processing',{
    connection:redisConnection as any
})


app.post('/api/media/upload', validateMediaUpload, async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const userId = req.body.userId || 'user_3FmKTy98aHZT2lTto3jAMux43uB';
    
    // Pull dynamic options for both Image and Video pipelines
    const { format, width, height, generateThumbnail, targetResolutions, extractThumbnail } = req.body;

    // Compiled Image Options
    const imageOptions = {
      format: format || 'webp',
      width: width ? parseInt(width, 10) : undefined,
      height: height ? parseInt(height, 10) : undefined,
      generateThumbnail: generateThumbnail === 'true' || generateThumbnail === true
    };

    // Compiled Video Options
    // Accepts a comma-separated string (e.g., "720p,480p") and converts it into an array
    const videoOptions = {
      targetResolutions: targetResolutions 
        ? targetResolutions.split(',').map((r: string) => r.trim()) 
        : ['720p', '480p'], // Fallback defaults
      extractThumbnail: extractThumbnail === undefined ? true : (extractThumbnail === 'true' || extractThumbnail === true)
    };

    const dispatchSummary = [];

    // process all the files in loop
    for (const file of files) {
        const cloudStorage = await streamUploadToCloudinary(file.buffer, file.originalname);
        const mediaType = file.mimetype.startsWith('video') ? 'VIDEO' : 'IMAGE';

        const dbUploadRecord = await prisma.upload.create({
            data: {
              userId: userId,
              originalName: file.originalname,
              originalUrl: cloudStorage.secure_url,
              mediaType: mediaType,
              status: 'PENDING',
              progress: 0,
              //  Inject the dynamically compiled options based on media type
              processingOpts: mediaType === 'IMAGE' 
                ? imageOptions
                : videoOptions
            }  
        });

        // dispatch to BullMQ Queue
        const job = await mediaQueue.add('process-media-asset', {
          uploadId: dbUploadRecord.id,
          userId: userId,
          originalUrl: cloudStorage.secure_url,
          mediaType: mediaType,

          options: dbUploadRecord.processingOpts 
        }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 }
        });

        dispatchSummary.push({
          fileName: file.originalname,
          dbRecordId: dbUploadRecord.id,
          queueJobId: job.id,
          cloudUrl: cloudStorage.secure_url
        });
    }
    
    return res.status(200).json({
      success: true,
      message: `${files.length} asset(s) uploaded, persisted to DB, and queued safely.`,
      dispatchedAssets: dispatchSummary
    });
  } catch (error: any) {
    console.error('Critical Pipeline Mismatch:', error);
    return res.status(500).json({ error: error.message || 'Internal processing error.' });
  }
});


// Initializing a dedicated publisher
const redisPublisher = new Redis.default(process.env.REDIS_URL!,{
   maxRetriesPerRequest: null 
  });


 //Polling Status Engine
app.get('/api/media/status/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const uploadRecord = await prisma.upload.findUnique({
      where: { id }
    });

    if (!uploadRecord) {
      return res.status(404).json({ 
        error: 'Target media asset record not found.' 
      });
    }

    return res.status(200).json({
      success: true,
      status: uploadRecord.status,
      progress: uploadRecord.progress,
      processedOutputs: uploadRecord.processingOpts || null,
      error: uploadRecord.status === 'FAILED' ? 'Processing pipeline anomaly encountered.' : undefined
    });
  } catch (error: any) {
    console.error('Status polling resolution mismatch:', error);
    return res.status(500).json({ error: error.message || 'Internal registry error.' });
  }
});

//get history of gallary
app.get('/api/media/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const historicalRecords = await prisma.upload.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' } 
    });

    const normalizedData = historicalRecords.map((record:any)=> ({
      id: record.id,
      fileName: record.originalName,
      mediaType: record.mediaType,
      status: record.status,
      progress: record.progress,
      outputs: record.processingOpts || null 
    }));

    return res.status(200).json({
      success: true,
      assets: normalizedData
    });
  } catch (error: any) {
    console.error('Historical fetch anomaly:', error);
    return res.status(500).json({ error: error.message || 'Failed to retrieve media library.' });
  }
});


 // distributed job cancellation
app.post('/api/media/jobs/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    // instantly assert the db record state to prevent redundant operations
    const record = await prisma.upload.findUnique({ where: { id } });

    if (!record) {
      return res.status(404).json({ 
        error: 'Target asset record could not be found.' 
      });
    }

    if (record.status === 'COMPLETED' || record.status === 'FAILED' || record.status === 'CANCELLED') {
      return res.status(400).json({ 
        error: `Cannot cancel a job that has already completed with status: ${record.status}` 
      });
    }

    // update state to CANCELLED to isolate workflows
    await prisma.upload.update({
      where: { id },
      data: { 
        status: 'CANCELLED',
        // progress: 0
      }
    });

    // THE KILL SIGNAL: Broadcast the uploadId over the Redis matrix channel instantly
    console.log(`Publishing distributed kill signal across cluster channel for asset: ${id}`);
    await redisPublisher.publish('media-pipeline-cancellation', JSON.stringify({ uploadId: id }));

    return res.status(200).json({
      success: true,
      message: 'Distributed cancellation sequence initialized. Subprocesses terminated.'
    });
  } catch (error: any) {
    console.error('Critical failure processing worker abort hook:', error);
    return res.status(500).json({
       error: error.message || 'Internal orchestration error.' 
      });
  }
});






// Subscriber instances lock down the network connection exclusively for receiving messages
const redisSubscriber = new Redis.default(process.env.REDIS_URL!,{
   maxRetriesPerRequest: null 
  });

// Connection Routing
io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId as string;
  
  if (!userId) {
    console.log('anonymous socket connection attempt rejected.');
    socket.disconnect();
    return;
  }

  const roomName = `room:${userId}`;
  socket.join(roomName);
  console.log(`user joined authenticated tracking channel: ${roomName} (Socket ID: ${socket.id})`);

  socket.on('disconnect', () => {
    console.log(`user disconnected from channel: ${roomName}`);
  });
});

// connect the redis cluster to WebSockets
// listening for incoming published signals broadcasted from the background worker service
redisSubscriber.subscribe('media-pipeline-notifications', (err) => {
  if (err) {
    console.error('failed to subscribe to Redis notifications channel:', err);
  } else {
    console.log('API Server successfully listening to "media-pipeline-notifications" Redis matrix.');
  }
});

redisSubscriber.on('message', (channel, message) => {
  if (channel === 'media-pipeline-notifications') {
    try {
      const payload = JSON.parse(message);
      const { userId, type, fileName, status, dbRecordId } = payload;

      if (!userId) return;

      // broadcast the event EXCLUSIVELY to that users private room
      const targetRoom = `room:${userId}`;
      io.to(targetRoom).emit('pipeline-event', {
        type,         // e.g., 'PROCESSING_COMPLETE', 'PROCESSING_FAILED'
        fileName,     // e.g., 'tot.mp4'
        status,       // e.g., 'COMPLETED', 'FAILED'
        dbRecordId,   // The database primary key to flash lookups
        timestamp: new Date().toISOString()
      });

      console.log(`broadcasted pipeline notification down channel [${targetRoom}] for asset: ${fileName}`);
    } catch (parseError) {
      console.error('🚨 Error parsing Redis pipeline payload:', parseError);
    }
  }
});





// app.post('/api/media/upload',validateMediaUpload,async(req,res)=>{
//   try{
//     const files=req.files as Express.Multer.File[];
//     const userId=req.body.userId || 'user_3FmKTy98aHZT2lTto3jAMux43uB';
//     const { format, width, height, generateThumbnail } = req.body;
// const imageOptions = {
//       format: format || 'webp', // e.g., 'png', 'jpeg', 'avif'
//       width: width ? parseInt(width, 10) : undefined,
//       height: height ? parseInt(height, 10) : undefined,
//       generateThumbnail: generateThumbnail === 'true' || generateThumbnail === true
//     };
//     const dispatchSummary=[];

//     // process all the files in loop
//     for(const file of files){
//   //      console.log(' File info:', {
//   //   name: file.originalname,
//   //   mimetype: file.mimetype,
//   //   size: file.size,
//   //   bufferLength: file.buffer?.length
//   // })
//         const cloudStorage=await streamUploadToCloudinary(file.buffer,file.originalname);
//         const mediaType=file.mimetype.startsWith('video') ? 'VIDEO' : 'IMAGE';

//         const dbUploadRecord=await prisma.upload.create({
//             data:{
//               userId: userId,
//           originalName: file.originalname,
//           originalUrl: cloudStorage.secure_url,
//           mediaType: mediaType,
//           status: 'PENDING',
//           progress: 0,
//           // set default processing instructions based on file type
//           processingOpts: mediaType === 'IMAGE' 
//             ? imageOptions
//             : { targetResolutions: ['720p', '480p'], extractThumbnail: true }
//         }  
//         })

//         // dispatch to BullMQ Queue
//       const job = await mediaQueue.add('process-media-asset', {
//         uploadId: dbUploadRecord.id,
//         userId: userId,
//         originalUrl: cloudStorage.secure_url,
//         mediaType: mediaType,
//         options: dbUploadRecord.processingOpts
//       }, {
//         attempts: 3,
//         backoff: { type: 'exponential', delay: 1000 }
//       });

//       dispatchSummary.push({
//         fileName: file.originalname,
//         dbRecordId: dbUploadRecord.id,
//         queueJobId: job.id,
//         cloudUrl: cloudStorage.secure_url
//       });
//     }
    
//     return res.status(200).json({
//       success: true,
//       message: `${files.length} asset(s) uploaded, persisted to DB, and queued safely.`,
//       dispatchedAssets: dispatchSummary
//     });
//   }catch (error: any) {
//     console.error('Critical Pipeline Mismatch:', error);
//     return res.status(500).json({ error: error.message || 'Internal processing error.' });
//   }
// })




// app.post('/api/images/upload',validateImgUpload,async(req,res)=>{
//     try{
//         const file=req.file;
//         if (!file) {
//         return res.status(400).json({
//         error: "No file uploaded"
//     });
// }

//         const job=await mediaQueue.add('process-image-flow',{
//             originalName:file.originalname,
//             mimeType:file.mimetype,
//             size:file.size,
//             bufferData:file?.buffer.toString('base64'),
//             options:{
//                 convertTo:'webp',
//                 generateThumbnail:true,
//             }
//         },{
//             attempts:3,
//             backoff:{type:'exponential',delay:5000}
//         })
        
//         return res.status(200).json({
//       success: true,
//       message: 'Image binary authorized and dispatched to job flow system.',
//       jobId: job.id,
//       meta: {
//         name: file.originalname,
//         detectedType: file.mimetype,
//         sizeInBytes: file.size
//       }
//     });
//     }catch(error:any){
//         console.error(error);
//         return res.status(500).json({error:error.message})
//     }
// })


// app.post('/api/test-queue',async(req,res)=>{
//     try{
//         const {filename,type}=req.body;

//         //dispatch dummy tracking task into bullmq
//         const job=await mediaQueue.add('process-raw-asset',{
//             filename:filename|| 'sample.png',
//             type:type || 'IMAGE',
//             timeStamp:Date.now()
//         },{
//             attempts:3,
//             backoff:{type:'exponential',delay:5000}
//         }) 

//         return res.status(200).json({
//             success:true,
//             message:'job suceessfully dispatched to highway',
//             jobId:job.id
//         })
//     }catch(error:any){
//         console.error(error);
//         return res.status(500).json({error:error.message})
//     }
// })

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT,()=>{
    console.log(`API+HTTP server is running on port ${PORT}`)
})
