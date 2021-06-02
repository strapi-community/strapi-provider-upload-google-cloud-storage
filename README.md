# strapi-provider-upload-google-cloud-storage

[![npm version](https://img.shields.io/npm/v/strapi-provider-upload-google-cloud-storage.svg)](https://www.npmjs.org/package/strapi-provider-upload-google-cloud-storage)
[![npm downloads](https://img.shields.io/npm/dm/strapi-provider-upload-google-cloud-storage.svg)](https://www.npmjs.org/package/strapi-provider-upload-google-cloud-storage)
[![coverage](https://img.shields.io/codecov/c/gh/lith/strapi-provider-upload-google-cloud-storage/master)](https://www.npmjs.org/package/strapi-provider-upload-google-cloud-storage)

**Non-Official** Google Cloud Storage Provider for Strapi Upload

## Installation

Install the package from your app root directory

with `npm`
```
npm install strapi-provider-upload-google-cloud-storage --save
```

or `yarn`
```
yarn add strapi-provider-upload-google-cloud-storage
```

## <a name="create-bucket"></a> Create your Bucket on Google Cloud Storage

The bucket should be created with **fine grained** access control, as the plugin will configure uploaded files with public read access.

### How to create a bucket ?
- https://cloud.google.com/storage/docs/creating-buckets

### Where my bucket can be located ?
- https://cloud.google.com/storage/docs/locations

## <a name="setup-auth"></a> Setting up Google authentication

If you are deploying to a Google Cloud Platform product that supports [Application Default Credentials](https://cloud.google.com/docs/authentication/production#finding_credentials_automatically) (such as App Engine, Cloud Run, and Cloud Functions etc.), then you can skip this step. 

If you are deploying outside GCP, then follow these steps to set up authentication:

1. In the GCP Console, go to the **Create service account key** page.
    - **[Go to the create service account key page](https://console.cloud.google.com/apis/credentials/serviceaccountkey)**
2. From the **Service account** list, select **New service account**.
3. In the **Service account name** field, enter a name.
4. From the **Role** list, select **Cloud Storage > Storage Admin**.
5. Select `JSON` for **Key Type**
6. Click **Create**. A JSON file that contains your key downloads to your computer.
7. Copy the full content of the downloaded JSON file
8. Open the Strapi configuration file 
9. Paste it into the "Service Account JSON" field (as `string` or `JSON`, be careful with indentation)

## Setting up the configuration file

You will find below many examples of configurations, for each example :

1. If you are deploying outside GCP, then follow the steps above [Setting up Google authentication](#setup-auth)
2. Set the `#bucketName#` field and replace `Bucket-name` by yours [previously create](#create-bucket)
3. Default `baseUrl` is working, but you can replace it by yours (if you use a custom baseUrl)
4. Save the configuration file
5. Enjoy !

**Example with application default credentials (minimal setup)**

This works only for deployment to GCP products such as App Engine, Cloud Run, and Cloud Functions etc.

Edit `./config/plugins.js`

```javascript
module.exports = {
    upload: {
        provider: 'google-cloud-storage',
        providerOptions: {
            bucketName: '#bucketName#',
            publicFiles: false,
            uniform: false,
            basePath: '',
        },
    },
    //...
}
```

**Example with credentials for outside GCP account**

Edit `./config/plugins.js`

```javascript
module.exports = {
    upload: {
        provider: 'google-cloud-storage',
        providerOptions: {
            bucketName: '#bucketName#',
            publicFiles: true,
            uniform: false,
            serviceAccount: {}, // replace `{}` with your serviceAccount JSON object
            baseUrl: 'https://storage.googleapis.com/{bucket-name}',
            basePath: '',
        },
      },
    //...
}
```

If you have different upload provider by environment, you can override `plugins.js` file by environment : 
- `config/env/development/plugins.js`
- `config/env/production/plugins.js`

This file, under `config/env/{env}/` will be overriding default configuration present in main folder `config`.

**Example with environment variable**

```javascript
module.exports = ({ env }) => ({
    upload: {
      provider: 'google-cloud-storage',
      providerOptions: {
        serviceAccount: env.json('GCS_SERVICE_ACCOUNT'),
        bucketName: env('GCS_BUCKET_NAME'),
        basePath: env('GCS_BASE_PATH'),
        baseUrl: env('GCS_BASE_URL'),
        publicFiles: env('GCS_PUBLIC_FILES'),
        uniform: env('GCS_UNIFORM'),
      },
    },
    //...
});
```

Environment variable can be changed has your way.

## How to configure variable ?

#### `serviceAccount` :

JSON data provide by Google Account (explained before). If you are deploying to a GCP product that supports Application Default credentials, you can leave this omitted, and authentication will work automatically.

Can be set as a String, JSON Object, or omitted.

#### `bucketName` :

The name of the bucket on Google Cloud Storage.
- Required

You can find more information on Google Cloud documentation.

#### `baseUrl` :

Define your base Url, first is default value :
- https://storage.googleapis.com/{bucket-name}
- https://{bucket-name}
- http://{bucket-name}

#### `basePath` :

Define base path to save each media document.
- Optional

#### `publicFiles`:

Boolean to define a public attribute to file when it upload to storage.
- Default value : `true`
- Optional

#### `uniform`:

Boolean to define uniform access, when uniform bucket-level access is enabled.
- Default value : `false`
- Optional

#### `cacheMaxAge`:

Number to set the cache-control header for uploaded files.
- Default value : `3600`
- Optional

#### `gzip`:

Value to define if files are uploaded and stored with gzip compression.
- Possible values: `true`, `false`, `auto`
- Default value : `auto`
- Optional

### `metadata`:

Function that is executed to compute the metadata for a file when it is uploaded. 

When no function is provided, the following metadata is used:

```js
{
  contentDisposition: `inline; filename="${file.name}"`,
  cacheControl: `public, max-age=${config.cacheMaxAge || 3600}`,
}
```

- Default value: `undefined`
- Optional

Example:

```js
  metadata: (file) => ({
    cacheControl: `public, max-age=${60 * 60 * 24 * 7}`, // One week
    contentLanguage: 'en-US',
    contentDisposition: `attachment; filename="${file.name}"`,
  }),
```

The available properties can be found in the [Cloud Storage JSON API documentation](https://cloud.google.com/storage/docs/json_api/v1/objects/insert#request_properties_JSON).

### `generateUploadFileName`:

Function that is executed to generate the name of the uploaded file. This method can give more control over the file name and can for example be used to include a custom hashing function or dynamic path.

When no function is provided, the [default algorithm](lib/provider.js) is used.

- Default value: `undefined`
- Optional

Example:

```js
  generateUploadFileName: (file) => {
    const hash = ...; // Some hashing function, for example MD-5
    const extension = file.ext.toLowerCase().substring(1);
    return `${extension}/${slugify(path.parse(file.name).name)}-${hash}.${extension}`;
  },
```


## FAQ

### Common errors

#### Uniform access 

`Error uploading file to Google Cloud Storage: Cannot insert legacy ACL for an object when uniform bucket-level access is enabled`

When this error occurs, you need to set `uniform` variable to `true`.

#### Service Account JSON

`Error: Error parsing data "Service Account JSON", please be sure to copy/paste the full JSON file`

When this error occurs, it's probably because you have missed something with the service account json configuration.

Follow this step :
- Open your `ServiceAccount` json file
- Copy the full content of the file
- Paste it under the variable `ServiceAccount` in `plugins.js` config file in JSON


## Links

- [Strapi website](http://strapi.io/)
- [Strapi community on Slack](http://slack.strapi.io)
- [Strapi news on Twitter](https://twitter.com/strapijs)

## Community support

- [GitHub](https://github.com/Lith/strapi-provider-upload-google-cloud-storage) (Bug reports, contributions)
  
You can also used official support platform of Strapi, and search `@Lith` (maintainer) 

- [Discord](https://discord.strapi.io) (For live discussion with the Community and Strapi team)
- [Community Forum](https://forum.strapi.io) (Questions and Discussions)

## License

See the [MIT License](LICENSE) file for licensing information.
