const path = require('path');
const webpack = require('webpack')

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
    library: ['roam']
  },
//   mode: 'development',
  optimization: {
    minimize: false
  },
  // devtool: 'eval-source-map',
  // plugins: [new webpack.SourceMapDevToolPlugin({})]
};
