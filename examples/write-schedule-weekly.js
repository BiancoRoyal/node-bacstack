'use strict';

const Bacnet = require('../index');

// create instance of Bacnet
const bacnetClient = new Bacnet({ apduTimeout: 2000 });

// emitted on errors
bacnetClient.on('error', (err) => {
  console.error(err);
  bacnetClient.close();
});

bacnetClient.writeProperty(
  '192.168.40.245',
  { type: 17, instance: 0 },
  Bacnet.enum.PropertyIdentifier.WEEKLY_SCHEDULE,
  [
    // one row for each event
    [
      {
        time: { len: 4, type: 11, value: 946706400000 },
        value: { len: 0, type: 1, value: true },
      },
      {
        time: { len: 4, type: 11, value: 946738800000 },
        value: { len: 0, type: 1, value: false },
      },
    ],
    [
      {
        time: { len: 4, type: 11, value: 946706400000 },
        value: { len: 0, type: 1, value: true },
      },
      {
        time: { len: 4, type: 11, value: 946738800000 },
        value: { len: 0, type: 1, value: false },
      },
    ],
    [
      {
        time: { len: 4, type: 11, value: 946706400000 },
        value: { len: 0, type: 1, value: true },
      },
      {
        time: { len: 4, type: 11, value: 946738800000 },
        value: { len: 0, type: 1, value: false },
      },
    ],
    [
      {
        time: { len: 4, type: 11, value: 946706400000 },
        value: { len: 0, type: 1, value: true },
      },
      {
        time: { len: 4, type: 11, value: 946738800000 },
        value: { len: 0, type: 1, value: false },
      },
    ],
    [],
    [
      {
        time: { len: 4, type: 11, value: 946706400000 },
        value: { len: 0, type: 1, value: true },
      },
      {
        time: { len: 4, type: 11, value: 946738800000 },
        value: { len: 0, type: 1, value: false },
      },
    ],
    [
      {
        time: { len: 4, type: 11, value: 946706400000 },
        value: { len: 0, type: 1, value: true },
      },
      {
        time: { len: 4, type: 11, value: 946738800000 },
        value: { len: 0, type: 1, value: false },
      },
    ],
  ],
  {},
  (err, value) => {
    if (err) console.log(err);
    if (value) console.log(value);
    bacnetClient.close();
  }
);
