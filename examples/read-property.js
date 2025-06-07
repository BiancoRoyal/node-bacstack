'use strict';

const Bacnet = require('../index');

// create instance of Bacnet
const bacnetClient = new Bacnet({ apduTimeout: 2000, port: 47808, bacnetDeviceOptions: { executesReadPropertyMultiple: false, storeDiscoveredDevices: true } });

// emitted on errors
bacnetClient.on('error', (err) => {
  console.error(err);
  bacnetClient.close();
});

bacnetClient.readProperty('192.168.40.50', { type: 8, instance: 620643 }, Bacnet.enum.PropertyIdentifier.ALL, { maxSegments: Bacnet.enum.MaxSegmentsAccepted.SEGMENTS_64 }, (err, value) => {
  if (err) console.log(err);
  if (value) console.log(value.values);
  //bacnetClient.close();
});
