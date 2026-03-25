const packageJson = require("./package.json");

const windowsPublishUrl = process.env.ROUTY_WINDOWS_PUBLISH_URL?.trim();
const windowsAppPackageUrl =
  process.env.ROUTY_WINDOWS_APP_PACKAGE_URL?.trim() ||
  (process.env.GITHUB_REPOSITORY?.trim() && packageJson.version?.trim()
    ? `https://github.com/${process.env.GITHUB_REPOSITORY.trim()}/releases/download/desktop-payloads-v${packageJson.version.trim()}`
    : undefined);

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: "it.routy.desktop",
  productName: "Routy",
  directories: {
    output: "release"
  },
  files: [
    "desktop/**/*",
    "dist/**/*",
    "package.json",
    "!**/*.map",
    "!**/{test,tests,__tests__,powered-test}/**",
    "!**/{example,examples}/**",
    "!**/{docs,doc}/**",
    "!**/{README,README.md,CHANGELOG,CHANGELOG.md,*.md}"
  ],
  win: {
    target: ["nsis-web"],
    ...(windowsPublishUrl
      ? {
          publish: [
            {
              provider: "generic",
              url: windowsPublishUrl
            }
          ]
        }
      : {})
  },
  nsisWeb: {
    ...(windowsAppPackageUrl
      ? {
          appPackageUrl: windowsAppPackageUrl
        }
      : {}),
    artifactName: "${productName} Web Setup ${version} ${arch}.${ext}"
  },
  mac: {
    target: ["dmg"]
  },
  linux: {
    target: ["AppImage"]
  }
};
