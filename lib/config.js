var cluster = require('cluster');
var FHConfig = require('./fhconfig');
var fileHandler = require('./handlers/filehandler');
var templateWrapper = require('./handlers/templatewrapper');

var rawConfig;
var fhConfig;
var configSource;
var validator;
//do not use SIGUSR1, it is reserved by V8 for activate debugger agent. See http://nodejs.org/api/debugger.html
var RELOAD_CONFIG_SIGNAL = 'SIGUSR2';
var watcher;

//for testing
function setRawConfig(cfg) {
  rawConfig = cfg;
  fhConfig = new FHConfig(rawConfig);
}

/**
 * Loads configuration from specified config file and initialises fh-config module.
 *
 * @public
 *
 * @param {string} confSource - path to configuration file.
 * @param {Array|function} [keysOrValidator] - Array of keys or validating function.
 * @param {Boolean} [watch] - Whether to apply a watch on the confSource file.
 * @param {function} cb - Callback function.
 *
 */
function init(confSource, keysOrValidator, watch, cb) {

  var args = [].slice.call(arguments);
  configSource = args.shift();
  cb = args.pop();
  validator = null;

  if (args.length) {
    watch = typeof args[args.length - 1] === 'boolean' ? args.pop() : null;
    validator = args.shift() || null;
  }

  if (!configSource) {
    return cb(new Error('no config source set'));
  }

  loadConfig(function(err, newConfig) {
    if (err) {
      return cb(err);
    } else {
      rawConfig = newConfig.rawConfig;
      fhConfig = newConfig;

      if (watch) {
        watcher = fileHandler.watch(configSource);
      }

      return cb(null,fhConfig);
    }
  });
}

function getWatcher() {
  if (!fhConfig) {
    throw new Error('config is not initialised.');
  }

  return watcher;
}

function getConfig() {
  if (fhConfig) {
    return fhConfig;
  } else if (rawConfig) {
    fhConfig = new FHConfig(rawConfig);
    return fhConfig;
  } else {
    throw new Error('config is not initialised.');
  }
}

function loadConfig(cb) {
  var newConfig;

  fileHandler.load(configSource, function(err, data) {
    var error;
    if (err) {
      return cb(err);
    }

    templateWrapper.applyTemplate(data, function(err, json) {
      if (err) {
        return cb(err);
      }
      newConfig = new FHConfig(json);
      if (validator) {
        try {
          newConfig.validate(validator);
        } catch (e) {
          error = e;
        }
      }
      return cb(error, newConfig);
    });
  });
}

function reload(workers, cb) {
  loadConfig(function(err, newConfig) {
    if (err) {
      return cb(err);
    }
    if (cluster.isMaster && workers) {
      console.log("[Master] Master telling all workers to reload config");
      for (var i = 0; i < workers.length; i++) {
        var worker = workers[i];
        //do not use worker.kill - it does not pass the signal to the process at all.
        //see https://github.com/joyent/node/issues/6042
        worker.process.kill(RELOAD_CONFIG_SIGNAL);
      }
    } else {
      rawConfig = newConfig.rawConfig;
      fhConfig.reload(rawConfig);
      console.log("[Worker " + (cluster.isWorker?cluster.worker.id:'Unknown') + "] worker loaded new config");
    }
    return cb();
  });
}

// used for testing only
function reset() {
  rawConfig = null;
  fhConfig = null;
  configSource = null;
  validator = null;
  watcher = null;
}


exports.setRawConfig = setRawConfig;
exports.init = init;
exports.getConfig = getConfig;
exports.reload = reload;
exports.RELOAD_CONFIG_SIGNAL = RELOAD_CONFIG_SIGNAL;
exports.getWatcher = getWatcher;
// used for testing only
exports.reset = reset;

var proxied = ['value', 'validate', 'int', 'bool', 'mongoConnectionString', 'mongooseConnectionString', 'emit', 'getLogger', 'setLogger', 'on', 'once', 'addListener', 'removeListener', 'print'];
proxied.forEach(function(key) {
  exports[key] = (function(key) {
    return function() {
      var c = getConfig();
      return c[key].apply(c, arguments);
    };
  })(key);
});
