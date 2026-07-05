declare global {
  namespace Express {
    namespace Multer {
      interface File {
        extension?: string;
        mimetype?: string;
      }
    }
  }
}
export {};