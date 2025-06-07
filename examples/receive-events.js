'use strict';

const Bacnet = require('../index');

// create instance of Bacnet
const bacnetClient = new Bacnet({ apduTimeout: 2000 });

// emitted on errors
bacnetClient.on('error', (err) => {
  console.error(err);
  bacnetClient.close();
});
bacnetClient.writeProperty('192.168.40.245', { type: 2, instance: 0 }, Bacnet.enum.PropertyIdentifier.PRESENT_VALUE, [{ type: Bacnet.enum.ApplicationTag.REAL, value: 21 }], { segmentation: Bacnet.enum.Segmentation.NO_SEGMENTATION }, () => null);
bacnetClient.on('whoIs', (msg) => {
  if (msg.payload.lowLimit >= 10000 && msg.payload.highLimit <= 10000) {
    console.log('msg is for me :)');
    bacnetClient.iAmResponse(msg.header.sender.address, 10000, Bacnet.enum.Segmentation.NO_SEGMENTATION, 0, (err, value) => {
      console.log(err, value);
    });
  }
});

bacnetClient.on('eventNotify', (msg) => {
  console.log(msg);
  bacnetClient.simpleAckResponse(msg.header.sender.address, msg.service, msg.invokeId);
});
