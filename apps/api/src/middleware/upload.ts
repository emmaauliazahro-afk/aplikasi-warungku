import multer from 'multer';
import { ApiError } from './error';

// Store file in memory (we parse the buffer directly, no disk write)
export const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const isCsv =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv');
    if (!isCsv) {
      return cb(new ApiError(400, 'File harus berformat CSV'));
    }
    cb(null, true);
  },
}).single('file');
