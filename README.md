# strapi-provider-upload-google-cloud-storage

**Non-Official** Google Cloud Storage Provider for Strapi Upload

## Installation

Install the package from your app root directory

```
cd /path/to/strapi/
npm install strapi-provider-upload-google-cloud-storage --save
```

## Setting up Google authentification

1. In the GCP Console, go to the **Create service account key** page.. 
    - **[Go to the create service account key page](https://console.cloud.google.com/apis/credentials/serviceaccountkey)**
2. From the **Service account** list, select **New service account**.
3. In the **Service account name** field, enter a name.
4. From the **Role** list, select **Storage > Administrator**.   
5. Click **Create**. A JSON file that contains your key downloads to your computer.

## Setting up Strapi upload configuration

1. Copy the full content of the downloaded JSON file
2. Paste it into the "Service Account JSON" field in Strapi Upload Settings
3. Set an existing multi-regional Bucket name 
4. Define a multi-regional location (_Europe_ [eu], _Asia_ [asia] or _United States of America_ [us])
5. Save the configuration
6. Enjoy !

## Important information

If the bucket doesn't exist, the plugin will try to create it for you.
So be carefull when you select the multi-regional option, because your bucket will be located inside.

## Resources

* [MIT License](LICENSE.md)

## Links

- [Strapi website](http://strapi.io/)
- [Strapi community on Slack](http://slack.strapi.io)
- [Strapi news on Twitter](https://twitter.com/strapijs)


