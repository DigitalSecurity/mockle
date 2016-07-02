/*
 * This example is a quick demo of how to emulate a device (read-only) with Mockle.
 *
 * More info will be available soon after the NDH2016 conference ;)
 *
 */

const mockle = require('mockle').BleMock();

var mock = new mockle('./example.mock');

/* Handles read operation on some services. */
mock.on('read', function(service, characteristic, offset, callback) {
    switch(service) {
        /* Battery service. */
        case '180f':
	    switch(characteristic) {
		case '2a19':
		    callback(mock.RESULT_SUCCESS, new Buffer([0x64]));
		    break;
	    }
	    break;

        /* Link Loss. */
        case '1803':
            if (characteristic == '2a06') {
		callback(mock.RESULT_SUCCESS, new Buffer([0x00, 0x00]));
		break;
            } else {
                callback(mock.RESULT_UNLIKELY_ERROR);
            }
            break;

        case '4f1728011867a89628c01bfbc156fa45':
            callback(mock.RESULT_SUCCESS, new Buffer([0x00, 0x00]));
            break;

        case 'b0ad152499b27e1dfc0d6d399e1edf02':
            callback(mock.RESULT_SUCCESS, new Buffer([0x00, 0x00]));
            break;

        case '7b12256866777f8cf8e9af0eedb36e3a':
            switch(characteristic) {
                case '7b12199166777f8cf8e9af0eedb36e3a':
                    callback(mock.RESULT_SUCCESS, new Buffer([0x01, 0x03]));
                    break;

                case '7b12199266777f8cf8e9af0eedb36e3a':
                    callback(mock.RESULT_SUCCESS, new Buffer( [0x4e, 0x6f,0x76,0x20,0x20,0x33,0x20,0x32,0x30,0x31,0x34,0x00]));
                    break;
            }
            break;

    }
}.bind(this));

mock.start();

