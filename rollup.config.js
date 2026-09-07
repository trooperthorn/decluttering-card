import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import serve from 'rollup-plugin-serve';
import json from '@rollup/plugin-json';

// eslint-disable-next-line no-undef
const dev = process.env.ROLLUP_WATCH;

const serveopts = {
  contentBase: ['./dist'],
  host: '0.0.0.0',
  port: 5000,
  allowCrossOrigin: true,
  headers: {
    'Access-Control-Allow-Origin': '*',
  },
};

const plugins = [
  nodeResolve({}),
  commonjs(),
  // tsconfig.json sets noEmit for editor/type-checking use (ts-lit-plugin, IDE tooling);
  // the bundler needs actual emitted JS, so override it here rather than in tsconfig.
  typescript({ noEmit: false, declaration: false }),
  json(),
  babel({
    exclude: 'node_modules/**',
    babelHelpers: 'bundled',
    babelrc: false,
    presets: [
      '@babel/preset-env',
      {
        useBuiltIns: 'entry',
        targets: '> 0.25%, not dead',
      },
    ],
  }),
  dev && serve(serveopts),
  !dev &&
    terser({
      // format: {
      //   comments: false,
      // },
      mangle: {
        safari10: true,
      },
    }),
];

export default [
  {
    input: 'src/decluttering-card.ts',
    output: {
      dir: './dist',
      format: 'es',
      sourcemap: dev ? true : false,
    },
    plugins: [...plugins],
    watch: {
      exclude: 'node_modules/**',
    },
  },
];