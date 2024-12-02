import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

/** @type {import('rollup').RollupOptions} */
export default {
  input: "src/index.ts",
  output: {
    file: "dist/index.mjs",
    format: "esm",
    minifyInternalExports: true,
  },
  external: ["node:crypto", "path", "fs", /node_modules/],
  plugins: [nodeResolve(), typescript()],
};
