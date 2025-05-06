import type { Bucket, Storage } from '@google-cloud/storage';
import z from 'zod';
import {
  optionsSchema,
  type DefaultOptions,
  type File,
  type FileAttributes,
  type Options,
} from './types';

export const getConfigDefaultValues = (config: DefaultOptions) => {
  try {
    return optionsSchema.parse(config);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(err.issues[0]?.message);
    } else {
      throw err;
    }
  }
};

export const getExpires = (expires: Date | number | string) => {
  if (typeof expires === 'number') {
    return Date.now() + expires;
  }
  return expires;
};

export const checkBucket = async (bucket: Bucket, bucketName: string) => {
  const [exists] = await bucket.exists();
  if (!exists) {
    throw new Error(
      `An error occurs when we try to retrieve the Bucket "${bucketName}". Check if bucket exist on Google Cloud Platform.`
    );
  }
};

export const prepareUploadFile = async (
  file: File,
  config: Options,
  basePath: string,
  GCS: Storage
) => {
  const fullFileName = await config.generateUploadFileName(basePath, file);
  const bucket = GCS.bucket(config.bucketName);
  if (!config.skipCheckBucket) {
    await checkBucket(bucket, config.bucketName);
  }

  const bucketFile = bucket.file(fullFileName);
  const [fileExists] = await bucketFile.exists();

  const fileAttributes: FileAttributes = {
    contentType: config.getContentType(file),
    gzip: config.gzip,
    metadata: config.metadata(file),
  };

  if (!config.uniform) {
    fileAttributes.public = config.publicFiles;
  }

  return { fileAttributes, bucketFile, fullFileName, fileExists };
};
