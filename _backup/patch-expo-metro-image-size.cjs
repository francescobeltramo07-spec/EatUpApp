const fs = require("node:fs");
const path = require("node:path");

const expoMetroDirectory = path.resolve(
  __dirname,
  "../node_modules/@expo/metro",
);
const metroPackagePath = require.resolve("metro/package.json", {
  paths: [expoMetroDirectory],
});
const metroPackage = require(metroPackagePath);
const expectedMetroVersion = "0.83.3";

if (metroPackage.version !== expectedMetroVersion) {
  throw new Error(
    `Expected Metro ${expectedMetroVersion}, found ${metroPackage.version}; review the image-size compatibility patch.`,
  );
}

const assetsPath = path.join(path.dirname(metroPackagePath), "src/Assets.js");
const source = fs.readFileSync(assetsPath, "utf8");
const unpatchedCall =
  "  const dimensions = isImage ? (0, _imageSize.default)(isImageInput) : null;";
const patchedCall = `  const dimensions = isImage
    ? (0, _imageSize.default)(
        typeof isImageInput === "string"
          ? _fs.default.readFileSync(isImageInput)
          : isImageInput,
      )
    : null;`;

if (source.includes(patchedCall)) {
  process.stdout.write("Metro image-size compatibility patch is already applied.\n");
} else if (source.includes(unpatchedCall)) {
  fs.writeFileSync(assetsPath, source.replace(unpatchedCall, patchedCall));
  process.stdout.write("Applied Metro image-size compatibility patch.\n");
} else {
  throw new Error(
    "Metro asset-size call changed; review the image-size compatibility patch before installing.",
  );
}
