module.exports = {
  packagerConfig: {
    icon: "resources/icon.ico",
    asar: true,
    executableName: "FIT Launcher",
    extraResource: ["resources/windows", "resources/examples"],
    ignore: [
      /^\/(?!dist(?:\/|$)|package\.json$|node_modules(?:\/|$)|LICENSE$)/,
    ],
  },
  makers: [{ name: "@electron-forge/maker-zip", platforms: ["win32"] }],
};
