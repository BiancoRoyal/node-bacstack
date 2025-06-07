'use strict';

const Bacnet = require('../index');

// create instance of Bacnet
const bacnetClient = new Bacnet({ apduTimeout: 2000 });

// emitted on errors
bacnetClient.on('error', (err) => {
  console.error(err);
  bacnetClient.close();
});

/*bacnetClient.readProperty('192.168.40.50', { type: 8, instance: 620643 }, Bacnet.enum.PropertyIdentifier.OBJECT_LIST, { maxSegments: Bacnet.enum.MaxSegmentsAccepted.SEGMENTS_0 }, (err, value) => {
  if (err) console.log(err);
  if (value) console.log(value);
  //bacnetClient.close();
});*/

bacnetClient.getEventInformation('192.168.40.245', null, { maxSegments: Bacnet.enum.MaxSegmentsAccepted.SEGMENTS_0 }, (err, value) => {
  if (err) console.log(err);
  if (value)
    value.alarms.forEach((alarm) => {
      alarm.acknowledgedTransitions.values.forEach((transition) => {
        //console.log(alarm.acknowledgedTransitions);
        if (!transition.acknowledged) {
          console.log(`unaknowledged transition: ${transition.transition}, object type:${alarm.objectId.type}, instance: ${alarm.objectId.instance}. acknowledning now`);
          bacnetClient.acknowledgeAlarm(
            '192.168.40.245',
            alarm.objectId,
            transition.transition,
            'Acked by Even',
            { type: Bacnet.enum.TimeStamp.DATETIME, value: new Date(alarm.eventTimeStamps.find((t) => t.transition == transition.transition).timestamp) },
            { type: Bacnet.enum.TimeStamp.DATETIME, value: new Date() },
            { maxSegments: Bacnet.enum.Segmentation.NO_SEGMENTATION },
            (err, value) => {
              console.log(`Acknowledged: ${transition.transition}, object type:${alarm.objectId.type}, instance: ${alarm.objectId.instance}`);
            }
          );
        }
      });
    });
});

/*

bacnetClient.acknowledgeAlarm(
  '192.168.40.245',
  { type: 2, instance: 0 },
  Bacnet.enum.EventState.NORMAL,
  'Acked by Even',
  { type: Bacnet.enum.TimeStamp.DATETIME, value: new Date(2024, 1, 19, 20, 12, 42, 980) },
  { type: Bacnet.enum.TimeStamp.DATETIME, value: new Date() },
  { maxSegments: Bacnet.enum.Segmentation.NO_SEGMENTATION },
  (err, value) => {
    console.log(err, value);
  }
);
*/
