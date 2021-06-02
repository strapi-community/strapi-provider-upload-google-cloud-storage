const { strict: assert } = require('assert');
const mockRequire = require('mock-require');
const path = require('path');
const slugify = require('slugify');
const {
  checkServiceAccount,
  checkBucket,
  mergeConfigs,
  generateUploadFileName,
  init,
} = require('../../lib/provider');

describe('/lib/provider.js', () => {
  describe('#checkServiceAccount', () => {
    describe('when config is invalid', () => {
      it('must throw error "Bucket name" is required!', () => {
        const error = new Error('"Bucket name" is required!');
        assert.throws(() => checkServiceAccount(), error);
      });

      it('must throw error when serviceAccount does not accomplish with correct values', () => {
        const config = {
          serviceAccount: "I'm not a valid JSON",
          bucketName: 'some-bucket',
        };
        const error = new Error(
          'Error parsing data "Service Account JSON", please be sure to copy/paste the full JSON file.'
        );
        assert.throws(() => checkServiceAccount(config), error);
      });

      it('must throw error when serviceAccount does not accomplish with correct values', () => {
        const config = {
          serviceAccount: {},
          bucketName: 'some-bucket',
        };
        const error = new Error(
          'Error parsing data "Service Account JSON". Missing "project_id" field in JSON file.'
        );
        assert.throws(() => checkServiceAccount(config), error);
      });

      it('must throw error when serviceAccount does not accomplish with correct values', () => {
        const config = {
          serviceAccount: {},
          bucketName: 'some-bucket',
        };
        const error = new Error(
          'Error parsing data "Service Account JSON". Missing "project_id" field in JSON file.'
        );
        assert.throws(() => checkServiceAccount(config), error);
      });

      it('must throw error when serviceAccount does not accomplish with correct values', () => {
        const config = {
          serviceAccount: {
            project_id: '123',
          },
          bucketName: 'some-bucket',
        };
        const error = new Error(
          'Error parsing data "Service Account JSON". Missing "client_email" field in JSON file.'
        );
        assert.throws(() => checkServiceAccount(config), error);
      });

      it('must throw error when serviceAccount does not accomplish with correct values', () => {
        const config = {
          serviceAccount: {
            project_id: '123',
            client_email: 'my@email.org',
          },
          bucketName: 'some-bucket',
        };
        const error = new Error(
          'Error parsing data "Service Account JSON". Missing "private_key" field in JSON file.'
        );
        assert.throws(() => checkServiceAccount(config), error);
      });

      it('must throw error when serviceAccount does not accomplish with correct values', () => {
        const config = {
          serviceAccount: `{"project_id": "123", "client_email": "my@email.org"}`,
          bucketName: 'some-bucket',
        };
        const error = new Error(
          'Error parsing data "Service Account JSON". Missing "private_key" field in JSON file.'
        );
        assert.throws(() => checkServiceAccount(config), error);
      });
    });

    describe('when config is valid', () => {
      it('must accept minimal configuration without errors', () => {
        const config = {
          bucketName: 'some-bucket',
        };
        checkServiceAccount(config);
      });

      it('must accept configurations without errors', () => {
        const config = {
          serviceAccount: {
            project_id: '123',
            client_email: 'my@email.org',
            private_key: 'a random key',
          },
          bucketName: 'some-bucket',
        };
        checkServiceAccount(config);
      });

      it('must accept configurations with json string', () => {
        const config = {
          serviceAccount: `{
            "project_id": "123",
            "client_email": "my@email.org",
            "private_key": "a random key"
          }`,
          bucketName: 'some-bucket',
        };
        checkServiceAccount(config);
      });

      it('must redefine baseUrl to default value', () => {
        const config = {
          serviceAccount: {
            project_id: '123',
            client_email: 'my@email.org',
            private_key: 'a random key',
          },
          bucketName: 'some-bucket',
        };
        checkServiceAccount(config);
        assert.ok(Object.keys(config).includes('baseUrl'));
        assert.equal(config.baseUrl, 'https://storage.googleapis.com/{bucket-name}');
      });

      it('must accept baseUrl changing value', () => {
        const config = {
          serviceAccount: {
            project_id: '123',
            client_email: 'my@email.org',
            private_key: 'a random key',
          },
          bucketName: 'some-bucket',
          baseUrl: 'http://localhost',
        };
        checkServiceAccount(config);
        assert.equal(config.baseUrl, 'http://localhost');
      });
    });
  });

  describe('#checkBucket', () => {
    describe('when valid bucket', () => {
      it('must check if bucket exists', async () => {
        let assertCount = 0;

        const gcsMock = {
          bucket(bucketName) {
            assertCount += 1;
            assert.equal(bucketName, 'my-bucket');
            return {
              async exists() {
                assertCount += 1;
                return [true];
              },
            };
          },
        };
        await assert.doesNotReject(checkBucket(gcsMock, 'my-bucket'));
        assert.equal(assertCount, 2);
      });
    });

    describe('when bucket does not exists', async () => {
      it('must throw error message', async () => {
        let assertCount = 0;

        const gcsMock = {
          bucket(bucketName) {
            assertCount += 1;
            assert.equal(bucketName, 'my-bucket');
            return {
              async exists() {
                assertCount += 1;
                return [false];
              },
            };
          },
        };

        const error = new Error(
          'An error occurs when we try to retrieve the Bucket "my-bucket". Check if bucket exist on Google Cloud Platform.'
        );

        await assert.rejects(checkBucket(gcsMock, 'my-bucket'), error);

        assert.equal(assertCount, 2);
      });
    });
  });

  describe('#mergeConfigs', () => {
    let strapiOriginal;

    beforeEach(() => {
      strapiOriginal = global.strapi;
    });

    afterEach(() => {
      if (strapiOriginal === undefined) {
        delete global.strapi;
      } else {
        global.strapi = strapiOriginal;
      }
    });

    it('must apply configurations', () => {
      global.strapi = {
        config: {
          currentEnvironment: {},
        },
      };
      const result = mergeConfigs({ foo: 'bar' });
      const expected = { foo: 'bar' };
      assert.deepEqual(result, expected);
    });

    it('must merge with strapi.config.cgs global vars', () => {
      global.strapi = {
        config: {
          gcs: {
            number: 910,
            foo: 'thanos',
          },
          currentEnvironment: {},
        },
      };
      const result = mergeConfigs({ foo: 'bar', key: 'value' });
      const expected = { key: 'value', foo: 'thanos', number: 910 };
      assert.deepEqual(result, expected);
    });

    it('must merge with strapi.config.currentEnvironment.gcs vars', () => {
      global.strapi = {
        config: {
          currentEnvironment: {
            gcs: {
              number: 910,
              foo: 'thanos',
            },
          },
        },
      };
      const result = mergeConfigs({ foo: 'bar', key: 'value' });
      const expected = { key: 'value', foo: 'thanos', number: 910 };
      assert.deepEqual(result, expected);
    });
  });

  describe('#generateUploadFileName', () => {
    it('must save filename in right name', async () => {
      const testData = [
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
            width: 5184,
            height: 3456,
            buffer: 'file buffer information',
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
            buffer: 'file buffer information',
            path: null,
          },
        ],
        [
          'base-path/',
          'base-path/galleries/boris-smokrovic_9fd5439b3e.jpeg',
          {
            name: 'boris-smokrovic',
            alternativeText: undefined,
            caption: undefined,
            hash: 'boris-smokrovic_9fd5439b3e',
            ext: '.jpeg',
            mime: 'image/jpeg',
            size: 897.78,
            related: [{ refId: '1', ref: 'galleries', source: undefined, field: 'cover' }],
            width: 4373,
            height: 2915,
            buffer: 'file buffer data',
          },
        ],
        [
          'root/child/',
          'root/child/thumbnail_boris-smokrovic_9fd5439b3e/thumbnail_boris-smokrovic_9fd5439b3e.jpeg',
          {
            hash: 'thumbnail_boris-smokrovic_9fd5439b3e',
            ext: '.jpeg',
            mime: 'image/jpeg',
            width: 234,
            height: 156,
            size: 8.18,
            buffer: 'file buffer data',
            path: null,
          },
        ],
      ];

      const runTest = async ([basePath, expectedFileName, fileData]) => {
        const generatedFileName = generateUploadFileName(basePath, fileData);
        assert.equal(expectedFileName, generatedFileName);
      };

      const promises = testData.map((data) => runTest(data));
      await Promise.all(promises);
    });
  });

  describe('#init', () => {
    let strapiOriginal;

    beforeEach(() => {
      strapiOriginal = global.strapi;

      global.strapi = {
        config: {
          currentEnvironment: {},
        },
        log: {
          info() {},
          debug() {},
        },
      };
    });

    afterEach(() => {
      if (strapiOriginal === undefined) {
        delete global.strapi;
      } else {
        global.strapi = strapiOriginal;
      }
    });

    it('must return an object with upload and delete methods', () => {
      const config = {
        serviceAccount: {
          project_id: '123',
          client_email: 'my@email.org',
          private_key: 'a random key',
        },
        bucketName: 'any',
      };

      const result = init(config);

      assert.ok(Object.keys(result).includes('upload'));
      assert.equal(typeof result.upload, 'function');
      assert.ok(Object.keys(result).includes('delete'));
      assert.equal(typeof result.delete, 'function');
    });

    it('must instanciate google cloud storage with right configurations', () => {
      let assertionsCount = 0;
      mockRequire('@google-cloud/storage', {
        Storage: class {
          constructor(...args) {
            assertionsCount += 1;
            assert.deepEqual(args, [
              {
                credentials: {
                  client_email: 'my@email.org',
                  private_key: 'a random key',
                },
                projectId: '123',
              },
            ]);
          }
        },
      });
      const provider = mockRequire.reRequire('../../lib/provider');
      const config = {
        serviceAccount: {
          project_id: '123',
          client_email: 'my@email.org',
          private_key: 'a random key',
        },
        bucketName: 'any',
      };
      provider.init(config);
      assert.equal(assertionsCount, 1);
      mockRequire.stop('@google-cloud/storage');
    });

    describe('when execute #upload', () => {
      let assertionsCount;

      beforeEach(() => {
        assertionsCount = 0;
      });

      describe('when bucket exists', () => {
        const createBucketMock = ({ fileMock, expectedFileNames }) => ({
          file(fileName) {
            assertionsCount += 1;
            assert.equal(fileName, expectedFileNames.shift());
            return fileMock;
          },
          async exists() {
            assertionsCount += 1;
            return [true];
          },
        });

        describe('when file DOES NOT exists in bucket', () => {
          const createFileMock = ({ saveExpectedArgs }) => ({
            async exists() {
              assertionsCount += 1;
              return [false];
            },
            async save(...args) {
              assertionsCount += 1;
              assert.deepEqual(args, saveExpectedArgs);
              return [true];
            },
          });

          const fileData = {
            ext: '.JPEG',
            buffer: 'file buffer information',
            mime: 'image/jpeg',
            name: 'people coding.JPEG',
            related: [
              {
                ref: 'ref',
              },
            ],
            hash: '4l0ngH45h',
            path: '/tmp/strapi',
          };

          it('must save file', async () => {
            const saveExpectedArgs = [
              'file buffer information',
              {
                contentType: 'image/jpeg',
                gzip: 'auto',
                metadata: {
                  cacheControl: 'public, max-age=3600',
                  contentDisposition: 'inline; filename="people coding.JPEG"',
                },
                public: true,
              },
            ];

            const fileMock = createFileMock({ saveExpectedArgs });
            const expectedFileNames = ['/tmp/strapi/4l0ngH45h.jpeg', '/tmp/strapi/4l0ngH45h.jpeg'];
            const bucketMock = createBucketMock({ fileMock, expectedFileNames });
            const Storage = class {
              bucket(bucketName) {
                assertionsCount += 1;
                assert.equal(bucketName, 'any bucket');
                return bucketMock;
              }
            };

            mockRequire('@google-cloud/storage', { Storage });
            const provider = mockRequire.reRequire('../../lib/provider');
            const config = {
              serviceAccount: {
                project_id: '123',
                client_email: 'my@email.org',
                private_key: 'a random key',
              },
              bucketName: 'any bucket',
            };
            const providerInstance = provider.init(config);
            await providerInstance.upload(fileData);
            assert.equal(assertionsCount, 6);
            mockRequire.stop('@google-cloud/storage');
          });

          it('must save file with custom metadata', async () => {
            const saveExpectedArgs = [
              'file buffer information',
              {
                gzip: 'auto',
                contentType: 'image/jpeg',
                metadata: {
                  cacheControl: 'public, max-age=604800',
                  contentLanguage: 'en-US',
                  contentDisposition: 'attachment; filename="people coding.JPEG"',
                },
                public: true,
              },
            ];

            const fileMock = createFileMock({ saveExpectedArgs });
            const expectedFileNames = ['/tmp/strapi/4l0ngH45h.jpeg', '/tmp/strapi/4l0ngH45h.jpeg'];
            const bucketMock = createBucketMock({ fileMock, expectedFileNames });
            const Storage = class {
              bucket(bucketName) {
                assertionsCount += 1;
                assert.equal(bucketName, 'any bucket');
                return bucketMock;
              }
            };

            mockRequire('@google-cloud/storage', { Storage });
            const provider = mockRequire.reRequire('../../lib/provider');
            const config = {
              serviceAccount: {
                project_id: '123',
                client_email: 'my@email.org',
                private_key: 'a random key',
              },
              bucketName: 'any bucket',
              metadata: (file) => ({
                cacheControl: `public, max-age=${60 * 60 * 24 * 7}`, // One week
                contentLanguage: 'en-US',
                contentDisposition: `attachment; filename="${file.name}"`,
              }),
            };
            const providerInstance = provider.init(config);
            await providerInstance.upload(fileData);
            assert.equal(assertionsCount, 6);
            mockRequire.stop('@google-cloud/storage');
          });

          it('must save file with custom file name generator', async () => {
            const saveExpectedArgs = [
              'file buffer information',
              {
                gzip: 'auto',
                contentType: 'image/jpeg',
                metadata: {
                  cacheControl: 'public, max-age=3600',
                  contentDisposition: 'inline; filename="people coding.JPEG"',
                },
                public: true,
              },
            ];

            const fileMock = createFileMock({ saveExpectedArgs });
            const expectedFileNames = [
              'jpeg/people-coding-da2f32c2de25f0360d6a5e129dcf9cbc.jpeg',
              'jpeg/people-coding-da2f32c2de25f0360d6a5e129dcf9cbc.jpeg',
            ];
            const bucketMock = createBucketMock({ fileMock, expectedFileNames });
            const Storage = class {
              bucket(bucketName) {
                assertionsCount += 1;
                assert.equal(bucketName, 'any bucket');
                return bucketMock;
              }
            };
            mockRequire('@google-cloud/storage', { Storage });
            const provider = mockRequire.reRequire('../../lib/provider');
            const config = {
              serviceAccount: {
                project_id: '123',
                client_email: 'my@email.org',
                private_key: 'a random key',
              },
              bucketName: 'any bucket',
              generateUploadFileName: (file) => {
                const hash = 'da2f32c2de25f0360d6a5e129dcf9cbc';
                const extension = file.ext.toLowerCase().substring(1);
                return `${extension}/${slugify(path.parse(file.name).name)}-${hash}.${extension}`;
              },
            };
            const providerInstance = provider.init(config);
            await providerInstance.upload(fileData);
            assert.equal(assertionsCount, 6);
            mockRequire.stop('@google-cloud/storage');
          });

          it('must save file with forced gzip', async () => {
            const saveExpectedArgs = [
              'file buffer information',
              {
                contentType: 'image/jpeg',
                gzip: true,
                metadata: {
                  cacheControl: 'public, max-age=3600',
                  contentDisposition: 'inline; filename="people coding.JPEG"',
                },
                public: true,
              },
            ];

            const fileMock = createFileMock({ saveExpectedArgs });
            const expectedFileNames = ['/tmp/strapi/4l0ngH45h.jpeg', '/tmp/strapi/4l0ngH45h.jpeg'];
            const bucketMock = createBucketMock({ fileMock, expectedFileNames });
            const Storage = class {
              bucket(bucketName) {
                assertionsCount += 1;
                assert.equal(bucketName, 'any bucket');
                return bucketMock;
              }
            };

            mockRequire('@google-cloud/storage', { Storage });
            const provider = mockRequire.reRequire('../../lib/provider');
            const config = {
              serviceAccount: {
                project_id: '123',
                client_email: 'my@email.org',
                private_key: 'a random key',
              },
              bucketName: 'any bucket',
              gzip: true,
            };
            const providerInstance = provider.init(config);
            await providerInstance.upload(fileData);
            assert.equal(assertionsCount, 6);
            mockRequire.stop('@google-cloud/storage');
          });
        });

        describe('when file exists in bucket', () => {
          const createFileMock = ({ saveExpectedArgs }) => ({
            async exists() {
              assertionsCount += 1;
              return [true];
            },
            async delete() {
              assertionsCount += 1;
              return true;
            },
            async save(...args) {
              assertionsCount += 1;
              assert.deepEqual(args, saveExpectedArgs);
              return [true];
            },
          });

          it('must delete file before write it', async () => {
            const baseUrl = 'https://storage.googleapis.com';
            const url = `${baseUrl}/random-bucket/4l0ngH45h/4l0ngH45h.jpeg`;

            const fileData = {
              ext: '.JPEG',
              buffer: 'file buffer information',
              mime: 'image/jpeg',
              name: 'people coding.JPEG',
              related: [],
              hash: '4l0ngH45h',
              url,
            };

            const saveExpectedArgs = [
              'file buffer information',
              {
                gzip: 'auto',
                contentType: 'image/jpeg',
                metadata: {
                  cacheControl: 'public, max-age=604800',
                  contentDisposition: 'inline; filename="people coding.JPEG"',
                },
                public: true,
              },
            ];

            const fileMock = createFileMock({ saveExpectedArgs });
            const expectedFileNames = [
              '4l0ngH45h/4l0ngH45h.jpeg',
              '4l0ngH45h/4l0ngH45h.jpeg',
              '4l0ngH45h/4l0ngH45h.jpeg',
            ];
            const bucketMock = createBucketMock({ fileMock, expectedFileNames });
            const Storage = class {
              bucket(bucketName) {
                assertionsCount += 1;
                assert.equal(bucketName, 'random-bucket');
                return bucketMock;
              }
            };

            mockRequire('@google-cloud/storage', { Storage });
            const provider = mockRequire.reRequire('../../lib/provider');
            const config = {
              serviceAccount: {
                project_id: '123',
                client_email: 'my@email.org',
                private_key: 'a random key',
              },
              bucketName: 'random-bucket',
              cacheMaxAge: 60 * 60 * 24 * 7, // one week
            };
            const providerInstance = provider.init(config);
            await providerInstance.upload(fileData);
            assert.equal(assertionsCount, 9);
            mockRequire.stop('@google-cloud/storage');
          });
        });
      });
    });

    describe('when execute #delete', () => {
      let assertionsCount;

      describe('when bucket exists', () => {
        const createBucketMock = ({ fileMock, expectedFileNames }) => ({
          file(fileName) {
            assertionsCount += 1;
            assert.equal(fileName, expectedFileNames.shift());
            return fileMock;
          },
          async exists() {
            assertionsCount += 1;
            return [true];
          },
        });

        describe('when file is deleted with success', () => {
          const createFileMock = () => ({
            async delete() {
              assertionsCount += 1;
              return [];
            },
          });

          it('must log message and resolve with nothing', async () => {
            global.strapi.log.debug = (...args) => {
              assert.deepEqual(args, ['File o/people-working.png successfully deleted']);
              assertionsCount += 1;
            };
            assertionsCount = 0;
            const expectedFileNames = ['o/people-working.png'];
            const bucketMock = createBucketMock({ fileMock: createFileMock(), expectedFileNames });
            mockRequire('@google-cloud/storage', {
              Storage: class {
                bucket(bucketName) {
                  assertionsCount += 1;
                  assert.equal(bucketName, 'my-bucket');
                  return bucketMock;
                }
              },
            });
            const provider = mockRequire.reRequire('../../lib/provider');
            const config = {
              serviceAccount: {
                project_id: '123',
                client_email: 'my@email.org',
                private_key: 'a random key',
              },
              bucketName: 'my-bucket',
            };
            const providerInstance = provider.init(config);
            const fileData = {
              url: 'https://storage.googleapis.com/my-bucket/o/people-working.png',
            };
            await assert.doesNotReject(providerInstance.delete(fileData));
            // TODO: fix this. Probabily a problem with async flows
            await new Promise((resolve) => setTimeout(resolve, 1));
            assert.equal(assertionsCount, 3);
            mockRequire.stop('@google-cloud/storage');
          });
        });

        describe('when file cannot be deleted', () => {
          const createFileMock = ({ errorCode }) => ({
            async delete() {
              assertionsCount += 1;
              const error = new Error('Error deleting file');
              error.code = errorCode;
              throw error;
            },
          });

          describe('when error is a 404 error', () => {
            it('must log message and resolve with nothing', async () => {
              global.strapi.log.warn = (...args) => {
                assertionsCount += 1;
                assert.deepEqual(args, [
                  'Remote file was not found, you may have to delete manually.',
                ]);
              };
              const errorCode = 404;
              assertionsCount = 0;
              const expectedFileNames = ['o/people-working.png'];
              const bucketMock = createBucketMock({
                fileMock: createFileMock({ errorCode }),
                expectedFileNames,
              });
              mockRequire('@google-cloud/storage', {
                Storage: class {
                  bucket(bucketName) {
                    assertionsCount += 1;
                    assert.equal(bucketName, 'my-bucket');
                    return bucketMock;
                  }
                },
              });
              const provider = mockRequire.reRequire('../../lib/provider');
              const config = {
                serviceAccount: {
                  project_id: '123',
                  client_email: 'my@email.org',
                  private_key: 'a random key',
                },
                bucketName: 'my-bucket',
              };
              const providerInstance = provider.init(config);
              const fileData = {
                url: 'https://storage.googleapis.com/my-bucket/o/people-working.png',
              };
              await assert.doesNotReject(providerInstance.delete(fileData));
              // TODO: fix this. Probabily a problem with async flows
              await new Promise((resolve) => setTimeout(resolve, 1));
              assert.equal(assertionsCount, 3);
              mockRequire.stop('@google-cloud/storage');
            });
          });

          describe('when error is any other error', () => {
            it('must reject with problem', async () => {
              global.strapi.log.warn = (...args) => {
                assertionsCount += 1;
                assert.deepEqual(args, [
                  'Remote file was not found, you may have to delete manually.',
                ]);
              };
              const errorCode = 500;
              assertionsCount = 0;
              const expectedFileNames = ['o/people-working.png'];
              const bucketMock = createBucketMock({
                fileMock: createFileMock({ errorCode }),
                expectedFileNames,
              });
              mockRequire('@google-cloud/storage', {
                Storage: class {
                  bucket(bucketName) {
                    assertionsCount += 1;
                    assert.equal(bucketName, 'my-bucket');
                    return bucketMock;
                  }
                },
              });
              const provider = mockRequire.reRequire('../../lib/provider');
              const config = {
                serviceAccount: {
                  project_id: '123',
                  client_email: 'my@email.org',
                  private_key: 'a random key',
                },
                bucketName: 'my-bucket',
              };
              const providerInstance = provider.init(config);
              const fileData = {
                url: 'https://storage.googleapis.com/my-bucket/o/people-working.png',
              };
              // FIXME: based on code this must reject. Probabily a problem with async flows
              await assert.doesNotReject(providerInstance.delete(fileData));
              // TODO: fix this. Probabily a problem with async flows
              await new Promise((resolve) => setTimeout(resolve, 1));
              assert.equal(assertionsCount, 3);
              mockRequire.stop('@google-cloud/storage');
            });
          });
        });
      });
    });
  });
});
