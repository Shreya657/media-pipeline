import multer from "multer";
import { fileTypeFromBuffer } from 'file-type';
//storing in memory buffer instead of disk storage
const storage = multer.memoryStorage();
const uploadLimits = {
    fileSize: 15 * 1024 * 1024, // 10MB
};
const rawMulterUpload = multer({
    storage: storage,
    limits: uploadLimits,
}).array("files", 5); //accept 5 files with key name "file"
export const validateMediaUpload = (req, res, next) => {
    rawMulterUpload(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: `upload error: ${err.message}` });
        }
        else if (err) {
            return res.status(500).json({ error: `server error: ${err.message}` });
        }
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files detected in request payload.' });
        }
        const files = req.files; //array of Multer File objects
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'mkv'];
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-matroska'];
        try {
            for (const file of files) {
                const detectType = await fileTypeFromBuffer(file.buffer);
                if (!detectType || !allowedExtensions.includes(detectType.ext) || !allowedMimeTypes.includes(detectType.mime)) {
                    return res.status(400).json({ error: 'invalid file type. only image files are allowed' });
                }
                //attach verified metadata
                file.extension = detectType.ext;
                file.mimetype = detectType.mime;
            }
            next();
        }
        catch (err) {
            return res.status(500).json({ error: `buffer inspection failed: ${err.message}` });
        }
    });
};
//# sourceMappingURL=upload.js.map