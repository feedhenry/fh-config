var fs = require('fs');

module.exports = {
  load: function(configSource, cb) {
    if (!fs.existsSync(configSource)) {
      return cb(new Error('config file does not exist : ' + configSource));
    }
    fs.readFile(configSource, 'utf8', function(err, data) {
      if (err) {
        return cb(err);
      }
      return cb(null, data);
    });
  },

/**
 * Set a watch on the specified configSource file.
 *
 * @public
 *
 * @param {string} confSource - path to configuration file.
 * @param {function} cb - Callback function
 *
 * @returns {Object} - fs.FSWatcher object.
 */
  watch: function(configSource, cb) {
    return fs.watch(configSource, cb);
  }
};