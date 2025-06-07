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
  '192.168.40.50',
  { type: Bacnet.enum.ObjectType.CALENDAR, instance: 0 },
  Bacnet.enum.PropertyIdentifier.DATE_LIST,
  [
    { type: 10, value: 1690927200000 },
    { type: 10, value: 1682546400000 },
    {
      type: 10,
      value: 1690203600000,
      raw: {
        day: 1,
        month: 4,
        year: 123,
        wday: 255,
      },
    },
    {
      type: 102, // daterange can only be written with wday set AFAIK
      value: [
        {
          type: 10,
          value: 1672531200000,
          /*raw: {
            day: 12,
            month: 6,
            year: 123,
            wday: 1,
          },*/
        },
        {
          type: 10,
          value: 1677628800000,
          /*raw: {
            day: 14,
            month: 6,
            year: 123,
            wday: 3,
          },*/
        },
      ],
    },
    {
      type: 101,
      value: { month: 2, week: 2, wday: 2 },
    },
  ],
  (err, value) => {
    if (err) console.log(err);
    if (value) console.log(value);
    bacnetClient.close();
  }
);
