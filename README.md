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

1. In the GCP Console, go to the **Create service account key** page.. 
    - **[Go to the create service account key page](https://console.cloud.google.com/apis/credentials/serviceaccountkey)**
2. From the **Service account** list, select **New service account**.
3. In the **Service account name** field, enter a name.
4. From the **Role** list, select **Cloud Storage > Storage Admin**.
5. Select `JSON` for **Key Type**
6. Click **Create**. A JSON file that contains your key downloads to your computer.
7. Copy the full content of the downloaded JSON file
8. Open the Strapi configuration file 
9. Paste it into the "Service Account JSON" field (as `string` or `JSON`, be careful with indentation)

## Setting up the a configuration file

You will find below many examples of configurations, for each example :

1. If you are deploying outside GCP, then follow the steps above [Setting up Google authentication](#setup-auth)
2. Set the `bucketName` field and replace `Bucket-name` by yours [previously create](#create-bucket)
3. Default `baseUrl` is working, but you can replace it by yours (if you use a custom baseUrl)
4. Save the configuration file
5. Enjoy !

**Example with application default credentials (minimal setup)**

This works only for deployment to GCP products such as App Engine, Cloud Run, and Cloud Functions etc.

`./extensions/upload/config/settings.json`
```json
{
  "provider": "google-cloud-storage",
  "providerOptions": {
    "bucketName": "Bucket-name"
  }
}
```

**Example with one configuration for all environments (dev/stage/prod)**

`./extensions/upload/config/settings.json`
```json
{
  "provider": "google-cloud-storage",
  "providerOptions": {
    "serviceAccount": "<Your serviceAccount JSON object/string here>",
    "bucketName": "Bucket-name",
    "baseUrl": "https://storage.googleapis.com/{bucket-name}",
    "basePath": "/",
    "publicFiles": true
  }
}
```

**Example with environment variable**

`./extensions/upload/config/settings.json`
```json
{
  "provider": "google-cloud-storage",
  "providerOptions": {
    "serviceAccount": "${process.env.GCS_SERVICE_ACCOUNT || <Your serviceAccount JSON object/string here>}",
    "bucketName": "${process.env.GCS_BUCKET_NAME || Bucket-name}",
    "baseUrl": "${process.env.GCS_BASE_URL || https://storage.googleapis.com/{bucket-name}}",
    "basePath": "",
    "publicFiles": true
  }
}
```

You can rename the `environment variables` as you like.
All variable are optional, you can setting up only `bucketName` if you need to change only the `bucketName`.

**Example with multi configuration multi upload : one by environment (dev/stage/prod)**

`./extensions/upload/config/settings.js`
```js
const stagingProviderOptions = {
  serviceAccount: '<Your serviceAccount JSON object/string here>', // json configuration 
  bucketName: 'Bucket-name', // name of the bucket
  baseUrl: 'https://storage.googleapis.com/{bucket-name}',
  basePath: '/staging',
  publicFiles: false
};

const productionProviderOptions = {
  serviceAccount: '<Your serviceAccount JSON object/string here>', // json configuration 
  bucketName: 'Bucket-name', // name of the bucket
  baseUrl: 'https://storage.googleapis.com/{bucket-name}',
  basePath: '/production',
  publicFiles: true
};


if (process.env.NODE_ENV === 'production') {
  module.exports = {
    provider: 'google-cloud-storage',
    providerOptions: productionProviderOptions
  };
}
else if (process.env.NODE_ENV === 'staging') {
  module.exports = {
    provider: 'google-cloud-storage',
    providerOptions: stagingProviderOptions
  };
}
else {
  module.exports = {
    provider: 'local'
  };
}
```

**Overriding `uploadProvider` config with `gcs` key in Strapi custom config**

Contents of `gcs` key in Strapi custom config, if set, will be merged over `./extensions/upload/config/settings.json`,

`./config/custom.json` (config items set here will be merged over, overriding config set at `./extensions/upload/config/settings.json`)
```json
{
  "gcs" : {
    "serviceAccount": "<Your serviceAccount JSON object/string here>",
    "bucketName": "Bucket-name",
    "baseUrl": "https://storage.googleapis.com/{bucket-name}",
    "publicFiles": true
  }
}
```

`./config/environments/<development|staging|production>/custom.json` (config items set here will be merged over and override the previous ones)
```json
{
  "gcs" : {
    "serviceAccount": "<Your serviceAccount JSON object/string here>",
    "bucketName": "Bucket-name",
    "baseUrl": "https://storage.googleapis.com/{bucket-name}",
    "publicFiles": true
  }
}
```

## How to configure variable ?

#### `serviceAccount` :

JSON data provide by Google Account (explained before). If you are deploying to a GCP product that supports Application Default credentials, you can leave this omitted, and authentication will work automatically.

Can be set as a String, JSON Object, or omitted.

#### `bucketName` :

The name of the bucket on Google Cloud Storage.
You can find more information on Google Cloud documentation.

#### `baseUrl` :

Define your base Url, first is default value :
- https://storage.googleapis.com/{bucket-name}
- https://{bucket-name}
- http://{bucket-name}

#### `basePath` :

Define base path to save each media document.

#### `publicFiles`:

Boolean atribute to define public attribute to file when it is upload to storage.

## Important information

From release `3.0.0-beta.20` the `bucketLocation` is no longer supported.
The plugin will not create the bucket, you need to configure it before.

## Resources

* [MIT License](LICENSE.md)

## Links

- [Strapi website](http://strapi.io/)
- [Strapi community on Slack](http://slack.strapi.io)
- [Strapi news on Twitter](https://twitter.com/strapijs)

## Support

- [Slack](http://slack.strapi.io) (Highly recommended for faster support)
- [GitHub](https://github.com/Lith/strapi-provider-upload-google-cloud-storage) (Bug reports, contributions)
