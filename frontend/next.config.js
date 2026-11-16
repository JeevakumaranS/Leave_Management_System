const path = require('path');

module.exports = {
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '..'),
};
