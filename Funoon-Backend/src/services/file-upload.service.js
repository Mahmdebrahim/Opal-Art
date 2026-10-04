const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");
const { BadRequestError, InternalServerError } = require("../utils/api-error");
const logger = require("../utils/logger");
const M = require("../utils/messages");

class FileUploadService {
  // Upload Avatar (Profile Picture)
  static async uploadAvatar(file, userId) {
    try {
      if (!file) throw new BadRequestError(M.upload.noFile);
      if (!file.mimetype.startsWith("image/"))
        throw new BadRequestError(M.upload.mustBeImage);

      const buffer = file.buffer;
      const isJpeg =
        buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      const isPng =
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47;
      const isWebP =
        buffer.slice(0, 4).toString() === "RIFF" &&
        buffer.slice(8, 12).toString() === "WEBP";

      if (!isJpeg && !isPng && !isWebP) {
        throw new BadRequestError("الصورة غير صالحة");
      }

      const uploadDir = path.join(__dirname, "../../uploads/avatars");
      await fs.mkdir(uploadDir, { recursive: true });

      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const filename = `avatar-${userId}-${timestamp}-${randomString}.webp`;
      const filepath = path.join(uploadDir, filename);

      await sharp(file.buffer)
        .resize(400, 400, { fit: "cover", position: "center" })
        .webp({ quality: 80 })
        .toFile(filepath);

      const avatarUrl = `/uploads/avatars/${filename}`;
      logger.info(`Avatar uploaded: ${avatarUrl}`);
      return avatarUrl;
    } catch (error) {
      logger.error("Error uploading avatar:", error);
      if (error instanceof BadRequestError) throw error;
      throw new InternalServerError(M.general.serverError);
    }
  }

  // Upload single artwork image (used in controller)
  // في FileUploadService.uploadArtworkImage:
  static async uploadArtworkImage(file, artworkId, index) {
    try {
      if (!file) throw new BadRequestError(M.upload.noFile);

      // ✅ Layer 1: MIME check (من multer)
      if (!file.mimetype.startsWith("image/"))
        throw new BadRequestError(M.upload.mustBeImage);

      // ✅ Layer 2: Magic bytes check (من الـ buffer نفسه)
      const buffer = file.buffer;
      const isJpeg =
        buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      const isPng =
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47;
      const isWebP =
        buffer.slice(0, 4).toString() === "RIFF" &&
        buffer.slice(8, 12).toString() === "WEBP";

      if (!isJpeg && !isPng && !isWebP) {
        throw new BadRequestError(
          "Invalid image format (magic bytes check failed)",
        );
      }

      // ✅ Layer 3: Path sanitization
      const safeArtworkId = String(artworkId).replace(/[^a-zA-Z0-9]/g, "");

      const uploadDir = path.join(__dirname, "../../uploads/artworks");
      await fs.mkdir(uploadDir, { recursive: true });

      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const filename = `artwork-${safeArtworkId}-${timestamp}-${index}-${randomString}.webp`;
      const filepath = path.join(uploadDir, filename);

      await sharp(file.buffer)
        .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(filepath);

      const imageUrl = `/uploads/artworks/${filename}`;
      const key = `artwork-${safeArtworkId}-${timestamp}-${index}`;

      logger.info(`Artwork image uploaded: ${imageUrl}`);
      return { url: imageUrl, key, order: index };
    } catch (error) {
      logger.error("Error uploading artwork image:", error);
      if (error instanceof BadRequestError) throw error;
      throw new InternalServerError(M.general.serverError);
    }
  }

  // Upload multiple artwork images (alternative method)
  static async uploadArtworkImages(files, artworkId) {
    try {
      if (!files || files.length === 0)
        throw new BadRequestError(M.upload.noFiles);
      if (files.length > 10) throw new BadRequestError(M.upload.maxImages(10));

      const uploadPromises = files.map((file, index) =>
        this.uploadArtworkImage(file, artworkId, index),
      );

      const uploadedImages = await Promise.all(uploadPromises);
      logger.info(`Uploaded ${uploadedImages.length} artwork images`);
      return uploadedImages;
    } catch (error) {
      logger.error("Error uploading artwork images:", error);
      if (error instanceof BadRequestError) throw error;
      throw new InternalServerError(M.general.serverError);
    }
  }

  // Upload Cover Image (Artist Profile Banner)
  static async uploadCoverImage(file, userId) {
    try {
      if (!file) throw new BadRequestError(M.upload.noFile);
      if (!file.mimetype.startsWith("image/"))
        throw new BadRequestError(M.upload.mustBeImage);

      const buffer = file.buffer;
      const isJpeg =
        buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      const isPng =
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47;
      const isWebP =
        buffer.slice(0, 4).toString() === "RIFF" &&
        buffer.slice(8, 12).toString() === "WEBP";

      if (!isJpeg && !isPng && !isWebP) {
        throw new BadRequestError("الصورة غير صالحة");
      }

      const uploadDir = path.join(__dirname, "../../uploads/covers");
      await fs.mkdir(uploadDir, { recursive: true });

      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const filename = `cover-${userId}-${timestamp}-${randomString}.webp`;
      const filepath = path.join(uploadDir, filename);

      // صورة الغلاف: 1600×600 (landscape) مع crop للـ center
      await sharp(file.buffer)
        .resize(1600, 600, { fit: "cover", position: "center" })
        .webp({ quality: 85 })
        .toFile(filepath);

      const coverUrl = `/uploads/covers/${filename}`;
      logger.info(`Cover image uploaded: ${coverUrl}`);
      return coverUrl;
    } catch (error) {
      logger.error("Error uploading cover image:", error);
      if (error instanceof BadRequestError) throw error;
      throw new InternalServerError(M.general.serverError);
    }
  }

  // Delete single file
  static async deleteFile(fileUrl) {
    try {
      if (!fileUrl) return;

      const filename = fileUrl.split("/").pop();
      const folder = fileUrl.includes("avatars")
        ? "avatars"
        : fileUrl.includes("covers")
          ? "covers"
          : "artworks";
      const filepath = path.join(
        __dirname,
        `../../uploads/${folder}/${filename}`,
      );

      await fs.unlink(filepath);
      logger.info(`File deleted: ${fileUrl}`);
    } catch (error) {
      if (error.code === "ENOENT") {
        logger.warn(`File not found: ${fileUrl}`);
        return;
      }
      logger.error("Error deleting file:", error);
    }
  }

  // Delete single artwork image by key
  static async deleteImageByKey(key) {
    try {
      if (!key) return;

      const uploadDir = path.join(__dirname, "../../uploads/artworks");
      const files = await fs.readdir(uploadDir);

      // الـ key = artwork-{artworkId}-{timestamp}-{index}
      // الـ filename = {key}-{randomString}.webp
      // ⚠️ مهم: نـ match بـ `${key}-` (مش `key` بس) عشان نتجنب
      //    إن artwork-...-1 يـ match مع artwork-...-10 بالغلط
      const targetFile = files.find((file) => file.startsWith(`${key}-`));

      if (!targetFile) {
        logger.warn(`Image not found for key: ${key}`);
        return;
      }

      await fs.unlink(path.join(uploadDir, targetFile));
      logger.info(`🗑️ Image deleted by key: ${key} (${targetFile})`);
    } catch (error) {
      if (error.code === "ENOENT") {
        logger.warn(`Artworks directory not found`);
        return;
      }
      logger.error(`Error deleting image by key ${key}:`, error);
    }
  }

  // Delete multiple files
  static async deleteMultipleFiles(fileUrls) {
    if (!fileUrls || fileUrls.length === 0) return;
    await Promise.all(fileUrls.map((url) => this.deleteFile(url)));
    logger.info(`Deleted ${fileUrls.length} files`);
  }

  // Delete all artwork images by artworkId
  static async deleteArtworkImages(artworkId) {
  try {
    const uploadDir = path.join(__dirname, "../../uploads/artworks");
    const files = await fs.readdir(uploadDir);

    const safeArtworkId = String(artworkId).replace(/[^a-zA-Z0-9]/g, "");

    const artworkFiles = files.filter((file) =>
      file.startsWith(`artwork-${safeArtworkId}-`),
    );

    if (artworkFiles.length === 0) {
      logger.warn(`No files found for artwork: ${artworkId}`);
      return;
    }

    const deletePromises = artworkFiles.map((file) =>
      fs.unlink(path.join(uploadDir, file)),
    );
    await Promise.all(deletePromises);

    logger.info(`Deleted ${artworkFiles.length} files for artwork: ${artworkId}`);
  } catch (error) {
    if (error.code === "ENOENT") {
      logger.warn(`Artworks directory not found`);
      return;
    }
    logger.error("Error deleting artwork images:", error);
  }
}
}

module.exports = FileUploadService;
