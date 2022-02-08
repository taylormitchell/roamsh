const path = require('path');

module.exports = {
  entry: './roamPrompt.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
//   mode: 'development',
  optimization: {
    minimize: false
  }
};
