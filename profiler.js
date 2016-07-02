/**
 * Mockle profiler
 *
 * The BleProfiler class allows BTLE device profiling, i.e. gathering all the
 * required information to basically clone a device.
 *
 * Combined with the BleMock class, it makes it easy to create clones that
 * implement a high-level logic and state machines.
 *
 * This class may be used in projects or directly by using the `mockle-create`
 * tool provided in this package.
 **/

var async = require('async');
var events = require('events');
var noble = require('noble');
var util = require('util');
var colors = require('colors');

/**
 * Mockle BleProfiler
 **/

var BleProfiler = function(target){
  /* Device array. */
  this.target = target.toLowerCase();
  this.devices = {};
  this.currentDevice = null;
  this.configCallback = null;
};

util.inherits(BleProfiler, events.EventEmitter);

/**
 * Get a profile from a device.
 **/

BleProfiler.prototype.getConfig = function(callback){
  this.configCallback = callback;

  /* Start scanning when ble device is ready. */
  noble.on('stateChange', function(state) {
      if (state === 'poweredOn') {
          noble.startScanning();
      } else {
          noble.stopScanning();
      }
  });

  /* Track BLE advertisement reports. */
  noble._bindings._gap._hci.on(
    'leAdvertisingReport',
    function(status, type, address, addressType, report, rssi){
      this.discoverDeviceAdv(address, report, rssi);
    }.bind(this));

  /* Track BLE advertisement reports. */
  noble.on('discover', function(peripheral){
      this.discoverDevice(peripheral);
    }.bind(this));
};

BleProfiler.prototype.discoverDeviceAdv = function(bdaddr, report, rssi)  {
  if (!(bdaddr in this.devices) && bdaddr != null) {
    this.devices[bdaddr] = {
      services: {},
      adv_records: report,
      scan_response: null,
      connected: false,
    };
  } else if (bdaddr in this.devices) {
    /* Store scan response if any. */
    if (Buffer.compare(this.devices[bdaddr].adv_records, report) && (this.devices[bdaddr].scan_response == null)) {
      this.devices[bdaddr].scan_response = report;
    }
  }
};

/**
 * Device discovery.
 **/

BleProfiler.prototype.discoverDevice = function(peripheral) {
  if (peripheral.address.toLowerCase() === this.target.toLowerCase()) {
    /* Stop scanning. */
    noble.stopScanning();

    /* Try to connect to our device, and explore services. */
    this.currentDevice = peripheral;
    this.services = 0;
    this.characteristics = 0;

    peripheral.connect(function(error) {
      if (error == undefined) {
        if (!this.devices[this.currentDevice.address].connected) {
          console.log('Target detected in range, starting profiling ...'.bold);
          this.devices[this.currentDevice.address].connected = true;
          this.devices[this.currentDevice.address].name = peripheral.advertisement.localName;
          this.onDeviceConnected(this.currentDevice);
        }
      } else {
        this.onDiscoverFailed();
      }
    }.bind(this));

  }
};

/**
 * onDeviceConnected()
 *
 * Services discovery.
 */

BleProfiler.prototype.onDeviceConnected = function(peripheral) {
  /* Discover services. */
  console.log('Starting services and characteristics discovery ...'.bold);
  peripheral.discoverServices(null, (function(_this, peripheral){
    return function(error, services) {
      _this.services = services.length;
      if (error == undefined) {
        for (var service in services) {
          /* Exclude service uuid(1800) and uuid(1801),
           * because Bleno already provides them.        */
          if ((services[service].uuid != '1801') && (services[service].uuid != '1800')) {
            console.log((' * discovered service ' + services[service].uuid).yellow);
            var device = _this.devices[_this.currentDevice.address];
            device.services[services[service].uuid] = {};
            _this.onDiscoverService(peripheral, services[service], (function(t, service){
              return function(){
                t.onServiceDiscovered(service);
              };
            })(_this, services[service].uuid));
          } else {
            _this.onServiceDiscovered(service);
          }
        }
      } else {
        _this.onDiscoverFailed();
      }
    };
  })(this, peripheral));
};

/**
 * onDiscoverService()
 *
 * Characteristics discovery.
 **/

BleProfiler.prototype.onDiscoverService = function(peripheral, service, callback) {
  /* Discover characteristics. */
  service.discoverCharacteristics(null, (function(_this, peripheral, service, callback){
    return function(error, characs) {
      if (error == undefined) {
        for (var charac in characs) {
          _this.characteristics += 1;
          var device = _this.devices[_this.currentDevice.address];
          var _service = device.services[service];
          _service[characs[charac].uuid] = {
            uuid: characs[charac].uuid,
            properties: characs[charac].properties,
            descriptors: [],
          };
          console.log((' * discovered characteristic '+ service + '::' + characs[charac].uuid + ' ('+characs[charac].properties + ')').blue);
          _this.onDiscoverCharacteristic(peripheral, service, characs[charac], (function(t){
            return function(){
              t.onCharacteristicDiscovered(null);
            };
          })(_this));
        }
      } else {
        _this.onDiscoverFailed();
      }
      callback();
    };
  })(this, peripheral, service.uuid, callback));
};

/**
 * onServiceDiscovered()
 *
 * Track discovered services.
 */

BleProfiler.prototype.onServiceDiscovered = function(service) {
  this.services = this.services - 1;
};


/**
 * onCharacteristicDiscovered()
 *
 * Track discovered characteristics.
 **/

BleProfiler.prototype.onCharacteristicDiscovered = function(characteristic) {
  this.characteristics = this.characteristics - 1;
  if ((this.services == 0) && (this.characteristics == 0)) {
    console.log((' >> Target ' + this.currentDevice.address + ' successfully profiled.').bold)
    this.onDiscoverDone();
  }
}

/**
 * onDiscoverCharacteristic()
 *
 * Descriptors discovery.
 **/

BleProfiler.prototype.onDiscoverCharacteristic = function(peripheral, service, charac, callback) {
  charac.discoverDescriptors((function(_this, peripheral, service, charac, callback){
    return function(error, descriptors) {
      _this.descriptors += descriptors.length;
      var device = _this.devices[_this.currentDevice.address];
      var _charac = device.services[service][charac.uuid];
      for (var desc in descriptors) {
        _charac.descriptors.push(descriptors[desc].uuid);
      }
      callback();
    }
  })(this, peripheral, service, charac, callback));
};

/**
 * onDiscoverFailed()
 *
 * Handle failed.
 **/

BleProfiler.prototype.onDiscoverFailed = function() {
  /* Start scanning. */
  this.currentDevice = null;
  this.configCallback('discovery failed', null);
};

/**
 * onDiscoverDone()
 *
 * Discovery done, save config.
 **/

BleProfiler.prototype.onDiscoverDone = function(){
  //console.log(this.devices[this.currentDevice.address]);
  this.currentDevice = null;
  this.config = this.createMockConfig();
  this.configCallback(null, this.config);
}

BleProfiler.prototype.createMockConfig = function() {


  /* Create our serialized data. */
  var device_info = {};

  device_info['ad_records'] = this.devices[this.target].adv_records.toString('hex');
  device_info['scan_data'] = this.devices[this.target].scan_response.toString('hex');
  device_info['name'] = this.devices[this.target].name;
  device_info['services'] = [];
  device_info['address'] = this.target;
  for (var _service in this.devices[this.target].services) {
    var _chars = this.devices[this.target].services[_service];

    var service = {};
    service['uuid'] = _service;
    service['characteristics'] = [];
    for (var device_char in _chars) {
      var char = {};
      char['uuid'] = _chars[device_char]['uuid'];
      char['properties'] = _chars[device_char]['properties'];
      char['descriptors'] = _chars[device_char]['descriptors'];
      service['characteristics'].push(char);
    }
    device_info['services'].push(service);
  }
  return device_info;
}

module.exports = BleProfiler;
