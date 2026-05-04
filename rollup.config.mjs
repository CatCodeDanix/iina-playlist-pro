import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

export default {
  input: "src/index.ts",

  output: {
    file: "dist/plugin.js",
  },

  plugins: [
    typescript(),
    terser({
      format: {
        comments: false,
      },
    }),
  ],
};
