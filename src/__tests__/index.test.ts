import { Storage } from '@google-cloud/storage';
import slugify from 'slugify';
import path from 'path';
import { Readable } from 'stream';
import type { ReadStream } from 'fs';
import { pipeline } from 'node:stream/promises';
import type { File } from '../types';
import provider from '../index';

const mockedConfig = {
  serviceAccount: {
    project_id: '123',
    client_email: 'my@email.org',
    private_key: 'a random key',
  },
  bucketName: 'any',
  basePath: '/base/path',
  cacheMaxAge: 3600,
};

const mockedFileData = {
  ext: '.JPEG',
  buffer: Buffer.from('file buffer information'),
  mime: 'image/jpeg',
  name: 'people coding.JPEG',
  hash: '4l0ngH45h',
  path: '/tmp/strapi',
  size: 985.43,
  sizeInBytes: 98543,
  url: '/',
};

const mockedFileStreamData = {
  ext: '.JPEG',
  buffer: Buffer.from('file buffer information'),
  mime: 'image/jpeg',
  name: 'people coding.JPEG',
  hash: '4l0ngH45h',
  path: '/tmp/strapi',
  size: 985.43,
  sizeInBytes: 98543,
  url: '/',
  stream: Readable.from(Buffer.from('file buffer information')) as unknown as ReadStream,
};

const mockedFile = {
  exists: jest.fn().mockReturnValue([false]),
  save: jest.fn(),
  createWriteStream: jest.fn().mockReturnValue('STREAM'),
  delete: jest.fn(),
  getSignedUrl: jest
    .fn()
    .mockReturnValue(['https://storage.googleapis.com/my-bucket/o/people-working.png']),
};

const mockedBucket = {
  exists: jest.fn().mockReturnValue([true]),
  file: jest.fn(() => mockedFile),
};

const mockedStorage = {
  bucket: jest.fn(() => mockedBucket),
};

jest.mock('@google-cloud/storage', () => ({
  __esModule: true,
  Storage: jest.fn(() => mockedStorage),
}));

jest.mock('node:stream/promises', () => ({
  pipeline: jest.fn(),
}));

describe('Provider', () => {
  beforeEach(() => {
    mockedFileData.url = '/';
    mockedFileData.mime = 'image/jpeg';
    mockedFileStreamData.mime = 'image/jpeg';
    jest.clearAllMocks();
  });

  describe('Init', () => {
    test('Provides object with upload, uploadStream, delete, isPrivate and getSignedUrl methods', () => {
      const result = provider.init(mockedConfig);
      expect(result).toHaveProperty('upload');
      expect(typeof result.upload).toEqual('function');
      expect(result).toHaveProperty('uploadStream');
      expect(typeof result.uploadStream).toEqual('function');
      expect(result).toHaveProperty('delete');
      expect(typeof result.delete).toEqual('function');
      expect(result).toHaveProperty('isPrivate');
      expect(typeof result.isPrivate).toEqual('function');
      expect(result).toHaveProperty('getSignedUrl');
      expect(typeof result.getSignedUrl).toEqual('function');
    });
  });

  describe('Google Cloud Storage', () => {
    test('Creates instance of google cloud storage with right configurations', () => {
      provider.init(mockedConfig);
      expect(Storage).toHaveBeenCalledWith({
        projectId: mockedConfig.serviceAccount.project_id,
        credentials: {
          client_email: mockedConfig.serviceAccount.client_email,
          private_key: mockedConfig.serviceAccount.private_key,
        },
      });
    });

    test('Creates instance of google cloud storage without configuration', () => {
      const config = {
        bucketName: 'any',
      };

      provider.init(config);
      expect(Storage).toHaveBeenCalledWith(undefined);
    });
  });

  describe('Upload', () => {
    test('Saves file with default values', async () => {
      const providerInstance = provider.init(mockedConfig);
      await providerInstance.upload(mockedFileData);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.exists).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.exists).toHaveBeenCalledTimes(1);
      expect(mockedFile.save).toHaveBeenCalledTimes(1);
      expect(mockedFile.save).toHaveBeenCalledWith(mockedFileData.buffer, {
        contentType: 'image/jpeg',
        gzip: 'auto',
        metadata: {
          cacheControl: 'public, max-age=3600',
          contentDisposition: 'inline; filename="people coding.JPEG"',
        },
        public: true,
      });
      // Verify that file.mime is updated to the content type used (should be same as original)
      expect(mockedFileData.mime).toEqual('image/jpeg');
    });

    test('Saves file with custom metadata', async () => {
      const config = {
        ...mockedConfig,
        metadata: (file: File) => ({
          cacheControl: `public, max-age=${60 * 60 * 24 * 7}`,
          contentLanguage: 'en-US',
          contentDisposition: `attachment; filename="${file.name}"`,
        }),
      };
      const providerInstance = provider.init(config);
      await providerInstance.upload(mockedFileData);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.exists).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.exists).toHaveBeenCalledTimes(1);
      expect(mockedFile.save).toHaveBeenCalledTimes(1);
      expect(mockedFile.save).toHaveBeenCalledWith(mockedFileData.buffer, {
        gzip: 'auto',
        contentType: 'image/jpeg',
        metadata: {
          cacheControl: 'public, max-age=604800',
          contentLanguage: 'en-US',
          contentDisposition: 'attachment; filename="people coding.JPEG"',
        },
        public: true,
      });
    });

    test('Saves file with custom (async) file name generator', async () => {
      const config = {
        ...mockedConfig,
        async generateUploadFileName(basePath: string, file: File) {
          const hash = await new Promise((resolve) => {
            setTimeout(() => resolve('da2f32c2de25f0360d6a5e129dcf9cbc'), 0);
          });
          const extension = file.ext?.toLowerCase().substring(1);
          return `${extension}/${slugify(path.parse(file.name).name)}-${hash}.${extension}`;
        },
      };
      const providerInstance = provider.init(config);
      await providerInstance.upload(mockedFileData);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.exists).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledWith(
        'jpeg/people-coding-da2f32c2de25f0360d6a5e129dcf9cbc.jpeg'
      );
      expect(mockedFile.exists).toHaveBeenCalledTimes(1);
      expect(mockedFile.save).toHaveBeenCalledTimes(1);
      expect(mockedFile.save).toHaveBeenCalledWith(mockedFileData.buffer, {
        contentType: 'image/jpeg',
        gzip: 'auto',
        metadata: {
          cacheControl: 'public, max-age=3600',
          contentDisposition: 'inline; filename="people coding.JPEG"',
        },
        public: true,
      });
    });

    test('Saves file with forced gzip', async () => {
      const config = {
        ...mockedConfig,
        gzip: true,
      };
      const providerInstance = provider.init(config);
      await providerInstance.upload(mockedFileData);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.exists).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.exists).toHaveBeenCalledTimes(1);
      expect(mockedFile.save).toHaveBeenCalledTimes(1);
      expect(mockedFile.save).toHaveBeenCalledWith(mockedFileData.buffer, {
        contentType: 'image/jpeg',
        gzip: true,
        metadata: {
          cacheControl: 'public, max-age=3600',
          contentDisposition: 'inline; filename="people coding.JPEG"',
        },
        public: true,
      });
    });

    test('Saves file with custom content type', async () => {
      const config = {
        ...mockedConfig,
        getContentType: () => 'application/x-test',
      };
      const providerInstance = provider.init(config);
      await providerInstance.upload(mockedFileData);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.exists).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.exists).toHaveBeenCalledTimes(1);
      expect(mockedFile.save).toHaveBeenCalledTimes(1);
      expect(mockedFile.save).toHaveBeenCalledWith(mockedFileData.buffer, {
        contentType: 'application/x-test',
        gzip: 'auto',
        metadata: {
          cacheControl: 'public, max-age=3600',
          contentDisposition: 'inline; filename="people coding.JPEG"',
        },
        public: true,
      });
      expect(mockedFileData.mime).toEqual('application/x-test');
    });

    test('Saves file with custom cacheMaxAge', async () => {
      const config = {
        ...mockedConfig,
        cacheMaxAge: 7200, // 2 hours
      };
      const providerInstance = provider.init(config);
      await providerInstance.upload(mockedFileData);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.exists).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.exists).toHaveBeenCalledTimes(1);
      expect(mockedFile.save).toHaveBeenCalledTimes(1);
      expect(mockedFile.save).toHaveBeenCalledWith(mockedFileData.buffer, {
        contentType: 'image/jpeg',
        gzip: 'auto',
        metadata: {
          cacheControl: 'public, max-age=7200',
          contentDisposition: 'inline; filename="people coding.JPEG"',
        },
        public: true,
      });
    });

    test('Saves file with default cacheMaxAge when not specified', async () => {
      const config = {
        serviceAccount: {
          project_id: '123',
          client_email: 'my@email.org',
          private_key: 'a random key',
        },
        bucketName: 'any',
        basePath: '/base/path',
        // No cacheMaxAge specified - should use default value
      };
      const providerInstance = provider.init(config);
      await providerInstance.upload(mockedFileData);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.exists).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.exists).toHaveBeenCalledTimes(1);
      expect(mockedFile.save).toHaveBeenCalledTimes(1);
      expect(mockedFile.save).toHaveBeenCalledWith(mockedFileData.buffer, {
        contentType: 'image/jpeg',
        gzip: 'auto',
        metadata: {
          cacheControl: 'public, max-age=3600', // Default value
          contentDisposition: 'inline; filename="people coding.JPEG"',
        },
        public: true,
      });
    });

    test('Deletes file and save a new one if file exists in bucket', async () => {
      mockedFile.exists = jest.fn(() => [true]);

      const providerInstance = provider.init(mockedConfig);
      await providerInstance.upload(mockedFileData);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(2);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.exists).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledTimes(2);
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.exists).toHaveBeenCalledTimes(1);
      expect(mockedFile.delete).toHaveBeenCalledTimes(1);
      expect(mockedFile.save).toHaveBeenCalledTimes(1);
      expect(mockedFile.save).toHaveBeenCalledWith(mockedFileData.buffer, {
        contentType: 'image/jpeg',
        gzip: 'auto',
        metadata: {
          cacheControl: 'public, max-age=3600',
          contentDisposition: 'inline; filename="people coding.JPEG"',
        },
        public: true,
      });

      mockedFile.exists = jest.fn(() => [false]);
    });

    test('Throws error if bucket does not exist', async () => {
      mockedBucket.exists = jest.fn(() => [false]);

      const providerInstance = provider.init(mockedConfig);

      const error = new Error(
        `An error occurs when we try to retrieve the Bucket "${mockedConfig.bucketName}". Check if bucket exist on Google Cloud Platform.`
      );

      await expect(providerInstance.upload(mockedFileData)).rejects.toThrow(error);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.exists).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).not.toHaveBeenCalled();
      expect(mockedFile.exists).not.toHaveBeenCalled();
      expect(mockedFile.delete).not.toHaveBeenCalled();
      expect(mockedFile.save).not.toHaveBeenCalled();

      mockedBucket.exists = jest.fn(() => [true]);
    });
  });

  describe('UploadStream', () => {
    test('Saves file with default values', async () => {
      const providerInstance = provider.init(mockedConfig);
      await providerInstance.uploadStream(mockedFileStreamData);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.exists).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.exists).toHaveBeenCalledTimes(1);
      expect(mockedFile.createWriteStream).toHaveBeenCalledTimes(1);
      expect(mockedFile.createWriteStream).toHaveBeenCalledWith({
        contentType: 'image/jpeg',
        gzip: 'auto',
        metadata: {
          cacheControl: 'public, max-age=3600',
          contentDisposition: 'inline; filename="people coding.JPEG"',
        },
        public: true,
      });
      expect(pipeline).toHaveBeenCalledTimes(1);
      expect(pipeline).toHaveBeenCalledWith(mockedFileStreamData.stream, 'STREAM');
    });

    test('Deletes file and save a new one if file exists in bucket', async () => {
      mockedFile.exists = jest.fn(() => [true]);

      const providerInstance = provider.init(mockedConfig);
      await providerInstance.uploadStream(mockedFileStreamData);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(2);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.exists).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledTimes(2);
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.exists).toHaveBeenCalledTimes(1);
      expect(mockedFile.delete).toHaveBeenCalledTimes(1);
      expect(mockedFile.createWriteStream).toHaveBeenCalledTimes(1);
      expect(mockedFile.createWriteStream).toHaveBeenCalledWith({
        contentType: 'image/jpeg',
        gzip: 'auto',
        metadata: {
          cacheControl: 'public, max-age=3600',
          contentDisposition: 'inline; filename="people coding.JPEG"',
        },
        public: true,
      });
      expect(pipeline).toHaveBeenCalledTimes(1);
      expect(pipeline).toHaveBeenCalledWith(mockedFileStreamData.stream, 'STREAM');

      mockedFile.exists = jest.fn(() => [false]);
    });

    test('Saves file stream with custom cacheMaxAge', async () => {
      const config = {
        ...mockedConfig,
        cacheMaxAge: 7200, // 2 hours
      };
      const providerInstance = provider.init(config);
      await providerInstance.uploadStream(mockedFileStreamData);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.exists).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.exists).toHaveBeenCalledTimes(1);
      expect(mockedFile.createWriteStream).toHaveBeenCalledTimes(1);
      expect(mockedFile.createWriteStream).toHaveBeenCalledWith({
        contentType: 'image/jpeg',
        gzip: 'auto',
        metadata: {
          cacheControl: 'public, max-age=7200',
          contentDisposition: 'inline; filename="people coding.JPEG"',
        },
        public: true,
      });
      expect(pipeline).toHaveBeenCalledTimes(1);
      expect(pipeline).toHaveBeenCalledWith(mockedFileStreamData.stream, 'STREAM');
    });

    test('Saves file stream with custom content type and updates file.mime', async () => {
      const config = {
        ...mockedConfig,
        getContentType: () => 'application/x-stream-test',
      };
      const providerInstance = provider.init(config);
      await providerInstance.uploadStream(mockedFileStreamData);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.exists).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.exists).toHaveBeenCalledTimes(1);
      expect(mockedFile.createWriteStream).toHaveBeenCalledTimes(1);
      expect(mockedFile.createWriteStream).toHaveBeenCalledWith({
        contentType: 'application/x-stream-test',
        gzip: 'auto',
        metadata: {
          cacheControl: 'public, max-age=3600',
          contentDisposition: 'inline; filename="people coding.JPEG"',
        },
        public: true,
      });
      expect(pipeline).toHaveBeenCalledTimes(1);
      expect(pipeline).toHaveBeenCalledWith(mockedFileStreamData.stream, 'STREAM');
      // Verify that file.mime is updated to match the custom content type
      expect(mockedFileStreamData.mime).toEqual('application/x-stream-test');
    });

    test('Throws error if bucket does not exist', async () => {
      mockedBucket.exists = jest.fn(() => [false]);

      const providerInstance = provider.init(mockedConfig);

      const error = new Error(
        `An error occurs when we try to retrieve the Bucket "${mockedConfig.bucketName}". Check if bucket exist on Google Cloud Platform.`
      );

      await expect(providerInstance.uploadStream(mockedFileStreamData)).rejects.toThrow(error);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.exists).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).not.toHaveBeenCalled();
      expect(mockedFile.exists).not.toHaveBeenCalled();
      expect(mockedFile.delete).not.toHaveBeenCalled();
      expect(mockedFile.save).not.toHaveBeenCalled();

      mockedBucket.exists = jest.fn(() => [true]);
    });
  });

  describe('Delete', () => {
    test('Deletes file', async () => {
      mockedFileData.url = 'base/path/tmp/strapi/4l0ngH45h.jpeg';
      const providerInstance = provider.init(mockedConfig);
      await providerInstance.delete(mockedFileData);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.delete).toHaveBeenCalledTimes(1);
    });

    test('Does not delete file, if url is not provided', async () => {
      mockedFileData.url = '';
      const providerInstance = provider.init(mockedConfig);
      await providerInstance.delete(mockedFileData);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(0);
      expect(mockedBucket.file).toHaveBeenCalledTimes(0);
      expect(mockedFile.delete).toHaveBeenCalledTimes(0);
    });

    test('Throws error if file cannot be deleted', async () => {
      const error = new Error('Error deleting file');
      mockedFile.delete = jest.fn().mockImplementation(() => {
        throw error;
      });
      mockedFileData.url = 'base/path/tmp/strapi/4l0ngH45h.jpeg';

      const providerInstance = provider.init(mockedConfig);
      expect(providerInstance.delete(mockedFileData)).rejects.toThrow(error);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.delete).toHaveBeenCalledTimes(1);

      mockedFile.delete = jest.fn();
    });

    test('Throws and logs error if file cannot be found', async () => {
      const error = new Error('Error deleting file');
      // @ts-expect-error Simulate 404 response from server
      error.code = 404;
      const customError = new Error('Remote file was not found, you may have to delete manually.');
      mockedFile.delete = jest.fn().mockImplementation(() => {
        throw error;
      });
      mockedFileData.url = 'base/path/tmp/strapi/4l0ngH45h.jpeg';

      const providerInstance = provider.init(mockedConfig);
      expect(providerInstance.delete(mockedFileData)).rejects.toThrow(customError);

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Is private', () => {
    test('Returns true if files are not public', () => {
      const providerInstance = provider.init({
        ...mockedConfig,
        publicFiles: false,
      });
      expect(providerInstance.isPrivate()).toEqual(true);
    });

    test('Returns false if files are public', () => {
      const providerInstance = provider.init({
        ...mockedConfig,
        publicFiles: true,
      });
      expect(providerInstance.isPrivate()).toEqual(false);
    });

    test('Returns false by default', () => {
      const providerInstance = provider.init({
        ...mockedConfig,
      });
      expect(providerInstance.isPrivate()).toEqual(false);
    });
  });

  describe('Get signed url', () => {
    test('Calls signed url with default values', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2020-01-01'));
      mockedFileData.url = 'base/path/tmp/strapi/4l0ngH45h.jpeg';

      const providerInstance = provider.init(mockedConfig);
      expect(providerInstance.getSignedUrl(mockedFileData)).resolves.toEqual({
        url: 'https://storage.googleapis.com/my-bucket/o/people-working.png',
      });

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.getSignedUrl).toHaveBeenCalledTimes(1);
      expect(mockedFile.getSignedUrl).toHaveBeenCalledWith({
        version: 'v4',
        action: 'read',
        expires: new Date('2020-01-01').valueOf() + 15 * 60 * 1000,
      });
    });

    test('Calls signed url with custom expire', async () => {
      mockedFileData.url = 'base/path/tmp/strapi/4l0ngH45h.jpeg';

      const providerInstance = provider.init({
        ...mockedConfig,
        expires: 1000,
      });
      expect(providerInstance.getSignedUrl(mockedFileData)).resolves.toEqual({
        url: 'https://storage.googleapis.com/my-bucket/o/people-working.png',
      });

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedStorage.bucket).toHaveBeenCalledWith(mockedConfig.bucketName);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.getSignedUrl).toHaveBeenCalledTimes(1);
      expect(mockedFile.getSignedUrl).toHaveBeenCalledWith({
        version: 'v4',
        action: 'read',
        expires: new Date('2020-01-01').valueOf() + 1000,
      });
    });

    test('Throws error when no service account and private files', async () => {
      mockedFileData.url = 'base/path/tmp/strapi/4l0ngH45h.jpeg';

      const configWithoutServiceAccount = {
        bucketName: 'my-bucket',
        publicFiles: false,
        baseUrl: 'https://storage.googleapis.com/{bucket-name}',
        basePath: 'base/path',
      };

      // Mock a signing error to simulate ADC not working in non-GCP environment
      const signingError = new Error('Cannot sign data without client_email');
      mockedFile.getSignedUrl = jest.fn().mockRejectedValue(signingError);

      const providerInstance = provider.init(configWithoutServiceAccount);

      // Mock detectGCPEnvironment to return false (non-GCP environment)
      providerInstance.detectGCPEnvironment = jest.fn().mockReturnValue(false);

      await expect(providerInstance.getSignedUrl(mockedFileData)).rejects.toThrow(
        'Cannot generate signed URLs without service account credentials. ' +
          'Either:\n' +
          '1. Provide serviceAccount with client_email and private_key in your configuration, or\n' +
          '2. Set publicFiles to true to use direct URLs instead of signed URLs.\n' +
          'For more information, see: https://github.com/strapi-community/strapi-provider-upload-google-cloud-storage#setting-up-google-authentication'
      );

      expect(mockedStorage.bucket).toHaveBeenCalled();
      expect(mockedBucket.file).toHaveBeenCalled();
      expect(mockedFile.getSignedUrl).toHaveBeenCalled();

      // Restore mock
      mockedFile.getSignedUrl = jest
        .fn()
        .mockReturnValue(['https://storage.googleapis.com/my-bucket/o/people-working.png']);
    });

    test('Returns direct URL when no service account but public files', async () => {
      mockedFileData.url =
        'https://storage.googleapis.com/my-bucket/base/path/tmp/strapi/4l0ngH45h.jpeg';

      const configWithoutServiceAccount = {
        bucketName: 'my-bucket',
        publicFiles: true,
        baseUrl: 'https://storage.googleapis.com/{bucket-name}',
        basePath: 'base/path',
      };

      // Mock a signing error to simulate ADC not working in non-GCP environment
      const signingError = new Error('Cannot sign data without client_email');
      mockedFile.getSignedUrl = jest.fn().mockRejectedValue(signingError);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const providerInstance = provider.init(configWithoutServiceAccount);

      // Mock detectGCPEnvironment to return false (non-GCP environment)
      providerInstance.detectGCPEnvironment = jest.fn().mockReturnValue(false);

      const result = await providerInstance.getSignedUrl(mockedFileData);

      expect(result).toEqual({
        url: 'https://storage.googleapis.com/my-bucket/base/path/tmp/strapi/4l0ngH45h.jpeg',
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Warning: Cannot generate signed URL without service account credentials. ' +
          'Returning direct URL instead. This works only for public files.'
      );

      expect(mockedStorage.bucket).toHaveBeenCalled();
      expect(mockedBucket.file).toHaveBeenCalled();
      expect(mockedFile.getSignedUrl).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();

      // Restore mock
      mockedFile.getSignedUrl = jest
        .fn()
        .mockReturnValue(['https://storage.googleapis.com/my-bucket/o/people-working.png']);
    });

    test('Throws error when service account lacks client_email and private files', async () => {
      mockedFileData.url = 'base/path/tmp/strapi/4l0ngH45h.jpeg';

      const configWithIncompleteServiceAccount = {
        bucketName: 'my-bucket',
        publicFiles: false,
        baseUrl: 'https://storage.googleapis.com/{bucket-name}',
        basePath: 'base/path',
        serviceAccount: {
          project_id: 'test-project',
          private_key: 'test-key',
          client_email: '', // empty client_email
        },
      };

      // Mock a signing error to simulate incomplete credentials
      const signingError = new Error('Cannot sign data without client_email');
      mockedFile.getSignedUrl = jest.fn().mockRejectedValue(signingError);

      const providerInstance = provider.init(configWithIncompleteServiceAccount);

      // Mock detectGCPEnvironment to return false (non-GCP environment)
      providerInstance.detectGCPEnvironment = jest.fn().mockReturnValue(false);

      await expect(providerInstance.getSignedUrl(mockedFileData)).rejects.toThrow(
        'Cannot generate signed URLs without service account credentials'
      );

      expect(mockedStorage.bucket).toHaveBeenCalled();
      expect(mockedBucket.file).toHaveBeenCalled();
      expect(mockedFile.getSignedUrl).toHaveBeenCalled();

      // Restore mock
      mockedFile.getSignedUrl = jest
        .fn()
        .mockReturnValue(['https://storage.googleapis.com/my-bucket/o/people-working.png']);
    });

    test('Returns direct URL when service account lacks client_email but public files', async () => {
      mockedFileData.url =
        'https://storage.googleapis.com/my-bucket/base/path/tmp/strapi/4l0ngH45h.jpeg';

      const configWithIncompleteServiceAccount = {
        bucketName: 'my-bucket',
        publicFiles: true,
        baseUrl: 'https://storage.googleapis.com/{bucket-name}',
        basePath: 'base/path',
        serviceAccount: {
          project_id: 'test-project',
          private_key: 'test-key',
          client_email: '', // empty client_email
        },
      };

      // Mock a signing error to simulate incomplete credentials
      const signingError = new Error('Cannot sign data without client_email');
      mockedFile.getSignedUrl = jest.fn().mockRejectedValue(signingError);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const providerInstance = provider.init(configWithIncompleteServiceAccount);

      // Mock detectGCPEnvironment to return false (non-GCP environment)
      providerInstance.detectGCPEnvironment = jest.fn().mockReturnValue(false);

      const result = await providerInstance.getSignedUrl(mockedFileData);

      expect(result).toEqual({
        url: 'https://storage.googleapis.com/my-bucket/base/path/tmp/strapi/4l0ngH45h.jpeg',
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Warning: Cannot generate signed URL without service account credentials. ' +
          'Returning direct URL instead. This works only for public files.'
      );

      expect(mockedStorage.bucket).toHaveBeenCalled();
      expect(mockedBucket.file).toHaveBeenCalled();
      expect(mockedFile.getSignedUrl).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();

      // Restore mock
      mockedFile.getSignedUrl = jest
        .fn()
        .mockReturnValue(['https://storage.googleapis.com/my-bucket/o/people-working.png']);
    });

    test('Works with ADC in GCP environment without explicit service account', async () => {
      mockedFileData.url = 'base/path/tmp/strapi/4l0ngH45h.jpeg';

      const configWithoutServiceAccount = {
        bucketName: 'my-bucket',
        publicFiles: false,
        baseUrl: 'https://storage.googleapis.com/{bucket-name}',
        basePath: 'base/path',
      };

      const providerInstance = provider.init(configWithoutServiceAccount);

      // Mock detectGCPEnvironment to return true (GCP environment)
      providerInstance.detectGCPEnvironment = jest.fn().mockReturnValue(true);

      const result = await providerInstance.getSignedUrl(mockedFileData);

      expect(result).toEqual({
        url: 'https://storage.googleapis.com/my-bucket/o/people-working.png',
      });

      expect(mockedStorage.bucket).toHaveBeenCalled();
      expect(mockedBucket.file).toHaveBeenCalled();
      expect(mockedFile.getSignedUrl).toHaveBeenCalled();
    });

    test('Throws specific error for GCP environment when ADC fails', async () => {
      mockedFileData.url = 'base/path/tmp/strapi/4l0ngH45h.jpeg';

      const configWithoutServiceAccount = {
        bucketName: 'my-bucket',
        publicFiles: false,
        baseUrl: 'https://storage.googleapis.com/{bucket-name}',
        basePath: 'base/path',
      };

      // Mock a signing error to simulate ADC failure in GCP environment
      const signingError = new Error('Cannot sign data without client_email');
      mockedFile.getSignedUrl = jest.fn().mockRejectedValue(signingError);

      const providerInstance = provider.init(configWithoutServiceAccount);

      // Mock detectGCPEnvironment to return true (GCP environment)
      providerInstance.detectGCPEnvironment = jest.fn().mockReturnValue(true);

      await expect(providerInstance.getSignedUrl(mockedFileData)).rejects.toThrow(
        'Failed to generate signed URL in GCP environment: Cannot sign data without client_email\n' +
          'This may indicate that your GCP service account lacks the necessary permissions for URL signing. ' +
          'Please ensure your service account has the "Storage Object Admin" or "Storage Admin" role.'
      );

      expect(mockedStorage.bucket).toHaveBeenCalled();
      expect(mockedBucket.file).toHaveBeenCalled();
      expect(mockedFile.getSignedUrl).toHaveBeenCalled();

      // Restore mock
      mockedFile.getSignedUrl = jest
        .fn()
        .mockReturnValue(['https://storage.googleapis.com/my-bucket/o/people-working.png']);
    });

    test('Detects GCP environment correctly', () => {
      const providerInstance = provider.init(mockedConfig);

      // Test with GCP environment variables
      const originalEnv = process.env;
      process.env = { ...originalEnv, GOOGLE_CLOUD_PROJECT: 'test-project' };

      expect(providerInstance.detectGCPEnvironment()).toBe(true);

      process.env = { ...originalEnv, GAE_APPLICATION: 'test-app' };
      expect(providerInstance.detectGCPEnvironment()).toBe(true);

      process.env = { ...originalEnv, K_SERVICE: 'test-service' };
      expect(providerInstance.detectGCPEnvironment()).toBe(true);

      process.env = { ...originalEnv, FUNCTION_NAME: 'test-function' };
      expect(providerInstance.detectGCPEnvironment()).toBe(true);

      // Test without GCP environment variables
      process.env = { ...originalEnv };
      delete process.env.GOOGLE_CLOUD_PROJECT;
      delete process.env.GAE_APPLICATION;
      delete process.env.K_SERVICE;
      delete process.env.FUNCTION_NAME;
      delete process.env.GCE_METADATA_HOST;
      delete process.env.KUBERNETES_SERVICE_HOST;

      expect(providerInstance.detectGCPEnvironment()).toBe(false);

      // Restore environment
      process.env = originalEnv;
    });

    test('Handles signing errors with helpful message', async () => {
      mockedFileData.url = 'base/path/tmp/strapi/4l0ngH45h.jpeg';

      const signingError = new Error('Cannot sign data without client_email');
      mockedFile.getSignedUrl = jest.fn().mockRejectedValue(signingError);

      const providerInstance = provider.init(mockedConfig);

      // Mock detectGCPEnvironment to return false (non-GCP environment with explicit service account)
      providerInstance.detectGCPEnvironment = jest.fn().mockReturnValue(false);

      await expect(providerInstance.getSignedUrl(mockedFileData)).rejects.toThrow(
        'Failed to generate signed URL: Cannot sign data without client_email\n' +
          'This usually means your service account credentials are incomplete. ' +
          'Please ensure your serviceAccount configuration includes both client_email and private_key fields.'
      );

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedFile.getSignedUrl).toHaveBeenCalledTimes(1);

      // Restore mock
      mockedFile.getSignedUrl = jest
        .fn()
        .mockReturnValue(['https://storage.googleapis.com/my-bucket/o/people-working.png']);
    });

    test('Re-throws non-signing errors without modification', async () => {
      mockedFileData.url = 'base/path/tmp/strapi/4l0ngH45h.jpeg';

      const genericError = new Error('Some other error');
      mockedFile.getSignedUrl = jest.fn().mockRejectedValue(genericError);

      const providerInstance = provider.init(mockedConfig);

      await expect(providerInstance.getSignedUrl(mockedFileData)).rejects.toThrow(
        'Some other error'
      );

      expect(mockedStorage.bucket).toHaveBeenCalledTimes(1);
      expect(mockedBucket.file).toHaveBeenCalledTimes(1);
      expect(mockedFile.getSignedUrl).toHaveBeenCalledTimes(1);

      // Restore mock
      mockedFile.getSignedUrl = jest
        .fn()
        .mockReturnValue(['https://storage.googleapis.com/my-bucket/o/people-working.png']);
    });

    test('Uses file.path instead of file.url to prevent double signing', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2020-01-01'));

      // Simulate a file with both path and url (where url might be signed)
      const fileWithPath = {
        ...mockedFileData,
        path: '/tmp/strapi',
        url: 'https://storage.googleapis.com/my-bucket/base/path/tmp/strapi/4l0ngH45h.jpeg?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=...', // signed URL
      };

      const providerInstance = provider.init(mockedConfig);
      await providerInstance.getSignedUrl(fileWithPath);

      // Should use the reconstructed path from file.path, not the signed URL
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.getSignedUrl).toHaveBeenCalledWith({
        version: 'v4',
        action: 'read',
        expires: new Date('2020-01-01').valueOf() + 15 * 60 * 1000,
      });
    });

    test('Falls back to file.url when file.path is missing', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2020-01-01'));

      // File without path property
      const fileWithoutPath = {
        ...mockedFileData,
        url: 'base/path/tmp/strapi/4l0ngH45h.jpeg',
        path: undefined,
      };

      const providerInstance = provider.init(mockedConfig);
      await providerInstance.getSignedUrl(fileWithoutPath);

      expect(mockedBucket.file).toHaveBeenCalledWith('tmp/strapi/4l0ngH45h.jpeg');
    });

    test('Handles signed URLs in file.url when file.path is missing', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2020-01-01'));

      // File with signed URL but no path
      const fileWithSignedUrl = {
        ...mockedFileData,
        url: 'https://storage.googleapis.com/my-bucket/base/path/tmp/strapi/4l0ngH45h.jpeg?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=test@project.iam.gserviceaccount.com%2F20240101%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20240101T000000Z&X-Goog-Expires=900&X-Goog-SignedHeaders=host&X-Goog-Signature=...',
        path: undefined,
      };

      const providerInstance = provider.init(mockedConfig);
      await providerInstance.getSignedUrl(fileWithSignedUrl);

      expect(mockedBucket.file).toHaveBeenCalledWith('4l0ngH45h/4l0ngH45h.jpeg');
    });
  });

  describe('Delete with path-based filename resolution', () => {
    beforeEach(() => {
      // Reset mock to not throw 404 error for these tests
      mockedFile.delete = jest.fn();
    });

    test('Uses file.path instead of file.url to prevent double signing', async () => {
      // Simulate a file with both path and url (where url might be signed)
      const fileWithPath = {
        ...mockedFileData,
        path: '/tmp/strapi',
        url: 'https://storage.googleapis.com/my-bucket/base/path/tmp/strapi/4l0ngH45h.jpeg?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=...', // signed URL
      };

      const providerInstance = provider.init(mockedConfig);
      await providerInstance.delete(fileWithPath);

      // Should use the reconstructed path from file.path, not the signed URL
      expect(mockedBucket.file).toHaveBeenCalledWith('base/path/tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.delete).toHaveBeenCalledTimes(1);
    });

    test('Falls back to file.url when file.path is missing', async () => {
      // File without path property
      const fileWithoutPath = {
        ...mockedFileData,
        url: 'base/path/tmp/strapi/4l0ngH45h.jpeg',
        path: undefined,
      };

      const providerInstance = provider.init(mockedConfig);
      await providerInstance.delete(fileWithoutPath);

      expect(mockedBucket.file).toHaveBeenCalledWith('tmp/strapi/4l0ngH45h.jpeg');
      expect(mockedFile.delete).toHaveBeenCalledTimes(1);
    });

    test('Handles signed URLs in file.url when file.path is missing', async () => {
      // File with signed URL but no path
      const fileWithSignedUrl = {
        ...mockedFileData,
        url: 'https://storage.googleapis.com/my-bucket/base/path/tmp/strapi/4l0ngH45h.jpeg?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=test@project.iam.gserviceaccount.com%2F20240101%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20240101T000000Z&X-Goog-Expires=900&X-Goog-SignedHeaders=host&X-Goog-Signature=...',
        path: undefined,
      };

      const providerInstance = provider.init(mockedConfig);
      await providerInstance.delete(fileWithSignedUrl);

      expect(mockedBucket.file).toHaveBeenCalledWith('4l0ngH45h/4l0ngH45h.jpeg');
      expect(mockedFile.delete).toHaveBeenCalledTimes(1);
    });
  });
});
