import typescript from '@rollup/plugin-typescript';
import dts from "rollup-plugin-dts";

const config = [
  {
    input: 'build/rcon.js',
    output: {
      file: 'lib/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    plugins: [typescript()]
  }, {
    input: 'build/rcon.d.ts',
    output: {
      file: 'lib/index.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  }
];
export default config;