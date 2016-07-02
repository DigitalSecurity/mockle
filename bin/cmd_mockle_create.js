#! /usr/bin/env node

/**
 * mockle-create
 *
 * This command-line tool may be used to create profile files (.mock) of
 * devices in order to clone them.
 **/

var argparse = require('argparse');
var jsonfile = require('jsonfile');
var BleProfiler = require('../profiler');

/**
 * Command-line tool
 **/
var parser = new argparse.ArgumentParser({
  version: '0.1',
  addHelp: true,
  description: 'Mockle device duplicator tool.'
});
parser.addArgument(['-o', '--output'], {
  help: 'Mock settings output file',
})
parser.addArgument(['-t', '--target'], {
  help: 'Mac address of the device to duplicate',
  required: true,
})
args = parser.parseArgs();
if (args.target != null) {
  /* Check that args.target matches a BT MAC */
  if (args.target.match(/([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i)) {
    console.log(('Profiling target ' + args.target + '...').bold);
    var prof = new BleProfiler(args.target);
    prof.getConfig(function(error, config){
      if (error == undefined) {
        if (args.output != null)
          configFilename = args.output;
        else  {
          configFilename = args.target
            .toLowerCase().split(':').join('') + '.mock';
        }
        jsonfile.writeFileSync(configFilename, config);
        console.log(('[i] Device information extracted to '+configFilename).green);
        process.exit(0);
      }
    });
  } else {
    console.log('[!] Target address is not a valid MAC address !'.red);
    process.exit(-1);
  }
} else {
  parser.printUsage();
  process.exit(0);
}
