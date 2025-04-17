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
  });
});
