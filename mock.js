/**
 * Mockle BLE mocking class
 *
 * The BleMock class takes a device profile in input and create a pure NodeJS
 * clone uppon which high-level behaviors may be implemented.
 **/

var async = require('async');
var events = require('events');
var bleno = require('bleno');
var util = require('util');
var jsonfile = require('jsonfile');
var colors = require('colors');
var io = require('socket.io-client');
var logging = require('./logging');

var args = process.argv.slice(2);
var deviceMac = args[0];

/**
 * Mockle device emulator
 **/

var BleMock = function(configFile) {
  events.EventEmitter.call(this);

  /* Logger */
  this.logger = logging('test.log');

  /* Update callbacks. */
  this.subsCallbacks = {};

  /* Propagate bleno constants. */
  this.RESULT_SUCCESS = bleno.Characteristic.RESULT_SUCCESS;
  this.RESULT_INVALID_OFFSET = bleno.Characteristic.RESULT_INVALID_OFFSET;
  this.RESULT_INVALID_ATTRIBUTE_LENGTH = bleno.Characteristic.RESULT_INVALID_ATTRIBUTE_LENGTH;
  this.RESULT_UNLIKELY_ERROR = bleno.Characteristic.RESULT_UNLIKELY_ERROR;

  /* Read config file (json) */
  this.config = jsonfile.readFileSync(configFile);
  if (this.config['name'] != null) {
    console.log(('[setup] creating mock for device ' + this.config['name'] + ' (' + this.config['address'] + ')').bold);
  } else {
    console.log(('[setup] creating mock for device ' + this.config['address']).bold);
  }

  /* Change environment variable to force device name. */
  process.env['BLENO_DEVICE_NAME'] = this.config.name;
};

util.inherits(BleMock, events.EventEmitter);

/**
 * start()
 *
 * Starts the mock:
 * - load config file
 * - create the mock
 * - advertise the exact same data as the original
 * - handles connections
 **/

BleMock.prototype.start = function() {

  /* Set services as described in config file. */
  this.services = [];
  for (var service in this.config['services']) {
    /* Get service information. */
    var _service = this.config['services'][service];

    /* Create the service structure. */
    var service_details = {
      uuid: _service['uuid'],
      characteristics: [],
    };

    /* Add characteristics. */
    for (var charac in _service['characteristics']) {
      var service_char_item = {};
      service_char_item['uuid'] = _service['characteristics'][charac]['uuid'];
      service_char_item['properties'] = _service['characteristics'][charac]['properties'];
      service_char_item['descriptors'] = [];
      for (var desc in _service['characteristics'][charac]['descriptors']) {
        service_char_item['descriptors'].push(
          new bleno.Descriptor({
            uuid: _service['characteristics'][charac]['descriptors'][desc],
            value: 'notifs'
          })
        );
      }

      /* Install characteristic read callback if required. */
      if (service_char_item['properties'].indexOf('read') > -1) {
        service_char_item['onReadRequest'] = (function(_this, service, characteristic){
          return function(offset, callback) {
            _this.onRead(service, characteristic, offset, callback);
          }
        })(this, _service['uuid'], _service['characteristics'][charac]['uuid']);
      }

      /* Install characteristic write callback if required. */
      if ((service_char_item['properties'].indexOf('write') > -1) || (service_char_item['properties'].indexOf('writeWithoutResponse') > -1)) {
        service_char_item['onWriteRequest'] = (function(_this, service, characteristic){
          return function(data, offset, withoutResponse, callback){
            _this.onWrite(service, characteristic, data, offset, withoutResponse, callback);
          }
        })(this, _service['uuid'], _service['characteristics'][charac]['uuid']);
      }

      /* Install characteristic notify callback if required. */
      if (service_char_item['properties'].indexOf('notify') > -1) {
        service_char_item['onSubscribe'] = (function(_this, service, characteristic){
          return function(maxValueSize, updateValueCallback){
            _this.onSubscribe(service, characteristic, maxValueSize, updateValueCallback);
          }
        })(this, _service['uuid'], _service['characteristics'][charac]['uuid']);
        service_char_item['onNotify'] = (function(_this, service, characteristic){
          return function(maxValueSize, updateValueCallback){
            _this.onNotify(service, characteristic);
          }
        })(this, _service['characteristics'][charac]['uuid']);
      }

      /* Register the service in bleno. */
      service_details['characteristics'].push(
        new bleno.Characteristic(service_char_item)
      );
    }

    this.services.push(new bleno.PrimaryService(service_details));
  }

  /* Advertise our mocked device. */
  var scan_data = new Buffer(this.config['scan_data'], 'hex');

  bleno.on('advertisingStart', (function(_this){
    return function(error){
      if (!error) {
        console.log('[setup] services registered'.yellow);
        bleno.setServices(_this.services);
      } else {
        console.log('[setup] error while registering services !'.red);
      }
    };
  })(this));

  /* Notify the console that we've accepted a connection. */
  bleno.on('accept', function(clientAddress) {
      console.log(("[ mock] accepted connection from address: " + clientAddress).green);
  });

  /* Notify the console that we have disconnected from a client. */
  bleno.on('disconnect', function(clientAddress) {
      console.log(("[ mock] disconnected from address: " + clientAddress).red);
  });


  bleno.on('stateChange', (function(_this, adv_data, scan_data){
    return function(state){
      if (state === 'poweredOn') {
        bleno.startAdvertisingWithEIRData(adv_data, scan_data);
      } else {
        bleno.stopAdvertising();
      }
    };
  })(this, new Buffer(this.config['ad_records'], 'hex'), scan_data));

};

/**
 * BleMock default handlers.
 **/

BleMock.prototype.onRead = function(service, characteristic, offset, callback) {
  /* Emit a read event (global). */
  this.emit('read', service, characteristic, offset, callback);

  /* Emit a service-specific event. */
  this.emit(service, 'read', characteristic, offset, callback);
};

/**
 * onWrite()
 *
 * Called when a connected device asks for a write operation.
 **/

BleMock.prototype.onWrite = function(service, characteristic, data, offset, withoutResponse, callback) {
  /* Emit a write event (global). */
  this.emit('write', service, characteristic, data, offset, withoutResponse, callback);

  /* Emit a service-specific event. */
  this.emit(service, 'write', characteristic, data, offset, withoutResponse, callback);
};

/**
 * onSubscribe()
 *
 * Called when a connected device subscribes for notification to a specific
 * characteristic
 */

BleMock.prototype.onSubscribe = function(service, characteristic, maxValueSize, updateValueCallback) {
  /* Emit a subscribe event (global). */
  this.emit('subscribe', service, characteristic, maxValueSize, updateValueCallback);

  /* Emit a service-specific event. */
  this.emit(service, 'subscribe', characteristic, maxValueSize, updateValueCallback);
};

/**
 * onUnsubscribe()
 *
 * Called when a connected device unsubscribes for notification.
 **/

BleMock.prototype.onUnsubscribe = function(service, characteristi) {
  /* Emit a subscribe event (global). */
  this.emit('unsubscribe', service, characteristic);

  /* Emit a service-specific event. */
  this.emit(service, 'unsubscribe', characteristic);
};

/**
 * onNotify()
 *
 * Called when the device provides a notification to the connected device.
 **/

BleMock.prototype.onNotify = function(service, characteristic) {
  /* Emit a notify event (global). */
  this.emit('notify', service, characteristic);

  /* Emit a service-specific event. */
  this.emit(service, 'notify', characteristic);
};


/**
 * registerNotifyCallback()
 *
 * Registers a notification callback for a given service and characteristic.
 **/

BleMock.prototype.registerNotifyCallback = function(service, characteristic, callback) {
  if (!(service in this.subsCallbacks)) {
    this.subsCallbacks[service] = {};
  }
  this.subsCallbacks[service][characteristic] = callback;
}

/**
 * getCallback()
 *
 * Retrieve the registered notification callback for a given service
 * and characteristic.
 **/

BleMock.prototype.getCallback = function(service, characteristic) {
  if (service in this.subsCallbacks) {
    if (characteristic in this.subsCallbacks[service]) {
      /* Callback exists, return. */
      return this.subsCallbacks[service][characteristic];
    }
  }

  /* No callback found. */
  return null;
}

/**
 * unregisterNotifyCallback()
 *
 * Unregister a previously registered notification callback.
 **/

BleMock.prototype.unregisterNotifyCallback = function(service, characteristic, callback) {
  if (service in this.subsCallbacks) {
    if (characteristic in this.subsCallbacks[service]) {
      this.subsCallbacks[service][characteristic] = null;
    }
  }
}

module.exports = BleMock;
