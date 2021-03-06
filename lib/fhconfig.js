var assert = require('assert');
var util = require('util');
var events = require("events");
var logger = require('./logger');

function FHConfig(rawConfig) {
  this.rawConfig = rawConfig;
  events.EventEmitter.call(this);
}

util.inherits(FHConfig, events.EventEmitter);

function walk(raw, key) {
  var keys = key.split('.');
  var config = raw;
  for (var i=0;i<keys.length;i++) {
    if (config) {
      config = config[keys[i]];
    } else {
      break;
    }
  }
  return config;
}

function checkKeys(raw, keys) {
  for (var i=0;i<keys.length;i++) {
    var key = keys[i];
    var config = walk(raw, key);
    assert.ok(null != config, util.format('Config %s is missing', key)); // eslint-disable-line eqeqeq
  }
}

FHConfig.prototype.validate = function(keysOrValidator) {
  if (typeof keysOrValidator === 'function') {
    var validator = keysOrValidator;
    validator(this.rawConfig);
  } else {
    var keys = keysOrValidator;
    checkKeys(this.rawConfig, keys);
  }
};

FHConfig.prototype.value = function(key) {
  var config = walk(this.rawConfig, key);
  return config;
};

FHConfig.prototype.int = function(key) {
  var value = this.value(key);
  if (value && typeof value !== 'number') {
    value = parseInt(value, 10);
  }
  return value;
};

FHConfig.prototype.bool = function(key) {
  var value = this.value(key);
  if (value && typeof value === 'string') {
    value = value === 'true';
  }
  return value;
};

/**
 * Warning: function requires specific mongo configuration structure.
 * Please use FHConfig.getMongoHostsUrl instead.
 */
FHConfig.prototype.mongoConnectionString = function(key) {
  var mongoKey = key || 'mongo';
  var mongoConf = this.value(mongoKey);
  if (mongoConf.enabled) {
    var hostsUrl = getMongoHostsUrl(mongoConf.host, mongoConf.port, mongoConf.auth);
    var hostStr = hostsUrl.length === 1? hostsUrl[0]: hostsUrl.join(',');
    var mongUrl = util.format('mongodb://%s/%s', hostStr, mongoConf.name);
    var replicaSet = mongoConf.replicaSet || mongoConf.replSetName || mongoConf.replicaset_name;
    if (replicaSet) {
      mongUrl = mongUrl + '?replicaSet=' + replicaSet;
    }
    return mongUrl;
  } else {
    return null;
  }
};

/**
 * Warning: function requires specific mongo configuration structure.
 * Please use FHConfig.getMongoHostsUrl instead.
 */
FHConfig.prototype.mongooseConnectionString = function(key) {
  var mongoKey = key || 'mongo';
  var mongoConf = this.value(mongoKey);
  if (mongoConf.enabled) {
    var hostsUrl = getMongoHostsUrl(mongoConf.host, mongoConf.port, mongoConf.auth);
    var mongoUrls = hostsUrl.map(function(mongUrl, idx) {
      if (idx === 0) {
        return util.format('mongodb://%s/%s', mongUrl, mongoConf.name);
      } else {
        return util.format('mongodb://%s', mongUrl);
      }
    });
    return mongoUrls.join(',');
  } else {
    return null;
  }
};

FHConfig.prototype.reload = function(rawConfig) {
  this.rawConfig = rawConfig;
  this.emit('reloaded', this);
};

/**
 * Deprecated: please use fh-logger instead
 */
FHConfig.prototype.getLogger = function(key) {
  return logger.getLogger(this, key);
};

/**
 * Deprecated: please use fh-logger instead
 */
FHConfig.prototype.setLogger = function(logr) {
  logger.setLogger(logr);
};

FHConfig.prototype.print = function() {
  console.log(JSON.stringify(this.rawConfig, ' ', 2));
};

FHConfig.prototype.getMongoHostsUrl = getMongoHostsUrl;

function getMongoHostsUrl(hostConf, portConf, authConf) {
  var hosts = hostConf;
  if (typeof hosts === 'string') {
    hosts = hostConf.split(",");
  }
  var ports = [portConf];
  if (typeof portConf === 'string') {
    ports = portConf.split(',');
  }
  var urls = [];
  for (var i=0;i<hosts.length;i++) {
    var host = hosts[i].replace(/\s/g, '');
    var port = ports.length === 1? ports[0]: ports[i];
    if (typeof port === 'string') {
      port = port.replace(/\s/g, '');
    }
    if (i === 0 && authConf.enabled) {
      urls.push(util.format('%s:%s@%s:%s', authConf.user, authConf.pass, host, port));
    } else {
      urls.push(util.format('%s:%s', host, port));
    }
  }
  return urls;
}


module.exports = FHConfig;
