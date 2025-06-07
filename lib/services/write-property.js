'use strict';

const baAsn1 = require('../asn1');
const baEnum = require('../enum');

module.exports.encode = (buffer, objectType, objectInstance, propertyId, arrayIndex, priority, values) => {
  baAsn1.encodeContextObjectId(buffer, 0, objectType, objectInstance);
  baAsn1.encodeContextEnumerated(buffer, 1, propertyId);
  if (arrayIndex !== baEnum.ASN1_ARRAY_ALL) {
    baAsn1.encodeContextUnsigned(buffer, 2, arrayIndex);
  }
  baAsn1.encodeOpeningTag(buffer, 3);
  values.forEach((value) => {
    baAsn1.bacappEncodeApplicationData(buffer, value);
  });
  baAsn1.encodeClosingTag(buffer, 3);
  if (priority !== baEnum.ASN1_NO_PRIORITY) {
    baAsn1.encodeContextUnsigned(buffer, 4, priority);
  }
};

module.exports.decode = (buffer, offset, apduLen) => {
  let len = 0;
  let value = {
    property: {},
  };
  let decodedValue;
  let result;
  if (!baAsn1.decodeIsContextTag(buffer, offset + len, 0)) {
    return undefined;
  }
  len++;
  decodedValue = baAsn1.decodeObjectId(buffer, offset + len);
  let objectId = {
    type: decodedValue.objectType,
    instance: decodedValue.instance,
  };
  len += decodedValue.len;
  result = baAsn1.decodeTagNumberAndValue(buffer, offset + len);
  len += result.len;
  if (result.tagNumber !== 1) {
    return undefined;
  }
  decodedValue = baAsn1.decodeEnumerated(buffer, offset + len, result.value);
  len += decodedValue.len;
  value.property.id = decodedValue.value;
  result = baAsn1.decodeTagNumberAndValue(buffer, offset + len);
  if (result.tagNumber === 2) {
    len += result.len;
    decodedValue = baAsn1.decodeUnsigned(buffer, offset + len, result.value);
    len += decodedValue.len;
    value.property.index = decodedValue.value;
  } else {
    value.property.index = baEnum.ASN1_ARRAY_ALL;
  }
  if (!baAsn1.decodeIsOpeningTagNumber(buffer, offset + len, 3)) {
    return undefined;
  }
  len++;
  const values = [];
  while (apduLen - len > 1 && !baAsn1.decodeIsClosingTagNumber(buffer, offset + len, 3)) {
    decodedValue = baAsn1.bacappDecodeApplicationData(buffer, offset + len, apduLen + offset, objectId.type, value.property.id);
    if (!decodedValue) {
      return undefined;
    }
    len += decodedValue.len;
    delete decodedValue.len;
    values.push(decodedValue);
  }
  value.value = values;
  if (!baAsn1.decodeIsClosingTagNumber(buffer, offset + len, 3)) {
    return undefined;
  }
  len++;
  value.priority = baEnum.ASN1_MAX_PRIORITY;
  if (len < apduLen) {
    result = baAsn1.decodeTagNumberAndValue(buffer, offset + len);
    if (result.tagNumber === 4) {
      len += result.len;
      decodedValue = baAsn1.decodeUnsigned(buffer, offset + len, result.value);
      len += decodedValue;
      if (decodedValue.value >= baEnum.ASN1_MIN_PRIORITY && decodedValue.value <= baEnum.ASN1_MAX_PRIORITY) {
        value.priority = decodedValue.value;
      } else {
        return undefined;
      }
    }
  }
  return {
    len,
    objectId,
    value,
  };
};

// Encode weekly schedule
module.exports.encodeWeeklySchedule = (buffer, objectType, objectInstance, propertyId, arrayIndex, priority, values) => {
  if (values.length < 7) throw new Error('Could not encode: schedulerdata(values) should have length of 7');
  // Encode start of payload
  baAsn1.encodeContextObjectId(buffer, 0, objectType, objectInstance);
  baAsn1.encodeContextEnumerated(buffer, 1, propertyId);
  if (arrayIndex !== baEnum.ASN1_ARRAY_ALL) {
    baAsn1.encodeContextUnsigned(buffer, 2, arrayIndex);
  }
  baAsn1.encodeOpeningTag(buffer, 3);

  // Encode payload data(time/value)
  let day = 0;
  for (const entry of values) {
    baAsn1.encodeOpeningTag(buffer, 0);
    for (const slot of entry) {
      slot.time.value = new Date(slot.time.value);
      baAsn1.bacappEncodeApplicationData(buffer, slot.time);
      baAsn1.bacappEncodeApplicationData(buffer, slot.value);
    }
    baAsn1.encodeClosingTag(buffer, 0);
  }
  baAsn1.encodeClosingTag(buffer, 3);
  if (priority !== baEnum.ASN1_NO_PRIORITY) {
    baAsn1.encodeContextUnsigned(buffer, 4, priority);
  }
};

// encode exception schedule
module.exports.encodeExceptionSchedule = (buffer, objectType, objectInstance, propertyId, arrayIndex, priority, values) => {
  // Encode start of payload
  baAsn1.encodeContextObjectId(buffer, 0, objectType, objectInstance);
  baAsn1.encodeContextEnumerated(buffer, 1, propertyId);
  if (arrayIndex !== baEnum.ASN1_ARRAY_ALL) {
    baAsn1.encodeContextUnsigned(buffer, 2, arrayIndex);
  }
  baAsn1.encodeOpeningTag(buffer, 3);
  // Encode payload data(time/value)
  for (const entry of values) {
    baAsn1.encodeOpeningTag(buffer, 0);
    if (entry.date.type === 10) {
      // DATE
      entry.date.value = entry.date.raw ? entry.date.raw : new Date(entry.date.value);
      baAsn1.bacappEncodeApplicationData(buffer, entry.date, true);
    } else if (entry.date.type === 102) {
      // DATE_RANGE
      baAsn1.encodeOpeningTag(buffer, 1);
      for (const row of entry.date.value) {
        row.value = row.raw ? row.raw : new Date(row.value);
        baAsn1.bacappEncodeApplicationData(buffer, row);
      }
      baAsn1.encodeClosingTag(buffer, 1);
    } else if (entry.date.type === 101) {
      // WEEKNDAY
      baAsn1.bacappEncodeApplicationData(buffer, entry.date, true);
    }
    baAsn1.encodeClosingTag(buffer, 0);
    baAsn1.encodeOpeningTag(buffer, 2);
    for (const slot of entry.events) {
      slot.time.value = new Date(slot.time.value);
      baAsn1.bacappEncodeApplicationData(buffer, slot.time);
      baAsn1.bacappEncodeApplicationData(buffer, slot.value);
    }
    baAsn1.encodeClosingTag(buffer, 2);
    baAsn1.bacappEncodeApplicationData(buffer, entry.priority, true);
  }
  baAsn1.encodeClosingTag(buffer, 3);
  if (priority !== baEnum.ASN1_NO_PRIORITY) {
    baAsn1.encodeContextUnsigned(buffer, 4, priority);
  }
};

// encode schedule effective period
module.exports.encodeScheduleEffectivePeriod = (buffer, objectType, objectInstance, propertyId, arrayIndex, priority, values) => {
  if (values.length !== 2) throw new Error('Could not encode: effective period should have a length of 2');
  // Encode start of payload
  baAsn1.encodeContextObjectId(buffer, 0, objectType, objectInstance);
  baAsn1.encodeContextEnumerated(buffer, 1, propertyId);
  if (arrayIndex !== baEnum.ASN1_ARRAY_ALL) {
    baAsn1.encodeContextUnsigned(buffer, 2, arrayIndex);
  }
  baAsn1.encodeOpeningTag(buffer, 3);
  // Encode payload data(time/value)
  for (const entry of values) {
    entry.value = entry.raw ? entry.raw : new Date(entry.value);
    baAsn1.bacappEncodeApplicationData(buffer, entry);
  }
  baAsn1.encodeClosingTag(buffer, 3);
  if (priority !== baEnum.ASN1_NO_PRIORITY) {
    baAsn1.encodeContextUnsigned(buffer, 4, priority);
  }
};

// encode calendar datelist
module.exports.encodeCalendarDatelist = (buffer, objectType, objectInstance, propertyId, arrayIndex, priority, values) => {
  // Encode start of payload
  baAsn1.encodeContextObjectId(buffer, 0, objectType, objectInstance);
  baAsn1.encodeContextEnumerated(buffer, 1, propertyId);
  if (arrayIndex !== baEnum.ASN1_ARRAY_ALL) {
    baAsn1.encodeContextUnsigned(buffer, 2, arrayIndex);
  }
  baAsn1.encodeOpeningTag(buffer, 3);
  // Encode payload data(time/value)
  for (const entry of values) {
    if (entry.type === 10) {
      // DATE
      entry.value = entry.raw ? entry.raw : new Date(entry.value);
      baAsn1.bacappEncodeApplicationData(buffer, entry, true);
    } else if (entry.type === 102) {
      // DATE_RANGE
      baAsn1.encodeOpeningTag(buffer, 1);
      for (const row of entry.value) {
        row.value = row.raw ? row.raw : new Date(row.value);
        baAsn1.bacappEncodeApplicationData(buffer, row);
      }
      baAsn1.encodeClosingTag(buffer, 1);
    } else if (entry.type === 101) {
      // WEEKNDAY
      baAsn1.bacappEncodeApplicationData(buffer, entry, true);
    }
  }
  baAsn1.encodeClosingTag(buffer, 3);
  if (priority !== baEnum.ASN1_NO_PRIORITY) {
    baAsn1.encodeContextUnsigned(buffer, 4, priority);
  }
};
