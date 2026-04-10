/**
 * Reanimated 4's `react-native-reanimated/plugin` only re-exports
 * `react-native-worklets/plugin`. Resolving it here from the project root
 * avoids resolution edge cases; the worklets plugin must stay last.
 */
const workletsBabelPlugin = require.resolve("react-native-worklets/plugin", {
  paths: [__dirname],
});

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          alias: { "@": "./src" },
        },
      ],
      workletsBabelPlugin,
    ],
  };
};
