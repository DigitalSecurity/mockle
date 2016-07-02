function BleMock() {
  var blemock = require('./mock');
  return blemock;
}

function BleProfiler() {
  var bleprofiler = require('./profiler');
  return bleprofiler;
}

module.exports = {
  BleMock: BleMock,
  BleProfiler: BleProfiler,
};
