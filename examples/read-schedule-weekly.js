'use strict';

const Bacnet = require('../index');

// create instance of Bacnet
const bacnetClient = new Bacnet({ apduTimeout: 2000 });

// emitted on errors
bacnetClient.on('error', (err) => {
  console.error(err);
  bacnetClient.close();
});

bacnetClient.readProperty('192.168.40.245', { type: 17, instance: 0 }, Bacnet.enum.PropertyIdentifier.WEEKLY_SCHEDULE, (err, value) => {
  if (err) console.log(err);
  if (value) value.values.forEach((val, index) => console.log('day: ' + index, val));
  bacnetClient.close();
});
