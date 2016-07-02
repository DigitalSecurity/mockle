#! /usr/bin/env node

/**
 * mockle-spoof
 *
 * This command-line tool is a very basic BLE device cloner that relies on a
 * mock file to clone an existing device. Only services, characteristics and
 * descriptors are cloned, it's up to you to implement the logic inside your
 * clone to mimic the original device.
 **/

var argparse = require('argparse');
var util = require('util');
var colors = require('colors');


/**
 * Command-line tool
 **/
var parser = new argparse.ArgumentParser({
  version: '0.1',
  addHelp: true,
  description: 'Mockle device duplicator tool.'
});
parser.addArgument(['-d', '--device-id'], {
  help: 'Device id (hci0 -> 0)',
});
parser.addArgument(['-m', '--mock-file'], {
  help: 'Mock file (created by mockle-create)',
  required: true,
});
args = parser.parseArgs();
if (args.mock_file != null) {
  /* Select device if provided. */
  if (args.device_id != null) {
    process.env['BLENO_HCI_DEVICE_ID'] = args.device_id;
    console.log(util.format('[setup] using device #%d', args.device_id).green);
  }

  /* Create our mock. */
  var BleMock = require('../mock');
  var mock = new BleMock(args.mock_file, args.proxy);
  mock.start();
} else {
  parser.printUsage();
  process.exit(0);
}
