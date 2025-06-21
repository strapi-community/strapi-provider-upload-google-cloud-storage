import type { Bucket } from '@google-cloud/storage';
import type { DefaultOptions, File } from '../types';
import { checkBucket, getConfigDefaultValues, getExpires } from '../utils';

const defaultOptions: DefaultOptions = {
  bucketName: 'GC_BUCKET_NAME',
  baseUrl: 'https://storage.googleapis.com/{bucket-name}',
  basePath: '',
  publicFiles: true,
  uniform: false,
  skipCheckBucket: false,
  gzip: 'auto',
  cacheMaxAge: 3600,
  expires: 900000,
};

const options: DefaultOptions = {
  bucketName: 'GC_MY_BUCKET_NAME',
  baseUrl: 'https://storage.googleapis.com/mock-bucket-name',
  basePath: 'base-path',
  publicFiles: false,
  uniform: true,
  skipCheckBucket: true,
  gzip: false,
  cacheMaxAge: 1800,
  expires: 800000,
  metadata: jest.fn(),
  getContentType: jest.fn(),
  generateUploadFileName: jest.fn(),
};

const mockedBucketName = 'my-bucket';

describe('Utils', () => {
  describe('Adds default values to the config', () => {
    test('Adds default values if config is not provided', () => {
      const config = getConfigDefaultValues({
        bucketName: defaultOptions.bucketName,
      });
      expect(config).toEqual({
        ...defaultOptions,
        metadata: expect.any(Function),
        getContentType: expect.any(Function),
        generateUploadFileName: expect.any(Function),
      });
    });
    test('Does not add default values if config is provided', () => {
      const config = getConfigDefaultValues(options);
      expect(config).toEqual(options);
    });
    test('Sets default cacheMaxAge to 3600 when not provided', () => {
      const config = getConfigDefaultValues({
        bucketName: defaultOptions.bucketName,
      });
      expect(config.cacheMaxAge).toEqual(3600);
    });
    test('Preserves custom cacheMaxAge when provided', () => {
      const config = getConfigDefaultValues({
        bucketName: defaultOptions.bucketName,
        cacheMaxAge: 7200,
      });
      expect(config.cacheMaxAge).toEqual(7200);
    });
    test('Sets default cacheMaxAge when undefined is provided', () => {
      const config = getConfigDefaultValues({
        bucketName: defaultOptions.bucketName,
        cacheMaxAge: undefined,
      });
      expect(config.cacheMaxAge).toEqual(3600);
    });
    test('Sets default metadata function that uses cacheMaxAge', () => {
      const config = getConfigDefaultValues({
        bucketName: defaultOptions.bucketName,
        cacheMaxAge: 1800,
      });

      const file = {
        name: 'test.jpg',
        mime: 'image/jpeg',
        hash: 'testhash',
        size: 1000,
        sizeInBytes: 1000,
        url: 'test.jpg',
      };

      expect(config.metadata).toBeDefined();
      const metadata = config.metadata!(file);
      expect(metadata.cacheControl).toEqual('public, max-age=1800');
      expect(metadata.contentDisposition).toEqual('inline; filename="test.jpg"');
    });
    test('Throws an error if bucket name is not present', () => {
      // @ts-expect-error Test wrong configuration
      const functionWithoutBucketName = () => getConfigDefaultValues({});
      const error = new Error('Property "bucketName" is required');
      expect(functionWithoutBucketName).toThrow(error);
    });
    test('Throws an error if bucket name is not a string', () => {
      // @ts-expect-error Test wrong configuration
      const functionWithNotStringBucketName = () => getConfigDefaultValues({ bucketName: 1341234 });
      const error = new Error('Property "bucketName" must be a string');
      expect(functionWithNotStringBucketName).toThrow(error);
    });
  });

  describe('Checks the service account config', () => {
    describe('Invalid config', () => {
      test('Throws error when serviceAccount cannot be parsed as a JSON', () => {
        const serviceAccount = "I'm not a valid JSON";
        const error = new Error(
          'Error parsing data "Service Account JSON", please be sure to copy/paste the full JSON file.'
        );
        expect(() => getConfigDefaultValues({ ...defaultOptions, serviceAccount })).toThrow(error);
      });
      test('Throws error when serviceAccount can be parsed as a JSON, but does not accomplish with correct values', () => {
        const serviceAccount = '{"project_id": "123", "client_email": "my@email.org"}';
        const error = new Error(
          'Error parsing data "Service Account JSON". Missing "private_key" field in JSON file.'
        );
        expect(() => getConfigDefaultValues({ ...defaultOptions, serviceAccount })).toThrow(error);
      });
      test('Throws error when serviceAccount does not have a project_id field', () => {
        const serviceAccount = {};
        const error = new Error(
          'Error parsing data "Service Account JSON". Missing "project_id" field in JSON file.'
        );
        // @ts-expect-error Test wrong configuration
        expect(() => getConfigDefaultValues({ ...defaultOptions, serviceAccount })).toThrow(error);
      });
      test('Throws error when project_id field is not a string', () => {
        const serviceAccount = { project_id: 1 };
        const error = new Error(
          'Error parsing data "Service Account JSON". Property "project_id" must be a string.'
        );
        // @ts-expect-error Test wrong configuration
        expect(() => getConfigDefaultValues({ ...defaultOptions, serviceAccount })).toThrow(error);
      });
      test('Throws error when serviceAccount does not have a client_email field', () => {
        const serviceAccount = {
          project_id: '123',
        };
        const error = new Error(
          'Error parsing data "Service Account JSON". Missing "client_email" field in JSON file.'
        );
        // @ts-expect-error Test wrong configuration
        expect(() => getConfigDefaultValues({ ...defaultOptions, serviceAccount })).toThrow(error);
      });
      test('Throws error when client_email field is not a string', () => {
        const serviceAccount = {
          project_id: '123',
          client_email: 1,
        };
        const error = new Error(
          'Error parsing data "Service Account JSON". Property "client_email" must be a string.'
        );
        // @ts-expect-error Test wrong configuration
        expect(() => getConfigDefaultValues({ ...defaultOptions, serviceAccount })).toThrow(error);
      });
      test('Throws error when serviceAccount does not have a private_key field', () => {
        const serviceAccount = {
          project_id: '123',
          client_email: 'my@email.org',
        };
        const error = new Error(
          'Error parsing data "Service Account JSON". Missing "private_key" field in JSON file.'
        );
        // @ts-expect-error Test wrong configuration
        expect(() => getConfigDefaultValues({ ...defaultOptions, serviceAccount })).toThrow(error);
      });
      test('Throws error when private_key field is not a string', () => {
        const serviceAccount = {
          project_id: '123',
          client_email: 'my@email.org',
          private_key: 123,
        };
        const error = new Error(
          'Error parsing data "Service Account JSON". Property "private_key" must be a string.'
        );
        // @ts-expect-error Test wrong configuration
        expect(() => getConfigDefaultValues({ ...defaultOptions, serviceAccount })).toThrow(error);
      });
    });
    describe('Valid config', () => {
      test('Accepts undefined service account', () => {
        const config = undefined;
        const { serviceAccount } = getConfigDefaultValues({
          ...defaultOptions,
          serviceAccount: config,
        });
        expect(serviceAccount).toEqual(undefined);
      });
      test('Accepts minimal configurations', () => {
        const config = {
          project_id: '123',
          client_email: 'my@email.org',
          private_key: 'a random key',
        };
        const { serviceAccount } = getConfigDefaultValues({
          ...defaultOptions,
          serviceAccount: config,
        });
        expect(serviceAccount).toEqual(config);
      });
      test('Accepts minimal configurations with json string', () => {
        const config = `{
          "project_id": "123",
          "client_email": "my@email.org",
          "private_key": "a random key"
        }`;
        const { serviceAccount } = getConfigDefaultValues({
          ...defaultOptions,
          serviceAccount: config,
        });
        expect(serviceAccount).toEqual({
          project_id: '123',
          client_email: 'my@email.org',
          private_key: 'a random key',
        });
      });
    });
  });

  describe('Checks bucket', () => {
    test('Checks if bucket exists', () => {
      const mockedExists = jest.fn().mockResolvedValue([true]);
      const mockedBucket = {
        exists: mockedExists,
      } as unknown as Bucket;

      expect(checkBucket(mockedBucket, mockedBucketName)).resolves.not.toThrow();
      expect(mockedExists).toHaveBeenCalledTimes(1);
    });
    test('Throws error if bucket does not exists', async () => {
      const mockedExists = jest.fn().mockResolvedValue([false]);
      const mockedBucket = {
        exists: mockedExists,
      } as unknown as Bucket;

      const error = new Error(
        `An error occurs when we try to retrieve the Bucket "${mockedBucketName}". Check if bucket exist on Google Cloud Platform.`
      );

      expect(checkBucket(mockedBucket, mockedBucketName)).rejects.toThrow(error);
      expect(mockedExists).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get expires param', () => {
    beforeAll(() => {
      jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z').getTime());
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('should return Date.now() + number if expires is a number', () => {
      const now = Date.now();
      expect(getExpires(1000)).toEqual(now + 1000);
      expect(getExpires(0)).toEqual(now);
    });

    it('should return the Date object if expires is a Date', () => {
      const future = new Date('2025-01-01T00:00:00Z');
      expect(getExpires(future)).toEqual(future);
    });

    it('should return the string if expires is a string', () => {
      const expiresStr = '2025-01-01T00:00:00Z';
      expect(getExpires(expiresStr)).toEqual(expiresStr);
    });
  });

  describe('Generates upload file name', () => {
    test('Saves filename with right name', async () => {
      const testData: [string, string, File][] = [
        [
          '',
          'christopher-campbell_df9a53d774/christopher-campbell_df9a53d774.jpeg',
          {
            name: 'christopher-campbell',
            alternativeText: undefined,
            caption: undefined,
            hash: 'christopher-campbell_df9a53d774',
            ext: '.jpeg',
            mime: 'image/jpeg',
            size: 823.58,
            sizeInBytes: 82358,
            width: 5184,
            height: 3456,
            buffer: Buffer.from('file buffer information'),
            url: '/Users/',
          },
        ],
        [
          '',
          'thumbnail_christopher-campbell_df9a53d774/thumbnail_christopher-campbell_df9a53d774.jpeg',
          {
            hash: 'thumbnail_christopher-campbell_df9a53d774',
            ext: '.jpeg',
            mime: 'image/jpeg',
            width: 234,
            height: 156,
            size: 5.53,
            buffer: Buffer.from('file buffer information'),
            path: undefined,
            name: 'thumbnail-christopher-campbell',
            sizeInBytes: 553,
            url: '/Users/',
          },
        ],
        [
          'base-path/',
          'base-path/boris-smokrovic_9fd5439b3e/boris-smokrovic_9fd5439b3e',
          {
            name: 'boris-smokrovic',
            alternativeText: undefined,
            caption: undefined,
            hash: 'boris-smokrovic_9fd5439b3e',
            mime: 'image/jpeg',
            size: 897.78,
            width: 4373,
            height: 2915,
            buffer: Buffer.from('file buffer data'),
            sizeInBytes: 89778,
            url: '/Users/',
          },
        ],
        [
          'root/child/',
          'root/child/thumbnail_boris-smokrovic_9fd5439b3e/thumbnail_boris-smokrovic_9fd5439b3e.png',
          {
            hash: 'thumbnail_boris-smokrovic_9fd5439b3e',
            ext: '.png',
            mime: 'image/png',
            width: 234,
            height: 156,
            size: 8.18,
            buffer: Buffer.from('file buffer data'),
            path: undefined,
            name: 'thumbnail-boris-smokrovic',
            sizeInBytes: 818,
            url: '/Users/',
          },
        ],
      ];

      const config = getConfigDefaultValues(defaultOptions);

      const runTest = async ([basePath, expectedFileName, fileData]: [string, string, File]) => {
        const generatedFileName = config.generateUploadFileName(basePath, fileData);
        expect(generatedFileName).toEqual(expectedFileName);
      };

      const promises = testData.map((data) => runTest(data));
      await Promise.all(promises);
    });
  });
});
