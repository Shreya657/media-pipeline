import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Configure Cloudinary 
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

interface ProcessOptions {
  format?: 'webp' | 'jpeg' | 'png' | 'avif';
  width?: number;
  height?: number;
  generateThumbnail?: boolean;
}

// Helper to stream a buffer output straight back to Cloudinary
const uploadBufferToCloudinary = (buffer: Buffer, publicId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'image', public_id: publicId },
      (error, result) => {
        if (error) 
        return reject(error);
        resolve(result!.secure_url);
      }
    );
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
};

export const executeImagePipeline = async (inputBuffer: Buffer, uploadId: string, options: ProcessOptions) => {
  const outputs: Record<string, string> = {};

  let pipeline = sharp(inputBuffer).rotate(); // auto-rotates phone images based on EXIF orientation

  //Format Conversion
  if (options.format) {
    pipeline = pipeline.toFormat(options.format, { quality: 85 });
  } 
  else {
    pipeline = pipeline.toFormat('webp', { quality: 85 }); // Fallback optimal format
  }

  // Resizing & Aspect Ratio Control
  if (options.width || options.height) {
    pipeline = pipeline.resize({
      width: options.width,
      height: options.height,
      fit: 'inside', // maintains aspect ratio without stretching/distorting
      withoutEnlargement: true // prevents upscaling pixelated blurs
    });
  }

  // compile the primary file buffer
  const mainProcessedBuffer = await pipeline.toBuffer();
  const targetExt = options.format || 'webp';
  
  // Stream main output back to cloudinary
  const mainUrl = await uploadBufferToCloudinary(mainProcessedBuffer, `processed-${uploadId}-${Date.now()}`);
  outputs['main'] = mainUrl;

  //thumbnail generation
  if (options.generateThumbnail) {
    const thumbnailBuffer = await sharp(inputBuffer)
      .resize(300, 300, {
         fit: 'cover',
        kernel: sharp.kernel.lanczos3
       }) // force exact square crop for user profile grids/dashboards
      .toFormat(targetExt, { quality: 85 })
      .toBuffer();

    const thumbUrl = await uploadBufferToCloudinary(thumbnailBuffer, `thumb-${uploadId}-${Date.now()}`);
    outputs['thumbnail'] = thumbUrl;
  }

  return outputs;
};