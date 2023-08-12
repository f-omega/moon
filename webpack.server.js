module.exports = { // TODO: integrate tsloader
  entry: './server-build/server/index.js',
  output: {
    filename: 'server-build.js'
  },
  optimization: {
    minimize: false
  },
  target: 'node'
}
