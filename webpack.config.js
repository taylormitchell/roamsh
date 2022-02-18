const path = require('path');
const webpack = require('webpack')

module.exports = {
  entry: './src/roamsh.js',
  output: {
    filename: 'roamsh.js',
    path: path.resolve(__dirname, 'dist'),
    library: ['roamsh']
  },
  mode: 'development',
  optimization: {
    minimize: false
  },
  // devtool: 'eval-source-map',
  // plugins: [new webpack.SourceMapDevToolPlugin({})]
};
