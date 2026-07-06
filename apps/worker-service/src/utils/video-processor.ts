import ffmpeg from 'fluent-ffmpeg';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// creating the temp workspace directory if it doesn't exist
const tempDir = path.join(process.cwd(), 'temp-workspace');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

interface VideoProgressData {
  percent?: number;
}

// to probe video metadata
const getVideoDimensions = (filePath: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => { //ffprove- Only reads information.,ffmpeg:do actual edits
      if (err) return reject(err);
      const stream = metadata.streams.find((s) => s.codec_type === 'video');
      resolve({
        width: stream?.width || 0,
        height: stream?.height || 0,
      });
    });
  });
};

// Helper to upload a video or image file to Cloudinary
const uploadVideoToCloudinary = (filePath: string, publicId: string, isImage = false): Promise<string> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      filePath,
      { resource_type: isImage ? 'image' : 'video', public_id: publicId },
      (error, result) => {
        if (error)
         return reject(error);
        resolve(result!.secure_url);
      }
    );
  });
};

export const executeVideoPipeline = async (
  videoUrl: string, 
  uploadId: string, 
  options: { targetResolutions?: string[]; extractThumbnail?: boolean }, 
  onProgress: (progress: number) => Promise<void>
) => {
  const inputPath = path.join(tempDir, `input-${uploadId}.mp4`);
  const out720pPath = path.join(tempDir, `out-720p-${uploadId}.mp4`);
  const out480pPath = path.join(tempDir, `out-480p-${uploadId}.mp4`);
  const thumbDir = tempDir;
  const thumbName = `thumb-${uploadId}.png`;
  const thumbPath = path.join(thumbDir, thumbName);

  const outputs: Record<string, string> = {};

  try {
    // Download raw file
    console.log(`Downloading raw video to local cache disk...`);
    const writer = fs.createWriteStream(inputPath);
    const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Fetch real dimension metadata
    const dimensions = await getVideoDimensions(inputPath);
    console.log(`Original Video Dimensions: ${dimensions.width}x${dimensions.height}`);

    const transcodeResolution = (outputPath: string, width: number, progressOffset: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        (ffmpeg(inputPath) as any)
          .outputOptions([
            `-vf scale=w=${width}:h=-2`, 
            '-c:v libx264',               
            '-crf 23',                    
            '-preset fast',               
            '-c:a aac',                   
            '-b:a 128k'                   
          ])
          .output(outputPath)
          .on('progress', (progress: VideoProgressData) => {
            if (progress.percent) {
              const dynamicScale = Math.round((progress.percent / 100) * 35) + progressOffset;
              onProgress(Math.min(dynamicScale, 90));
            }
          })
          .on('end', () => resolve())
          .on('error', (err: any) => reject(err))
          .run();
      });
    };

    // Only transcode if requested && supported by original video size
    const targets = options.targetResolutions || ['720p', '480p'];

    if (targets.includes('720p') && dimensions.width >= 1280) {
      console.log('Commencing 720p HD downscaling...');
      await transcodeResolution(out720pPath, 1280, 20);
      outputs['res_720p'] = await uploadVideoToCloudinary(out720pPath, `video-720p-${uploadId}`);
    } else {
      console.log('Skipping 720p transcode (Not requested or video is too small).');
    }

    if (targets.includes('480p') && dimensions.width >= 854) {
      console.log('Commencing 480p SD optimization...');
      await transcodeResolution(out480pPath, 854, 55);
      outputs['res_480p'] = await uploadVideoToCloudinary(out480pPath, `video-480p-${uploadId}`);
    } else {
      console.log('Skipping 480p transcode.');
    }

    // Dynamic Thumbnail Extraction
    if (options.extractThumbnail !== false) {
      console.log('Extracting video thumbnail...');
      await new Promise<void>((resolve, reject) => {
        (ffmpeg(inputPath) as any)
          .screenshots({
            timestamps: ['00:00:01.000'],
            filename: thumbName,
            folder: thumbDir,
            size: '640x360'
          })
          .on('end', () => resolve())
          .on('error', (err: any) => reject(err));
      });

      if (fs.existsSync(thumbPath)) {
        outputs['thumbnail'] = await uploadVideoToCloudinary(thumbPath, `video-thumb-${uploadId}`, true);
      }
    }

    return outputs;

  } finally {
    //GARBAGE COLLECTION
    const files = [inputPath, out720pPath, out480pPath, thumbPath];
    for (const file of files) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (err) {
        console.warn(`Couldn't delete temp file ${file}`);
      }
    }
  }
};