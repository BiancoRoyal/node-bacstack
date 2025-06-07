'use strict';

const Bacnet = require('../index');

// create instance of Bacnet
const bacnetClient = new Bacnet({
  apduTimeout: 2000,
  port: 47808,
});

// emitted on errors
bacnetClient.on('error', (err) => {
  console.error(err);
  bacnetClient.close();
});

bacnetClient.on('whoIs', (msg) => {
  if (!Object.keys(msg.payload).length || (msg.payload.lowLimit <= 10000 && msg.payload.highLimit >= 10000)) {
    bacnetClient.iAmResponse(msg.header.sender.address, 10000, Bacnet.enum.Segmentation.NO_SEGMENTATION, 0, (err, value) => {});
    console.log('responded to who is');
  }
});
