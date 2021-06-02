# Contributing

When contributing to this repository, please first discuss the change you wish to make via issue,
email, or any other method with the owners of this repository before making a change. 

Please note we have a code of conduct, please follow it in all your interactions with the project.

## Open Development & Community Driven

This project is open-source under the [MIT license](LICENSE). All the work done is available on GitHub.

## Code of Conduct

This project and everyone participating in it are governed by a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please read the [full text](CODE_OF_CONDUCT.md) so that you can read which actions may or may not be tolerated.

## Bugs

We are using [GitHub Issues](https://github.com/Lith/strapi-provider-upload-google-cloud-storage/issues) to manage our public bugs. We keep a close eye on this so before filing a new issue, try to make sure the problem does not already exist.

---

## Contribution Prerequisites

* You have [Node](https://nodejs.org/en/) at v12.x.x only and [Yarn](https://yarnpkg.com/en/) at v1.2.0+.
* You are familiar with Git.

This project is using `Yarn` so you need to use it for installation package.

## Pull Request Process

The team will review your pull request and will either merge it, request changes to it, or close it.

**Before submitting your pull request** make sure the following requirements are fulfilled:

1. Fork the repository and create your branch from `master`.
    - Run `yarn install` in the repository root.
    - If you’ve fixed a bug or added code that should be tested, add the tests and then link the corresponding issue in either your commit or your PR!
    - Ensure the test suites are passing:
      - `yarn test` or `npm run test`
    - Make sure your code lints 
      - `yarn lint` or `npm run lint`
    - Check coverage report
      - `yarn coverage` or `npm run coverage`
2. Update the [README.md](README.md) with details of changes to the interface, this includes new environment 
   variables, exposed ports, useful file locations and container parameters.
3. You need to Signed-off-by all of your commits before push, like this example :
    ```shell script
    This is my commit message
    
    Signed-off-by: Random J Developer <random@developer.example.org>
    ```
   Git even has a -s command line option to append this automatically to your commit message:
   ```
   $ git commit -s -m 'This is my commit message'
   ```
4. A team leader will check, suggest modification, approve, merge, and close your request.

---

## Miscellaneous

### Reporting an issue

Before submitting an issue you need to make sure:

- You are experiencing a concrete technical issue with this plugin.
- You have already searched for related [issues](https://github.com/Lith/strapi-provider-upload-google-cloud-storage/issues), and found none open (if you found a related _closed_ issue, please link to it from your post).
- Your issue title is concise, on-topic and polite.
- You can and do provide steps to reproduce your issue.
- You have tried all the following (if relevant) and your issue remains:
  - Make sure you have the right application started.
  - Make sure the [issue template](.github/ISSUE_TEMPLATE) is respected.
  - Make sure your issue body is readable and [well formatted](https://guides.github.com/features/mastering-markdown).
  - Make sure you've killed the Strapi server with CTRL+C and started it again.
  - Make sure the application you are using to reproduce the issue has a clean `node_modules` directory, meaning:
    - no dependencies are linked (e.g. you haven't run `npm link`)
    - that you haven't made any inline changes to files in the `node_modules` folder
    - that you don't have any weird global dependency loops. The easiest way to double-check any of the above, if you aren't sure, is to run: 
        - `$ rm -rf node_modules && npm cache clear && npm install`.
    
