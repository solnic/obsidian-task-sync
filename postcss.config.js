module.exports = {
  plugins: [
    require('postcss-import')({
      // Resolve imports from node_modules
      resolve: function(id, basedir, importOptions) {
        if (id.startsWith('@schedule-x/')) {
          return require.resolve(id);
        }
        return id;
      }
    })
  ]
};
