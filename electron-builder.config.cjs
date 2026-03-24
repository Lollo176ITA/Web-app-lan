const windowsPublishUrl = process.env.ROUTY_WINDOWS_PUBLISH_URL?.trim();

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
    artifactName: "${productName} Web Setup ${version} ${arch}.${ext}"
  },
  mac: {
    target: ["dmg"]
  },
  linux: {
    target: ["AppImage"]
  }
};
