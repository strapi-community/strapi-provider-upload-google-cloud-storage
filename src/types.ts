import type { FileMetadata } from '@google-cloud/storage';
import type { ReadStream } from 'node:fs';

export interface File {
  name: string;
  alternativeText?: string;
  caption?: string;
  width?: number;
  height?: number;
  formats?: Record<string, unknown>;
  hash: string;
  ext?: string;
  mime: string;
  size: number;
  sizeInBytes: number;
  url: string;
  previewUrl?: string;
  path?: string;
  provider?: string;
  provider_metadata?: Record<string, unknown>;
  stream?: ReadStream;
  buffer?: Buffer;
}

export type FileAttributes = {
  contentType: string;
  gzip: Options['gzip'];
  metadata: FileMetadata;
  public?: boolean;
};

export type DefaultOptions = {
  serviceAccount?: string | object;
  bucketName: string;
  baseUrl?: string;
  basePath?: string;
  publicFiles?: boolean;
  uniform?: boolean;
  skipCheckBucket?: boolean;
  cacheMaxAge?: number;
  gzip?: boolean | 'auto';
  expires?: Date | number | string;
  metadata?: (file: File) => FileMetadata;
  generateUploadFileName?: (file: File) => Promise<string>;
  getContentType?: (file: File) => string;
};

export type Options = Required<
  Pick<
    DefaultOptions,
    | 'baseUrl'
    | 'basePath'
    | 'publicFiles'
    | 'uniform'
    | 'skipCheckBucket'
    | 'gzip'
    | 'cacheMaxAge'
    | 'metadata'
    | 'getContentType'
  >
> &
  DefaultOptions;
