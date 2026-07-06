import express from 'express'
import {Queue} from 'bullmq'
import Redis from 'ioredis'
import cors from 'cors'
import dotenv from "dotenv";
import {  validateMediaUpload } from './middleware/upload.js';
// import { prisma } from "../../../../../packages/db/prisma";
import { streamUploadToCloudinary } from './utils/cloudinary.js';
import { prisma } from '@project/db'

dotenv.config();

const app=express()
app.use(cors());
app.use(express.json());

//connection to local docker redis instance
const redisConnection = new Redis.default({
   host: 'localhost',
   port: 6379,
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
//   //      console.log('📁 File info:', {
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
//     console.error('💥 Critical Pipeline Mismatch:', error);
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

const PORT=5000;
app.listen(PORT,()=>{
    console.log(`API server is running on port ${PORT}`)
})
