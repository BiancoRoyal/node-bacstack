'use strict';

const Bacnet = require('../index');

// create instance of Bacnet
const bacnetClient = new Bacnet({ apduTimeout: 2000, port: 47808, bacnetDeviceOptions: { executesReadPropertyMultiple: false, storeDiscoveredDevices: true } });

// emitted on errors
bacnetClient.on('error', (err) => {
  console.error(err);
  bacnetClient.close();
});

const requestArray = [{ objectId: { type: Bacnet.enum.ObjectType.DEVICE, instance: 620643 }, properties: [{ id: Bacnet.enum.PropertyIdentifier.ALL }] }];

bacnetClient.readPropertyMultiple('192.168.40.50', requestArray, { maxSegments: Bacnet.enum.MaxSegmentsAccepted.SEGMENTS_64 }, (err, value) => {
  if (err) console.log(err);
  if (value)
    value.values.forEach((item) => {
      console.log(item);
    });
  //bacnetClient.close();
});

/*const requestArray = [{ objectId: { type: Bacnet.enum.ObjectType.DEVICE, instance: 1319071 }, properties: [{ id: Bacnet.enum.PropertyIdentifier.ALL }] }];

bacnetClient.readPropertyMultiple('192.168.40.245', requestArray, { maxSegments: Bacnet.enum.MaxSegmentsAccepted.SEGMENTS_64 }, (err, value) => {
  if (err) console.log(err);
  if (value)
    value.values.forEach((item) => {
      console.log(item);
    });
  //bacnetClient.close();
});*/
