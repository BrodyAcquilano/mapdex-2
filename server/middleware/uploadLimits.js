import multer from "multer";

import {
  GALLERY_IMAGE_UPLOAD_LIMIT_BYTES,
  isAllowedGalleryMimeType,
} from "../../shared/validation/galleryContentValidation.js";

function invalidImageFileTypeError() {
  const error = new Error("Invalid image file type.");
  error.status = 400;
  return error;
}

export const galleryImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: GALLERY_IMAGE_UPLOAD_LIMIT_BYTES,
    files: 1,
    fields: 3,
    parts: 4,
    fieldSize: 10 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!isAllowedGalleryMimeType(file.mimetype)) {
      cb(invalidImageFileTypeError());
      return;
    }

    cb(null, true);
  },
});