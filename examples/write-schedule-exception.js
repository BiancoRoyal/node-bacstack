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
  { type: 17, instance: 1 },
  Bacnet.enum.PropertyIdentifier.EXCEPTION_SCHEDULE,
  [
    {
      date: {
        type: 10,
        value: 1684965600000,
        raw: {
          year: 255,
          month: 255,
          day: 255,
          wday: 255,
        },
      },
      events: [
        {
          time: {
            type: 11,
            value: -2174778000000,
          },
          value: {
            type: 1,
            value: true,
          },
        },
        {
          time: {
            type: 11,
            value: -2174774400000,
          },
          value: {
            type: 1,
            value: false,
          },
        },
      ],
      priority: {
        type: 3,
        value: 1,
      },
    },
    {
      date: {
        type: 102,
        value: [
          {
            type: 10,
            value: 1672531200000,
          },
          {
            type: 10,
            value: 1675209600000,
          },
        ],
      },
      events: [
        {
          time: {
            type: 11,
            value: -2174716800000,
          },
          value: {
            type: 9,
            value: 3,
          },
        },
      ],
      priority: {
        type: 3,
        value: 2,
      },
    },
    {
      date: {
        type: 10,
        value: 1684965600000,
        raw: {
          year: 120,
          month: 3,
          day: 4,
          wday: 255,
        },
      },
      events: [
        {
          time: {
            type: 11,
            value: -2174778000000,
          },
          value: {
            type: 1,
            value: true,
          },
        },
        {
          time: {
            type: 11,
            value: -2174774400000,
          },
          value: {
            type: 1,
            value: false,
          },
        },
      ],
      priority: {
        type: 3,
        value: 1,
      },
    },
    {
      date: {
        type: 101,
        value: {
          month: 1,
          week: 1,
          wday: 2,
        },
      },
      events: [
        {
          time: {
            type: 11,
            value: -2174716800000,
          },
          value: {
            type: 9,
            value: 3,
          },
        },
      ],
      priority: {
        type: 3,
        value: 2,
      },
    },
  ],

  {},
  (err, value) => {
    if (err) console.log(err);
    if (value) console.log(value);
    bacnetClient.close();
  }
);
