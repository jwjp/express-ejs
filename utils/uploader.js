// modules/uploader.js

import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import createError from 'http-errors';
import crypto from 'crypto';

// Basic configuration
const config = {
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
  uploadPath: 'public/uploads'
};

// Local Storage
const localStorage = (destination) => async (file, customPath) => {
  const safeOriginalName = path.basename(file.originalname).replace(/[^\w.-]/g, '_');
  const filename = `${Date.now()}-${crypto.randomUUID()}-${safeOriginalName}`;
  const fullPath = path.join(destination, customPath);
  const filepath = path.join(fullPath, filename);

  await fs.mkdir(fullPath, { recursive: true });
  await fs.writeFile(filepath, file.buffer);

  return `/${path.relative('public', filepath).replace(/\\/g, '/')}`;
};

// AWS S3 Storage
const s3Storage = () => {
  return async (file, customPath) => {
    // TODO: npm install @aws-sdk/client-s3 @aws-sdk/lib-storage
    const { S3Client } = await import('@aws-sdk/client-s3');
    const { Upload } = await import('@aws-sdk/lib-storage');

    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const key = `${customPath}${Date.now()}-${file.originalname}`;
    await new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
      }
    }).done();

    return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  };
};

// NCP Object Storage
const ncpStorage = () => {
  return async (file, customPath) => {
    // TODO: npm install aws-sdk
    const AWS = await import('aws-sdk');

    // NCP는 AWS S3 호환 API를 사용합니다
    const s3 = new AWS.S3({
      endpoint: 'https://kr.object.ncloudstorage.com',
      region: 'kr-standard',
      credentials: {
        accessKeyId: process.env.NCP_ACCESS_KEY,
        secretAccessKey: process.env.NCP_SECRET_KEY
      }
    });
    const bucket = process.env.NCP_BUCKET;

    const key = `${customPath}${Date.now()}-${file.originalname}`;
    await s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype
    }).promise();

    return `https://${bucket}.kr.object.ncloudstorage.com/${key}`;
  };
};

// GCP Storage
const gcpStorage = () => {
  return async (file, customPath) => {
    // TODO: npm install @google-cloud/storage
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage();
    const bucket = storage.bucket(process.env.GCP_BUCKET);

    const filename = `${customPath}${Date.now()}-${file.originalname}`;
    const blob = bucket.file(filename);

    await blob.save(file.buffer, {
      contentType: file.mimetype,
      public: true,  // Make the file publicly accessible
      metadata: {
        cacheControl: 'public, max-age=31536000' // 1 year cache
      }
    });

    return blob.publicUrl();
  };
};

// Azure Blob Storage
const azureStorage = () => {
  return async (file, customPath) => {
    // TODO: npm install @azure/storage-blob
    const { BlobServiceClient } = await import('@azure/storage-blob');
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER);

    const blobName = `${customPath}${Date.now()}-${file.originalname}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.upload(file.buffer, file.buffer.length, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype,
        blobCacheControl: 'public, max-age=31536000'
      }
    });

    return blockBlobClient.url;
  };
};

// Storage selector
const getStorage = (type, destination) => {
  const storages = {
    's3': async () => { throw createError(501, 'AWS S3 storage is not currently configured.'); }, // s3Storage(),
    'ncp': async () => { throw createError(501, 'NCP storage is not currently configured.'); }, // ncpStorage(),
    'gcp': async () => { throw createError(501, 'GCP storage is not currently configured.'); }, // gcpStorage(),
    'azure': async () => { throw createError(501, 'Azure Blob storage is not currently configured.'); }, // azureStorage(),
    'local': localStorage(destination)
  };

  return storages[type] || storages.local;
};

// Create uploader
const createUploader = ({
                          destination = config.uploadPath,
                          fileSize = config.maxSize,
                          allowedTypes = config.allowedTypes,
                          storage = 'local',
                          customPath = ''
                        } = {}) => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize },
    fileFilter: (req, file, cb) => {
      allowedTypes.includes(file.mimetype)
        ? cb(null, true)
        : cb(createError(400, 'Unsupported file format.'), false);
    }
  });

  const uploadToStorage = getStorage(storage, destination);

  const handleUpload = async (req, res, next) => {
    try {
      if (!req.file && !req.files) return next();

      const files = req.files || [req.file];
      await Promise.all(
        files.map(async file => {
          file.location = await uploadToStorage(file, customPath);
        })
      );

      next();
    } catch (error) {
      next(error.status ? error : createError(500, 'File upload failed'));
    }
  };

  return {
    single: (fieldName) => [upload.single(fieldName), handleUpload],
    array: (fieldName, maxCount) => [upload.array(fieldName, maxCount), handleUpload]
  };
};

// Uploader
const uploader = {
  profile: createUploader({
    destination: 'public/uploads/profiles',
    fileSize: 1 * 1024 * 1024,
    storage: process.env.STORAGE_TYPE,
    customPath: 'images/'
  }),

  product: createUploader({
    destination: 'public/uploads/products',
    fileSize: 10 * 1024 * 1024,
    storage: process.env.STORAGE_TYPE,
    customPath: 'files/'
  }),

  sample: createUploader({
    destination: 'public/uploads/samples',
    fileSize: 2 * 1024 * 1024,
    storage: process.env.STORAGE_TYPE,
    customPath: 'images/'
  }),

  default: createUploader()
};

export default uploader;
