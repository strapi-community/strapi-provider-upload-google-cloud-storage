import path from 'node:path';
import slugify from 'slugify';
import type { Bucket, Storage } from '@google-cloud/storage';
import type { DefaultOptions, File, FileAttributes, Options } from './types';

const getMetadata = (file: File, cacheMaxAge: number) => {
  const asciiFileName = file.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return {
    contentDisposition: `inline; filename="${asciiFileName}"`,
    cacheControl: `public, max-age=${cacheMaxAge}`,
  };
};

export const parseConfigField = <T = string | boolean>(
  fieldValue: T | undefined,
  defaultValue: T
) => {
  switch (typeof fieldValue) {
    case 'undefined':
      return defaultValue;
    case 'boolean':
      return fieldValue;
    case 'string':
      if (['true', 'false'].includes(fieldValue)) {
        return fieldValue === 'true';
      }
      return fieldValue;
    default:
      return defaultValue;
  }
};

export const getConfigDefaultValues = (config: DefaultOptions): Options => {
  if (!config?.bucketName) {
    throw new Error('"Bucket name" is required!');
  }

  return {
    ...config,
    baseUrl: config.baseUrl ?? 'https://storage.googleapis.com/{bucket-name}',
    basePath: config.basePath ?? '',
    publicFiles: parseConfigField(config.publicFiles, true),
    uniform: parseConfigField(config.uniform, false),
    skipCheckBucket: parseConfigField(config.skipCheckBucket, false),
    gzip: parseConfigField(config.gzip, 'auto'),
    cacheMaxAge: config.cacheMaxAge ?? 3600,
    metadata:
      typeof config.metadata === 'function'
        ? config.metadata
        : (file: File) => getMetadata(file, config.cacheMaxAge ?? 3600),
    getContentType:
      typeof config.getContentType === 'function'
        ? config.getContentType
        : (file: File) => file.mime,
  };
};

const parseServiceAccount = (serviceAccount: Options['serviceAccount']) => {
  try {
    return typeof serviceAccount === 'string' ? JSON.parse(serviceAccount) : serviceAccount;
  } catch (e) {
    throw new Error(
      'Error parsing data "Service Account JSON", please be sure to copy/paste the full JSON file.'
    );
  }
};

export const checkServiceAccount = (serviceAccount: Options['serviceAccount']) => {
  if (serviceAccount) {
    const gcsOptions = parseServiceAccount(serviceAccount);

    if (!gcsOptions.project_id) {
      throw new Error(
        'Error parsing data "Service Account JSON". Missing "project_id" field in JSON file.'
      );
    }
    if (!gcsOptions.client_email) {
      throw new Error(
        'Error parsing data "Service Account JSON". Missing "client_email" field in JSON file.'
      );
    }
    if (!gcsOptions.private_key) {
      throw new Error(
        'Error parsing data "Service Account JSON". Missing "private_key" field in JSON file.'
      );
    }

    return gcsOptions;
  }
};

export const generateUploadFileName = (basePath: string, file: File) => {
  const filePath = `${file.path ? file.path.slice(1) : file.hash}/`;
  const extension = file.ext?.toLowerCase() || '';
  const fileName = slugify(path.basename(file.hash));
  return `${basePath}${filePath}${fileName}${extension}`;
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
  const fullFileName =
    typeof config.generateUploadFileName === 'function'
      ? await config.generateUploadFileName(file)
      : generateUploadFileName(basePath, file);

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
