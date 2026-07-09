import dotenv from 'dotenv'
import { Readable } from 'stream';
import { v2 as cloudinary } from 'cloudinary';


dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
})

// console.log('Cloudinary config check:', {
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   has_secret: !!process.env.CLOUDINARY_API_SECRET
// })

interface CloudinaryUploadResult {
    secure_url:string;
    public_id:string;
}



export const streamUploadToCloudinary=(fileBuffer:Buffer,fileName:string):Promise<CloudinaryUploadResult>=>{
    return new Promise((resolve,reject)=>{
    const uploadStream=cloudinary.uploader.upload_stream(
        {
            resource_type:'auto' //cloudinary autodetects the file type
            // folder:'media-processor-raw-uploads',
            // // upload_preset:'media-monorepo',
            // public_id: `raw-${Date.now()}`
        },
        (error,result)=>{
        if(error){
        console.log('Full Cloudinary error:', JSON.stringify(error, null, 2))
        return reject(error);
        }
        if(!result){
        return reject(new Error("cloudinary streaming returned empty payload"));
        }
        resolve({
        secure_url:result.secure_url,
        public_id:result.public_id
        });
    }
);

const readableStream=new Readable(); //creates an empty stream
readableStream.push(fileBuffer);
readableStream.push(null); //indicate end of stream
readableStream.pipe(uploadStream); //connect 
    })
}


