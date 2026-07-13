interface CloudinaryUploadResult {
    secure_url: string;
    public_id: string;
}
export declare const streamUploadToCloudinary: (fileBuffer: Buffer, fileName: string) => Promise<CloudinaryUploadResult>;
export {};
//# sourceMappingURL=cloudinary.d.ts.map