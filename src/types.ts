import type { FileMetadata } from '@google-cloud/storage';
import type { ReadStream } from 'node:fs';
import path from 'node:path';
import slugify from 'slugify';
import { z } from 'zod';

const fileSchema = z.object({
  name: z.string(),
  alternativeText: z.string().optional(),
  caption: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  formats: z.record(z.string(), z.unknown()).optional(),
  hash: z.string(),
  ext: z.string().optional(),
  mime: z.string(),
  size: z.number(),
  sizeInBytes: z.number(),
  url: z.string(),
  previewUrl: z.string().optional(),
  path: z.string().optional(),
  provider: z.string().optional(),
  provider_metadata: z.record(z.string(), z.unknown()).optional(),
  stream: z.unknown().optional(), // `ReadStream` can't be validated easily, so `any` or skip
  buffer: z.unknown().optional(), // same for `Buffer`
});

export type File = z.infer<typeof fileSchema> & {
  stream?: ReadStream;
  buffer?: Buffer;
};

export type FileAttributes = {
  contentType: string;
  gzip: Options['gzip'];
  metadata: FileMetadata;
  public?: boolean;
};

export const serviceAccountSchema = z.object({
  project_id: z.string({
    error: (issue) =>
      issue.input === undefined
        ? 'Error parsing data "Service Account JSON". Missing "project_id" field in JSON file.'
        : 'Error parsing data "Service Account JSON". Property "project_id" must be a string.',
  }),
  client_email: z.string({
    error: (issue) =>
      issue.input === undefined
        ? 'Error parsing data "Service Account JSON". Missing "client_email" field in JSON file.'
        : 'Error parsing data "Service Account JSON". Property "client_email" must be a string.',
  }),
  private_key: z.string({
    error: (issue) =>
      issue.input === undefined
        ? 'Error parsing data "Service Account JSON". Missing "private_key" field in JSON file.'
        : 'Error parsing data "Service Account JSON". Property "private_key" must be a string.',
  }),
});

export type ServiceAccount = z.infer<typeof serviceAccountSchema>;

type MetadataFn = (file: File) => FileMetadata;
type GetContentTypeFn = (file: File) => string;
type GenerateUploadFileNameFn = (basePath: string, file: File) => Promise<string> | string;

const defaultGetContentType = (file: File) => file.mime;

const defaultGenerateUploadFileName = (basePath: string, file: File) => {
  const filePath = `${file.path ? file.path.slice(1) : file.hash}/`;
  const extension = file.ext?.toLowerCase() || '';
  const fileName = slugify(path.basename(file.hash));
  return `${basePath}${filePath}${fileName}${extension}`;
};

export const optionsSchema = z.object({
  serviceAccount: z
    .preprocess((input) => {
      if (typeof input === 'string') {
        try {
          return JSON.parse(input);
        } catch {
          throw new Error(
            'Error parsing data "Service Account JSON", please be sure to copy/paste the full JSON file.'
          );
        }
      }
      return input;
    }, serviceAccountSchema)
    .optional(),
  bucketName: z.string({
    error: (issue) =>
      issue.input === undefined
        ? 'Property "bucketName" is required'
        : 'Property "bucketName" must be a string',
  }),
  baseUrl: z.string().default('https://storage.googleapis.com/{bucket-name}'),
  basePath: z.string().default(''),
  publicFiles: z.boolean().or(z.stringbool()).default(true),
  uniform: z.boolean().or(z.stringbool()).default(false),
  skipCheckBucket: z.boolean().or(z.stringbool()).default(false),
  gzip: z.boolean().or(z.stringbool()).or(z.literal('auto')).default('auto'),
  cacheMaxAge: z.number().default(3600),
  expires: z
    .union([
      z.string(),
      z.date(),
      z
        .number()
        .min(0)
        .max(1000 * 60 * 60 * 24 * 7),
    ])
    .default(15 * 60 * 1000),
  metadata: z.custom<MetadataFn>((val) => typeof val === 'function').optional(),
  getContentType: z
    .custom<GetContentTypeFn>((val) => typeof val === 'function')
    .optional()
    .default(() => defaultGetContentType),
  generateUploadFileName: z
    .custom<GenerateUploadFileNameFn>((val) => typeof val === 'function')
    .optional()
    .default(() => defaultGenerateUploadFileName),
});

export type Options = z.infer<typeof optionsSchema>;

export type DefaultOptions = Partial<Omit<Options, 'serviceAccount' | 'bucketName'>> & {
  bucketName: string;
  serviceAccount?: ServiceAccount | string;
};
