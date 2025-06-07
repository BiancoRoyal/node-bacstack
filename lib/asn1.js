'use strict';

const iconv = require('iconv-lite');
const baEnum = require('./enum');
const debug = require('debug')('bacnet:asn1:debug');
const trace = require('debug')('bacnet:asn1:trace');

const START_YEAR = (module.exports.START_YEAR = 1900);
const MAX_YEARS = (module.exports.MAX_YEARS = 256);

const getBuffer = () => {
  return {
    buffer: Buffer.alloc(1472),
    offset: 0,
  };
};

const getSignedLength = (value) => {
  if (value >= -128 && value < 128) return 1;
  else if (value >= -32768 && value < 32768) return 2;
  else if (value > -8388608 && value < 8388608) return 3;
  else return 4;
};

const getUnsignedLength = (value) => {
  if (value < 0x100) return 1;
  else if (value < 0x10000) return 2;
  else if (value < 0x1000000) return 3;
  else return 4;
};

const getEncodingType = (encoding, decodingBuffer, decodingOffset) => {
  switch (encoding) {
    case baEnum.CharacterStringEncoding.UCS_2:
      if (decodingBuffer && decodingBuffer[decodingOffset] === 0xff && decodingBuffer[decodingOffset + 1] === 0xfe) {
        return 'ucs2';
      }
      return 'UTF-16BE'; // Default to big-endian
    case baEnum.CharacterStringEncoding.ISO_8859_1:
      return 'latin1';
    case baEnum.CharacterStringEncoding.MICROSOFT_DBCS:
      return 'cp850';
    case baEnum.CharacterStringEncoding.JIS_X_0208:
      return 'Shift_JIS';
    default:
      return 'utf8';
  }
};

const encodeUnsigned = (module.exports.encodeUnsigned = (buffer, value, length) => {
  buffer.buffer.writeUIntBE(value, buffer.offset, length, true);
  buffer.offset += length;
});

const encodeBacnetUnsigned = (buffer, value) => {
  encodeUnsigned(buffer, value, getUnsignedLength(value));
};

const encodeSigned = (buffer, value, length) => {
  buffer.buffer.writeIntBE(value, buffer.offset, length, true);
  buffer.offset += length;
};

const encodeBacnetSigned = (buffer, value) => {
  encodeSigned(buffer, value, getSignedLength(value));
};

const encodeBacnetReal = (buffer, value) => {
  buffer.buffer.writeFloatBE(value, buffer.offset, true);
  buffer.offset += 4;
};

const encodeBacnetDouble = (buffer, value) => {
  buffer.buffer.writeDoubleBE(value, buffer.offset, true);
  buffer.offset += 8;
};

const decodeUnsigned = (module.exports.decodeUnsigned = (buffer, offset, length) => {
  if (length === 0) {
    return {
      len: 0,
      value: 0,
    };
  }
  return {
    len: length,
    value: buffer.readUIntBE(offset, length, true),
  };
});

const decodeEnumerated = (module.exports.decodeEnumerated = (buffer, offset, lenValue) => {
  return decodeUnsigned(buffer, offset, lenValue);
});

const encodeBacnetObjectId = (module.exports.encodeBacnetObjectId = (buffer, objectType, instance) => {
  const value = (((objectType & baEnum.ASN1_MAX_OBJECT) << baEnum.ASN1_INSTANCE_BITS) | (instance & baEnum.ASN1_MAX_INSTANCE)) >>> 0;
  encodeUnsigned(buffer, value, 4);
});

const encodeTag = (module.exports.encodeTag = (buffer, tagNumber, contextSpecific, lenValueType) => {
  let len = 1;
  const tmp = new Array(3);
  tmp[0] = 0;
  if (contextSpecific) {
    tmp[0] |= 0x8;
  }
  if (tagNumber <= 14) {
    tmp[0] |= tagNumber << 4;
  } else {
    tmp[0] |= 0xf0;
    tmp[1] = tagNumber;
    len++;
  }
  if (lenValueType <= 4) {
    tmp[0] |= lenValueType;
    Buffer.from(tmp).copy(buffer.buffer, buffer.offset, 0, len);
    buffer.offset += len;
  } else {
    tmp[0] |= 5;
    if (lenValueType <= 253) {
      tmp[len++] = lenValueType;
      Buffer.from(tmp).copy(buffer.buffer, buffer.offset, 0, len);
      buffer.offset += len;
    } else if (lenValueType <= 65535) {
      tmp[len++] = 254;
      Buffer.from(tmp).copy(buffer.buffer, buffer.offset, 0, len);
      buffer.offset += len;
      encodeUnsigned(buffer, lenValueType, 2);
    } else {
      tmp[len++] = 255;
      Buffer.from(tmp).copy(buffer.buffer, buffer.offset, 0, len);
      buffer.offset += len;
      encodeUnsigned(buffer, lenValueType, 4);
    }
  }
});

const encodeBacnetEnumerated = (buffer, value) => {
  encodeBacnetUnsigned(buffer, value);
};

const isExtendedTagNumber = (x) => {
  return (x & 0xf0) === 0xf0;
};

const isExtendedValue = (x) => {
  return (x & 0x07) === 5;
};

const isContextSpecific = (x) => {
  return (x & 0x8) === 0x8;
};

const isOpeningTag = (x) => {
  return (x & 0x07) === 6;
};

const isClosingTag = (x) => {
  return (x & 0x07) === 7;
};

const encodeContextReal = (module.exports.encodeContextReal = (buffer, tagNumber, value) => {
  encodeTag(buffer, tagNumber, true, 4);
  encodeBacnetReal(buffer, value);
});

const encodeContextUnsigned = (module.exports.encodeContextUnsigned = (buffer, tagNumber, value) => {
  encodeTag(buffer, tagNumber, true, getUnsignedLength(value));
  encodeBacnetUnsigned(buffer, value);
});

const encodeContextEnumerated = (module.exports.encodeContextEnumerated = (buffer, tagNumber, value) => {
  encodeContextUnsigned(buffer, tagNumber, value);
});

const encodeOctetString = (buffer, octetString, octetOffset, octetCount) => {
  if (octetString) {
    for (let i = octetOffset; i < octetOffset + octetCount; i++) {
      buffer.buffer[buffer.offset++] = octetString[i];
    }
  }
};

const encodeApplicationOctetString = (module.exports.encodeApplicationOctetString = (buffer, octetString, octetOffset, octetCount) => {
  encodeTag(buffer, baEnum.ApplicationTag.OCTET_STRING, false, octetCount);
  encodeOctetString(buffer, octetString, octetOffset, octetCount);
});

const encodeApplicationNull = (buffer) => {
  buffer.buffer[buffer.offset++] = baEnum.ApplicationTag.NULL;
};

const encodeApplicationBoolean = (module.exports.encodeApplicationBoolean = (buffer, booleanValue) => {
  encodeTag(buffer, baEnum.ApplicationTag.BOOLEAN, false, booleanValue ? 1 : 0);
});

const encodeApplicationReal = (buffer, value) => {
  encodeTag(buffer, baEnum.ApplicationTag.REAL, false, 4);
  encodeBacnetReal(buffer, value);
};

const encodeApplicationDouble = (buffer, value) => {
  encodeTag(buffer, baEnum.ApplicationTag.DOUBLE, false, 8);
  encodeBacnetDouble(buffer, value);
};

const bitstringBytesUsed = (bitString) => {
  let len = 0;
  if (bitString.bitsUsed > 0) {
    const lastBit = bitString.bitsUsed - 1;
    const usedBytes = lastBit / 8 + 1;
    len = Math.floor(usedBytes);
  }
  return len;
};

const encodeApplicationObjectId = (module.exports.encodeApplicationObjectId = (buffer, objectType, instance) => {
  const tmp = getBuffer();
  encodeBacnetObjectId(tmp, objectType, instance);
  encodeTag(buffer, baEnum.ApplicationTag.OBJECTIDENTIFIER, false, tmp.offset);
  tmp.buffer.copy(buffer.buffer, buffer.offset, 0, tmp.offset);
  buffer.offset += tmp.offset;
});

const encodeApplicationUnsigned = (module.exports.encodeApplicationUnsigned = (buffer, value) => {
  const tmp = getBuffer();
  encodeBacnetUnsigned(tmp, value);
  encodeTag(buffer, baEnum.ApplicationTag.UNSIGNED_INTEGER, false, tmp.offset);
  tmp.buffer.copy(buffer.buffer, buffer.offset, 0, tmp.offset);
  buffer.offset += tmp.offset;
});

const encodeApplicationEnumerated = (module.exports.encodeApplicationEnumerated = (buffer, value) => {
  const tmp = getBuffer();
  encodeBacnetEnumerated(tmp, value);
  encodeTag(buffer, baEnum.ApplicationTag.ENUMERATED, false, tmp.offset);
  tmp.buffer.copy(buffer.buffer, buffer.offset, 0, tmp.offset);
  buffer.offset += tmp.offset;
});

const encodeApplicationSigned = (module.exports.encodeApplicationSigned = (buffer, value, contextSpecific = false) => {
  const tmp = getBuffer();
  encodeBacnetSigned(tmp, value);
  encodeTag(buffer, baEnum.ApplicationTag.SIGNED_INTEGER, contextSpecific, tmp.offset);
  tmp.buffer.copy(buffer.buffer, buffer.offset, 0, tmp.offset);
  buffer.offset += tmp.offset;
});

const byteReverseBits = (inByte) => {
  let outByte = 0;
  if ((inByte & 1) > 0) {
    outByte |= 0x80;
  }
  if ((inByte & 2) > 0) {
    outByte |= 0x40;
  }
  if ((inByte & 4) > 0) {
    outByte |= 0x20;
  }
  if ((inByte & 8) > 0) {
    outByte |= 0x10;
  }
  if ((inByte & 16) > 0) {
    outByte |= 0x8;
  }
  if ((inByte & 32) > 0) {
    outByte |= 0x4;
  }
  if ((inByte & 64) > 0) {
    outByte |= 0x2;
  }
  if ((inByte & 128) > 0) {
    outByte |= 1;
  }
  return outByte;
};

const bitstringOctet = (bitString, octetIndex) => {
  let octet = 0;
  if (bitString.value && octetIndex < baEnum.ASN1_MAX_BITSTRING_BYTES) {
    octet = bitString.value[octetIndex];
  }
  return octet;
};

const encodeBitstring = (buffer, bitString) => {
  if (bitString.bitsUsed === 0) {
    buffer.buffer[buffer.offset++] = 0;
  } else {
    const usedBytes = bitstringBytesUsed(bitString);
    const remainingUsedBits = bitString.bitsUsed - (usedBytes - 1) * 8;
    buffer.buffer[buffer.offset++] = 8 - remainingUsedBits;
    for (let i = 0; i < usedBytes; i++) {
      buffer.buffer[buffer.offset++] = byteReverseBits(bitstringOctet(bitString, i));
    }
  }
};

const encodeApplicationBitstring = (module.exports.encodeApplicationBitstring = (buffer, bitString) => {
  let bitStringEncodedLength = 1;
  bitStringEncodedLength += bitstringBytesUsed(bitString);
  encodeTag(buffer, baEnum.ApplicationTag.BIT_STRING, false, bitStringEncodedLength);
  encodeBitstring(buffer, bitString);
});

const encodeBacnetDate = (module.exports.encodeBacnetDate = (buffer, value) => {
  // check if raw type
  if (typeof value.getTime === 'function') {
    if (value.getTime() === new Date(-3600000).getTime()) {
      buffer.buffer[buffer.offset++] = 0xff;
      buffer.buffer[buffer.offset++] = 0xff;
      buffer.buffer[buffer.offset++] = 0xff;
      buffer.buffer[buffer.offset++] = 0xff;
      return;
    }

    if (value.getFullYear() >= START_YEAR) {
      buffer.buffer[buffer.offset++] = value.getFullYear() - START_YEAR;
    } else if (value.getFullYear() < MAX_YEARS /* 1900 + 255 max */) {
      buffer.buffer[buffer.offset++] = value.getFullYear();
    } else {
      throw new Error('invaide year: ' + value.getFullYear());
    }
    buffer.buffer[buffer.offset++] = value.getMonth() + 1;
    buffer.buffer[buffer.offset++] = value.getDate();
    buffer.buffer[buffer.offset++] = value.getDay() === 0 ? 7 : value.getDay();
  } else {
    buffer.buffer[buffer.offset++] = value.year;
    buffer.buffer[buffer.offset++] = value.month;
    buffer.buffer[buffer.offset++] = value.day;
    buffer.buffer[buffer.offset++] = value.wday;
  }
});

const encodeApplicationDate = (module.exports.encodeApplicationDate = (buffer, value, contextSpecific = false) => {
  encodeTag(buffer, contextSpecific ? 0 : baEnum.ApplicationTag.DATE, contextSpecific, 4);
  encodeBacnetDate(buffer, value);
});

const encodeBacnetTime = (buffer, value) => {
  buffer.buffer[buffer.offset++] = value.getHours();
  buffer.buffer[buffer.offset++] = value.getMinutes();
  buffer.buffer[buffer.offset++] = value.getSeconds();
  buffer.buffer[buffer.offset++] = value.getMilliseconds() / 10;
};

const encodeApplicationWeekNday = (module.exports.encodeApplicationWeekNday = (buffer, value, contextSpecific = false) => {
  encodeTag(buffer, contextSpecific ? 2 : baEnum.ApplicationTag.WEEKNDAY, contextSpecific, 3);
  encodeBacnetWeekNday(buffer, value);
});

const encodeBacnetWeekNday = (buffer, value) => {
  buffer.buffer[buffer.offset++] = value.month;
  buffer.buffer[buffer.offset++] = value.week;
  buffer.buffer[buffer.offset++] = value.wday;
};

const encodeApplicationTime = (module.exports.encodeApplicationTime = (buffer, value) => {
  encodeTag(buffer, baEnum.ApplicationTag.TIME, false, 4);
  encodeBacnetTime(buffer, value);
});

const bacappEncodeDatetime = (buffer, value) => {
  if (value !== new Date(1, 1, 1)) {
    encodeApplicationDate(buffer, value);
    encodeApplicationTime(buffer, value);
  }
};

const encodeContextObjectId = (module.exports.encodeContextObjectId = (buffer, tagNumber, objectType, instance) => {
  encodeTag(buffer, tagNumber, true, 4);
  encodeBacnetObjectId(buffer, objectType, instance);
});

const encodeOpeningTag = (module.exports.encodeOpeningTag = (buffer, tagNumber) => {
  let len = 1;
  const tmp = new Array(2);
  tmp[0] = 0x8;
  if (tagNumber <= 14) {
    tmp[0] |= tagNumber << 4;
  } else {
    tmp[0] |= 0xf0;
    tmp[1] = tagNumber;
    len++;
  }
  tmp[0] |= 6;
  Buffer.from(tmp).copy(buffer.buffer, buffer.offset, 0, len);
  buffer.offset += len;
});

const encodeClosingTag = (module.exports.encodeClosingTag = (buffer, tagNumber) => {
  let len = 1;
  const tmp = new Array(2);
  tmp[0] = 0x8;
  if (tagNumber <= 14) {
    tmp[0] |= tagNumber << 4;
  } else {
    tmp[0] |= 0xf0;
    tmp[1] = tagNumber;
    len++;
  }
  tmp[0] |= 7;
  Buffer.from(tmp).copy(buffer.buffer, buffer.offset, 0, len);
  buffer.offset += len;
});

const encodeReadAccessSpecification = (module.exports.encodeReadAccessSpecification = (buffer, value) => {
  encodeContextObjectId(buffer, 0, value.objectId.type, value.objectId.instance);
  encodeOpeningTag(buffer, 1);
  value.properties.forEach((p) => {
    encodeContextEnumerated(buffer, 0, p.id);
    if (p.index && p.index !== baEnum.ASN1_ARRAY_ALL) {
      encodeContextUnsigned(buffer, 1, p.index);
    }
  });
  encodeClosingTag(buffer, 1);
});

const encodeContextBoolean = (module.exports.encodeContextBoolean = (buffer, tagNumber, booleanValue) => {
  encodeTag(buffer, tagNumber, true, 1);
  buffer.buffer.writeUInt8(booleanValue ? 1 : 0, buffer.offset, true);
  buffer.offset += 1;
});

const encodeCovSubscription = (buffer, value) => {
  encodeOpeningTag(buffer, 0);
  encodeOpeningTag(buffer, 0);
  encodeOpeningTag(buffer, 1);
  encodeApplicationUnsigned(buffer, value.recipient.network);
  if (value.recipient.network === 0xffff) {
    encodeApplicationOctetString(buffer, 0, 0, 0);
  } else {
    encodeApplicationOctetString(buffer, value.recipient.address, 0, value.recipient.address.length);
  }
  encodeClosingTag(buffer, 1);
  encodeClosingTag(buffer, 0);
  encodeContextUnsigned(buffer, 1, value.subscriptionProcessId);
  encodeClosingTag(buffer, 0);
  encodeOpeningTag(buffer, 1);
  encodeContextObjectId(buffer, 0, value.monitoredObjectId.type, value.monitoredObjectId.instance);
  encodeContextEnumerated(buffer, 1, value.monitoredProperty.id);
  if (value.monitoredProperty.index !== baEnum.ASN1_ARRAY_ALL) {
    encodeContextUnsigned(buffer, 2, value.monitoredProperty.index);
  }
  encodeClosingTag(buffer, 1);
  encodeContextBoolean(buffer, 2, value.issueConfirmedNotifications);
  encodeContextUnsigned(buffer, 3, value.timeRemaining);
  if (value.covIncrement > 0) {
    encodeContextReal(buffer, 4, value.covIncrement);
  }
};

const bacappEncodeApplicationData = (module.exports.bacappEncodeApplicationData = (buffer, value, contextSpecific = false) => {
  if (value.value === null) {
    value.type = baEnum.ApplicationTag.NULL;
  }
  switch (value.type) {
    case baEnum.ApplicationTag.NULL:
      encodeApplicationNull(buffer);
      break;
    case baEnum.ApplicationTag.BOOLEAN:
      encodeApplicationBoolean(buffer, value.value);
      break;
    case baEnum.ApplicationTag.UNSIGNED_INTEGER:
      encodeApplicationUnsigned(buffer, value.value);
      break;
    case baEnum.ApplicationTag.SIGNED_INTEGER:
      encodeApplicationSigned(buffer, value.value, contextSpecific);
      break;
    case baEnum.ApplicationTag.REAL:
      encodeApplicationReal(buffer, value.value);
      break;
    case baEnum.ApplicationTag.DOUBLE:
      encodeApplicationDouble(buffer, value.value);
      break;
    case baEnum.ApplicationTag.OCTET_STRING:
      encodeApplicationOctetString(buffer, value.value, 0, value.value.length);
      break;
    case baEnum.ApplicationTag.CHARACTER_STRING:
      encodeApplicationCharacterString(buffer, value.value, value.encoding);
      break;
    case baEnum.ApplicationTag.BIT_STRING:
      encodeApplicationBitstring(buffer, value.value);
      break;
    case baEnum.ApplicationTag.ENUMERATED:
      encodeApplicationEnumerated(buffer, value.value);
      break;
    case baEnum.ApplicationTag.DATE:
      encodeApplicationDate(buffer, value.value, contextSpecific);
      break;
    case baEnum.ApplicationTag.WEEKNDAY:
      encodeApplicationWeekNday(buffer, value.value, contextSpecific);
      break;
    case baEnum.ApplicationTag.TIME:
      encodeApplicationTime(buffer, value.value);
      break;
    case baEnum.ApplicationTag.TIMESTAMP:
      bacappEncodeTimestamp(buffer, value.value);
      break;
    case baEnum.ApplicationTag.DATETIME:
      bacappEncodeDatetime(buffer, value.value);
      break;
    case baEnum.ApplicationTag.OBJECTIDENTIFIER:
      encodeApplicationObjectId(buffer, value.value.type, value.value.instance);
      break;
    case baEnum.ApplicationTag.COV_SUBSCRIPTION:
      encodeCovSubscription(buffer, value.value);
      break;
    case baEnum.ApplicationTag.READ_ACCESS_RESULT:
      encodeReadAccessResult(buffer, value.value);
      break;
    case baEnum.ApplicationTag.READ_ACCESS_SPECIFICATION:
      encodeReadAccessSpecification(buffer, value.value);
      break;
    case undefined:
      throw new Error('Cannot encode a value if the type has not been specified');
    default:
      throw 'No encode for ApplicationTag type: ' + baEnum.getEnumName(baEnum.ApplicationTag, value.type);
  }
});

const bacappEncodeDeviceObjPropertyRef = (buffer, value) => {
  encodeContextObjectId(buffer, 0, value.objectId.type, value.objectId.instance);
  encodeContextEnumerated(buffer, 1, value.id);
  if (value.arrayIndex !== baEnum.ASN1_ARRAY_ALL) {
    encodeContextUnsigned(buffer, 2, value.arrayIndex);
  }
  if (value.deviceIndentifier.type === baEnum.ObjectType.DEVICE) {
    encodeContextObjectId(buffer, 3, value.deviceIndentifier.type, value.deviceIndentifier.instance);
  }
};

const bacappEncodeContextDeviceObjPropertyRef = (module.exports.bacappEncodeContextDeviceObjPropertyRef = (buffer, tagNumber, value) => {
  encodeOpeningTag(buffer, tagNumber);
  bacappEncodeDeviceObjPropertyRef(buffer, value);
  encodeClosingTag(buffer, tagNumber);
});

const bacappEncodePropertyState = (module.exports.bacappEncodePropertyState = (buffer, value) => {
  switch (value.type) {
    case baEnum.PropertyStates.BOOLEAN_VALUE:
      encodeContextBoolean(buffer, 0, value.state === 1);
      break;
    case baEnum.PropertyStates.BINARY_VALUE:
      encodeContextEnumerated(buffer, 1, value.state);
      break;
    case baEnum.PropertyStates.EVENT_TYPE:
      encodeContextEnumerated(buffer, 2, value.state);
      break;
    case baEnum.PropertyStates.POLARITY:
      encodeContextEnumerated(buffer, 3, value.state);
      break;
    case baEnum.PropertyStates.PROGRAM_CHANGE:
      encodeContextEnumerated(buffer, 4, value.state);
      break;
    case baEnum.PropertyStates.PROGRAM_STATE:
      encodeContextEnumerated(buffer, 5, value.state);
      break;
    case baEnum.PropertyStates.REASON_FOR_HALT:
      encodeContextEnumerated(buffer, 6, value.state);
      break;
    case baEnum.PropertyStates.RELIABILITY:
      encodeContextEnumerated(buffer, 7, value.state);
      break;
    case baEnum.PropertyStates.STATE:
      encodeContextEnumerated(buffer, 8, value.state);
      break;
    case baEnum.PropertyStates.SYSTEM_STATUS:
      encodeContextEnumerated(buffer, 9, value.state);
      break;
    case baEnum.PropertyStates.UNITS:
      encodeContextEnumerated(buffer, 10, value.state);
      break;
    case baEnum.PropertyStates.UNSIGNED_VALUE:
      encodeContextUnsigned(buffer, 11, value.state);
      break;
    case baEnum.PropertyStates.LIFE_SAFETY_MODE:
      encodeContextEnumerated(buffer, 12, value.state);
      break;
    case baEnum.PropertyStates.LIFE_SAFETY_STATE:
      encodeContextEnumerated(buffer, 13, value.state);
      break;
    default:
      break;
  }
});

const encodeContextBitstring = (module.exports.encodeContextBitstring = (buffer, tagNumber, bitString) => {
  let bitStringEncodedLength = 1;
  bitStringEncodedLength += bitstringBytesUsed(bitString);
  encodeTag(buffer, tagNumber, true, bitStringEncodedLength);
  encodeBitstring(buffer, bitString);
});

const encodeContextSigned = (module.exports.encodeContextSigned = (buffer, tagNumber, value) => {
  encodeTag(buffer, tagNumber, true, getSignedLength(value));
  encodeBacnetSigned(buffer, value);
});

const encodeContextTime = (buffer, tagNumber, value) => {
  encodeTag(buffer, tagNumber, true, 4);
  encodeBacnetTime(buffer, value);
};

const bacappEncodeContextDatetime = (buffer, tagNumber, value) => {
  if (value !== new Date(1, 1, 1)) {
    encodeOpeningTag(buffer, tagNumber);
    bacappEncodeDatetime(buffer, value);
    encodeClosingTag(buffer, tagNumber);
  } else {
    throw new Error('wrong Datetime while bacapp encoding context');
  }
};

const decodeTagNumber = (module.exports.decodeTagNumber = (buffer, offset) => {
  let len = 1;
  let tagNumber;
  if (isExtendedTagNumber(buffer[offset])) {
    tagNumber = buffer[offset + 1];
    len++;
  } else {
    tagNumber = buffer[offset] >> 4;
  }
  return {
    len,
    tagNumber,
  };
});

const decodeIsContextTag = (module.exports.decodeIsContextTag = (buffer, offset, tagNumber) => {
  const result = decodeTagNumber(buffer, offset);
  return isContextSpecific(buffer[offset]) && result.tagNumber === tagNumber;
});

const decodeIsOpeningTagNumber = (module.exports.decodeIsOpeningTagNumber = (buffer, offset, tagNumber) => {
  const result = decodeTagNumber(buffer, offset);
  return isOpeningTag(buffer[offset]) && result.tagNumber === tagNumber;
});

const decodeIsClosingTagNumber = (module.exports.decodeIsClosingTagNumber = (buffer, offset, tagNumber) => {
  const result = decodeTagNumber(buffer, offset);
  return isClosingTag(buffer[offset]) && result.tagNumber === tagNumber;
});

const decodeIsClosingTag = (module.exports.decodeIsClosingTag = (buffer, offset) => {
  return (buffer[offset] & 0x07) === 7;
});

const decodeIsOpeningTag = (module.exports.decodeIsOpeningTag = (buffer, offset) => {
  return (buffer[offset] & 0x07) === 6;
});

const decodeObjectId = (module.exports.decodeObjectId = (buffer, offset) => {
  const result = decodeUnsigned(buffer, offset, 4);
  const objectType = (result.value >> baEnum.ASN1_INSTANCE_BITS) & baEnum.ASN1_MAX_OBJECT;
  const instance = result.value & baEnum.ASN1_MAX_INSTANCE;
  return {
    len: result.len,
    objectType,
    instance,
  };
});

const decodeObjectIdSafe = (buffer, offset, lenValue) => {
  if (lenValue !== 4) {
    return {
      len: 0,
      objectType: 0,
      instance: 0,
    };
  } else {
    return decodeObjectId(buffer, offset);
  }
};

const decodeTagNumberAndValue = (module.exports.decodeTagNumberAndValue = (buffer, offset) => {
  let value;
  let result = decodeTagNumber(buffer, offset);
  let len = result.len;
  if (isExtendedValue(buffer[offset])) {
    if (buffer[offset + len] === 255) {
      len++;
      result = decodeUnsigned(buffer, offset + len, 4);
      len += result.len;
      value = result.value;
    } else if (buffer[offset + len] === 254) {
      len++;
      result = decodeUnsigned(buffer, offset + len, 2);
      len += result.len;
      value = result.value;
    } else {
      value = buffer[offset + len];
      len++;
    }
  } else if (isOpeningTag(buffer[offset])) {
    value = 0;
  } else if (isClosingTag(buffer[offset])) {
    value = 0;
  } else {
    value = buffer[offset] & 0x07;
  }
  return {
    len,
    tagNumber: result.tagNumber,
    value,
  };
});

const bacappDecodeApplicationData = (module.exports.bacappDecodeApplicationData = (buffer, offset, maxOffset, objectType, propertyId) => {
  if (!isContextSpecific(buffer[offset])) {
    let result = decodeTagNumberAndValue(buffer, offset);
    if (result) {
      let len = result.len;
      result = bacappDecodeData(buffer, offset + len, maxOffset, result.tagNumber, result.value);
      if (!result) {
        return undefined;
      }
      let resObj = {
        len: len + result.len,
        type: result.type,
        value: result.value,
      };
      // HACK: Drop string specific handling ASAP
      if (result.encoding !== undefined) resObj.encoding = result.encoding;
      return resObj;
    }
  } else {
    return bacappDecodeContextApplicationData(buffer, offset, maxOffset, objectType, propertyId);
  }
});

const encodeReadAccessResult = (module.exports.encodeReadAccessResult = (buffer, value) => {
  encodeContextObjectId(buffer, 0, value.objectId.type, value.objectId.instance);
  encodeOpeningTag(buffer, 1);
  value.values.forEach((item) => {
    encodeContextEnumerated(buffer, 2, item.property.id);
    if (item.property.index !== baEnum.ASN1_ARRAY_ALL) {
      encodeContextUnsigned(buffer, 3, item.property.index);
    }
    if (item.value && item.value[0] && item.value[0].value && item.value[0].value.type === 'BacnetError') {
      encodeOpeningTag(buffer, 5);
      encodeApplicationEnumerated(buffer, item.value[0].value.errorClass);
      encodeApplicationEnumerated(buffer, item.value[0].value.errorCode);
      encodeClosingTag(buffer, 5);
    } else {
      encodeOpeningTag(buffer, 4);
      item.value.forEach((subItem) => {
        bacappEncodeApplicationData(buffer, subItem);
      });
      encodeClosingTag(buffer, 4);
    }
  });
  encodeClosingTag(buffer, 1);
});

const decodeReadAccessResult = (module.exports.decodeReadAccessResult = (buffer, offset, apduLen) => {
  let len = 0;
  let value = {};
  if (!decodeIsContextTag(buffer, offset + len, 0)) {
    return undefined;
  }
  len++;
  let result = decodeObjectId(buffer, offset + len);
  value.objectId = {
    type: result.objectType,
    instance: result.instance,
  };
  len += result.len;
  if (!decodeIsOpeningTagNumber(buffer, offset + len, 1)) {
    return -1; // TODO: why?
  }
  len++;

  const values = [];
  while (apduLen - len > 0) {
    let newEntry = {};
    if (decodeIsClosingTagNumber(buffer, offset + len, 1)) {
      len++;
      break;
    }
    result = decodeTagNumberAndValue(buffer, offset + len);
    len += result.len;
    if (result.tagNumber !== 2) {
      return undefined;
    }
    result = decodeEnumerated(buffer, offset + len, result.value);
    newEntry.id = result.value;
    len += result.len;

    result = decodeTagNumberAndValue(buffer, offset + len);
    if (result.tagNumber === 3) {
      len += result.len;
      result = decodeUnsigned(buffer, offset + len, result.value);
      newEntry.index = result.value;
      len += result.len;
    } else {
      newEntry.index = baEnum.ASN1_ARRAY_ALL;
    }
    result = decodeTagNumberAndValue(buffer, offset + len);
    len += result.len;
    if (result.tagNumber === 4) {
      const localValues = [];
      while (len + offset <= buffer.length && !decodeIsClosingTagNumber(buffer, offset + len, 4)) {
        let localResult = bacappDecodeApplicationData(buffer, offset + len, apduLen + offset - 1, value.objectId.type, newEntry.id);
        if (!localResult) {
          return undefined;
        }
        len += localResult.len;
        let resObj = {
          value: localResult.value,
          type: localResult.type,
        };
        // HACK: Drop string specific handling ASAP
        if (localResult.encoding !== undefined) resObj.encoding = localResult.encoding;
        localValues.push(resObj);
      }
      if (!decodeIsClosingTagNumber(buffer, offset + len, 4)) {
        return undefined;
      }
      if (localValues.count === 2 && localValues[0].type === baEnum.ApplicationTag.DATE && localValues[1].type === baEnum.ApplicationTag.TIME) {
        const date = localValues[0].value;
        const time = localValues[1].value;
        const bdatetime = new Date(date.year, date.month, date.day, time.hour, time.minute, time.second, time.millisecond);
        newEntry.value = [{ type: baEnum.ApplicationTag.DATETIME, value: bdatetime }];
      } else {
        newEntry.value = localValues;
      }
      len++;
    } else if (result.tagNumber === 5) {
      let err = {};
      result = decodeTagNumberAndValue(buffer, offset + len);
      len += result.len;
      result = decodeEnumerated(buffer, offset + len, result.value);
      len += result.len;
      err.errorClass = result.value;
      result = decodeTagNumberAndValue(buffer, offset + len);
      len += result.len;
      result = decodeEnumerated(buffer, offset + len, result.value);
      len += result.len;
      err.errorCode = result.value;
      if (!decodeIsClosingTagNumber(buffer, offset + len, 5)) {
        return undefined;
      }
      len++;
      newEntry.value = [
        {
          type: baEnum.ApplicationTag.ERROR,
          value: err,
        },
      ];
    }
    values.push(newEntry);
  }
  value.values = values;
  return {
    len,
    value,
  };
});

const decodeSigned = (module.exports.decodeSigned = (buffer, offset, length) => {
  return {
    len: length,
    value: buffer.readIntBE(offset, length, true),
  };
});

const decodeReal = (module.exports.decodeReal = (buffer, offset) => {
  return {
    len: 4,
    value: buffer.readFloatBE(offset, true),
  };
});

const decodeRealSafe = (buffer, offset, lenValue) => {
  if (lenValue !== 4) {
    return {
      len: lenValue,
      value: 0,
    };
  } else {
    return decodeReal(buffer, offset);
  }
};

const decodeDouble = (buffer, offset) => {
  return {
    len: 8,
    value: buffer.readDoubleBE(offset, true),
  };
};

const decodeDoubleSafe = (buffer, offset, lenValue) => {
  if (lenValue !== 8) {
    return {
      len: lenValue,
      value: 0,
    };
  } else {
    return decodeDouble(buffer, offset);
  }
};

const decodeOctetString = (module.exports.decodeOctetString = (buffer, offset, maxLength, octetStringOffset, octetStringLength) => {
  const octetString = [];
  for (let i = octetStringOffset; i < octetStringOffset + octetStringLength; i++) {
    octetString.push(buffer[offset + i]);
  }
  return {
    len: octetStringLength,
    value: octetString,
  };
});

const multiCharsetCharacterstringDecode = (buffer, offset, maxLength, encoding, length) => {
  const stringBuf = Buffer.alloc(length);
  buffer.copy(stringBuf, 0, offset, offset + length);
  return {
    value: iconv.decode(stringBuf, getEncodingType(encoding, buffer, offset)),
    len: length + 1,
    encoding,
  };
};

const decodeCharacterString = (module.exports.decodeCharacterString = (buffer, offset, maxLength, lenValue) => {
  return multiCharsetCharacterstringDecode(buffer, offset + 1, maxLength, buffer[offset], lenValue - 1);
});

const bitstringSetBitsUsed = (bitString, bytesUsed, unusedBits) => {
  bitString.bitsUsed = bytesUsed * 8;
  bitString.bitsUsed -= unusedBits;
};

const decodeBitstring = (module.exports.decodeBitstring = (buffer, offset, lenValue) => {
  let len = 0;
  let bitString = {};
  bitString.value = [];
  if (lenValue > 0) {
    const bytesUsed = lenValue - 1;
    if (bytesUsed <= baEnum.ASN1_MAX_BITSTRING_BYTES) {
      len = 1;
      for (let i = 0; i < bytesUsed; i++) {
        bitString.value.push(byteReverseBits(buffer[offset + len++]));
      }
      const unusedBits = buffer[offset] & 0x07;
      bitstringSetBitsUsed(bitString, bytesUsed, unusedBits);
    }
  }
  return {
    len,
    value: bitString,
  };
});

const decodeDate = (module.exports.decodeDate = (buffer, offset) => {
  let date;
  const year = buffer[offset] + 1900;
  const month = buffer[offset + 1];
  const day = buffer[offset + 2];
  const wday = buffer[offset + 3];
  if (month === 0xff && day === 0xff && wday === 0xff && year - 1900 === 0xff) {
    date = new Date(-3600000);
  } else {
    date = new Date(year, month - 1, day);
  }
  return {
    len: 4,
    value: date,
    raw: { year: year - 1900, month: month, day: day, wday: wday },
  };
});

const decodeDateSafe = (buffer, offset, lenValue) => {
  if (lenValue !== 4) {
    return {
      len: lenValue,
      value: new Date(-3600000),
    };
  } else {
    return decodeDate(buffer, offset);
  }
};

const decodeApplicationDate = (module.exports.decodeApplicationDate = (buffer, offset) => {
  const result = decodeTagNumber(buffer, offset);
  if (result.tagNumber === baEnum.ApplicationTag.DATE) {
    const value = decodeDate(buffer, offset + 1);
    return {
      len: value.len + 1,
      value,
    };
  }
  return undefined;
});

const decodeBacnetTime = (module.exports.decodeBacnetTime = (buffer, offset) => {
  let value;
  const hour = buffer[offset + 0];
  const min = buffer[offset + 1];
  const sec = buffer[offset + 2];
  let hundredths = buffer[offset + 3];
  if (hour === 0xff && min === 0xff && sec === 0xff && hundredths === 0xff) {
    value = new Date(1, 1, 1);
  } else {
    if (hundredths > 100) hundredths = 0;
    value = new Date(1, 1, 1, hour, min, sec, hundredths * 10);
  }
  return {
    len: 4,
    value,
  };
});

const decodeBacnetTimeSafe = (buffer, offset, lenValue) => {
  if (lenValue !== 4) {
    return {
      len: lenValue,
      value: new Date(1, 1, 1),
    };
  } else {
    return decodeBacnetTime(buffer, offset);
  }
};

const decodeApplicationTime = (module.exports.decodeApplicationTime = (buffer, offset) => {
  const result = decodeTagNumber(buffer, offset);
  if (result.tagNumber === baEnum.ApplicationTag.TIME) {
    const value = decodeBacnetTime(buffer, offset + 1);
    return {
      len: value.len + 1,
      value,
    };
  }
  return undefined;
});

const decodeBacnetDatetime = (buffer, offset) => {
  let len = 0;
  const date = decodeApplicationDate(buffer, offset + len);
  len += date.len;
  const time = decodeApplicationTime(buffer, offset + len);
  len += time.len;
  return {
    len,
    value: new Date(date.year, date.month, date.day, time.hour, time.minute, time.second, time.millisecond),
  };
};

const bacappDecodeData = (buffer, offset, maxLength, tagDataType, lenValueType) => {
  let result;
  let value = {
    len: 0,
    type: tagDataType,
  };
  switch (tagDataType) {
    case baEnum.ApplicationTag.NULL:
      value.value = null;
      break;
    case baEnum.ApplicationTag.BOOLEAN:
      value.value = lenValueType > 0;
      break;
    case baEnum.ApplicationTag.UNSIGNED_INTEGER:
      result = decodeUnsigned(buffer, offset, lenValueType);
      value.len += result.len;
      value.value = result.value;
      break;
    case baEnum.ApplicationTag.SIGNED_INTEGER:
      result = decodeSigned(buffer, offset, lenValueType);
      value.len += result.len;
      value.value = result.value;
      break;
    case baEnum.ApplicationTag.REAL:
      result = decodeRealSafe(buffer, offset, lenValueType);
      value.len += result.len;
      value.value = result.value;
      break;
    case baEnum.ApplicationTag.DOUBLE:
      result = decodeDoubleSafe(buffer, offset, lenValueType);
      value.len += result.len;
      value.value = result.value;
      break;
    case baEnum.ApplicationTag.OCTET_STRING:
      result = decodeOctetString(buffer, offset, maxLength, 0, lenValueType);
      value.len += result.len;
      value.value = result.value;
      break;
    case baEnum.ApplicationTag.CHARACTER_STRING:
      result = decodeCharacterString(buffer, offset, maxLength, lenValueType);
      value.len += result.len;
      value.value = result.value;
      value.encoding = result.encoding;
      break;
    case baEnum.ApplicationTag.BIT_STRING:
      result = decodeBitstring(buffer, offset, lenValueType);
      value.len += result.len;
      value.value = result.value;
      break;
    case baEnum.ApplicationTag.ENUMERATED:
      result = decodeEnumerated(buffer, offset, lenValueType);
      value.len += result.len;
      value.value = result.value;
      break;
    case baEnum.ApplicationTag.DATE:
      result = decodeDateSafe(buffer, offset, lenValueType);
      value.len += result.len;
      value.value = result.value;
      value.raw = result.raw;
      break;
    case baEnum.ApplicationTag.WEEKNDAY:
      result = decodeCalendarWeekDay(buffer, offset);
      value.len += result.len;
      value.value = result.value;
      break;
    case baEnum.ApplicationTag.TIME:
      result = decodeBacnetTimeSafe(buffer, offset, lenValueType);
      value.len += result.len;
      value.value = result.value;
      break;
    case baEnum.ApplicationTag.OBJECTIDENTIFIER:
      result = decodeObjectIdSafe(buffer, offset, lenValueType);
      value.len += result.len;
      value.value = { type: result.objectType, instance: result.instance };
      break;
    default:
      break;
  }
  return value;
};

const bacappContextTagType = (property, tagNumber) => {
  let tag = 0;
  switch (property) {
    case baEnum.PropertyIdentifier.ACTUAL_SHED_LEVEL:
    case baEnum.PropertyIdentifier.REQUESTED_SHED_LEVEL:
    case baEnum.PropertyIdentifier.EXPECTED_SHED_LEVEL:
      switch (tagNumber) {
        case 0:
        case 1:
          tag = baEnum.ApplicationTag.UNSIGNED_INTEGER;
          break;
        case 2:
          tag = baEnum.ApplicationTag.REAL;
          break;
        default:
          break;
      }
      break;
    case baEnum.PropertyIdentifier.ACTION:
      switch (tagNumber) {
        case 0:
        case 1:
          tag = baEnum.ApplicationTag.OBJECTIDENTIFIER;
          break;
        case 2:
          tag = baEnum.ApplicationTag.ENUMERATED;
          break;
        case 3:
        case 5:
        case 6:
          tag = baEnum.ApplicationTag.UNSIGNED_INTEGER;
          break;
        case 7:
        case 8:
          tag = baEnum.ApplicationTag.BOOLEAN;
          break;
        default:
          break;
      }
      break;
    case baEnum.PropertyIdentifier.LIST_OF_GROUP_MEMBERS:
      switch (tagNumber) {
        case 0:
          tag = baEnum.ApplicationTag.OBJECTIDENTIFIER;
          break;
        default:
          break;
      }
      break;
    case baEnum.PropertyIdentifier.EXCEPTION_SCHEDULE:
      switch (tagNumber) {
        case 1:
          tag = baEnum.ApplicationTag.OBJECTIDENTIFIER;
          break;
        case 3:
          tag = baEnum.ApplicationTag.UNSIGNED_INTEGER;
          break;
        default:
          break;
      }
      break;
    case baEnum.PropertyIdentifier.LOG_DEVICE_OBJECT_PROPERTY:
      switch (tagNumber) {
        case 0:
        case 3:
          tag = baEnum.ApplicationTag.OBJECTIDENTIFIER;
          break;
        case 1:
          tag = baEnum.ApplicationTag.ENUMERATED;
          break;
        case 2:
          tag = baEnum.ApplicationTag.UNSIGNED_INTEGER;
          break;
        default:
          break;
      }
      break;
    case baEnum.PropertyIdentifier.SUBORDINATE_LIST:
      switch (tagNumber) {
        case 0:
        case 1:
          tag = baEnum.ApplicationTag.OBJECTIDENTIFIER;
          break;
        default:
          break;
      }
      break;
    case baEnum.PropertyIdentifier.RECIPIENT_LIST:
      switch (tagNumber) {
        case 0:
          tag = baEnum.ApplicationTag.OBJECTIDENTIFIER;
          break;
        default:
          break;
      }
      break;
    case baEnum.PropertyIdentifier.ACTIVE_COV_SUBSCRIPTIONS:
      switch (tagNumber) {
        case 0:
        case 1:
          break;
        case 2:
          tag = baEnum.ApplicationTag.BOOLEAN;
          break;
        case 3:
          tag = baEnum.ApplicationTag.UNSIGNED_INTEGER;
          break;
        case 4:
          tag = baEnum.ApplicationTag.REAL;
          break;
        default:
          break;
      }
      break;
    default:
      break;
  }
  return tag;
};

const decodeDeviceObjPropertyRef = (buffer, offset) => {
  let len = 0;
  let arrayIndex = baEnum.ASN1_ARRAY_ALL;
  if (!decodeIsContextTag(buffer, offset + len, 0)) {
    return undefined;
  }
  len++;
  let objectId = decodeObjectId(buffer, offset + len);
  len += objectId.len;
  let result = decodeTagNumberAndValue(buffer, offset + len);
  len += result.len;
  if (result.tagNumber !== 1) {
    return undefined;
  }
  let id = decodeEnumerated(buffer, offset + len, result.value);
  len += id.len;
  result = decodeTagNumberAndValue(buffer, offset + len);
  if (result.tagNumber === 2) {
    len += result.len;
    arrayIndex = decodeUnsigned(buffer, offset + len, result.value);
    len += arrayIndex.len;
  }
  if (decodeIsContextTag(buffer, offset + len, 3)) {
    if (!isClosingTag(buffer[offset + len])) {
      len++;
      objectId = decodeObjectId(buffer, offset + len);
      len += objectId.len;
    }
  }
  return {
    len,
    value: {
      objectId: objectId,
      id: id,
    },
  };
};

const decodeReadAccessSpecification = (module.exports.decodeReadAccessSpecification = (buffer, offset, apduLen) => {
  let len = 0;
  let value = {};
  if (!decodeIsContextTag(buffer, offset + len, 0)) {
    return undefined;
  }
  len++;
  let decodedValue = decodeObjectId(buffer, offset + len);
  value.objectId = {
    type: decodedValue.objectType,
    instance: decodedValue.instance,
  };
  len += decodedValue.len;
  if (!decodeIsOpeningTagNumber(buffer, offset + len, 1)) {
    return undefined;
  }
  len++;
  const propertyIdAndArrayIndex = [];
  while (apduLen - len > 1 && !decodeIsClosingTagNumber(buffer, offset + len, 1)) {
    let propertyRef = {};
    if (!isContextSpecific(buffer[offset + len])) {
      return undefined;
    }
    let result = decodeTagNumberAndValue(buffer, offset + len);
    len += result.len;
    if (result.tagNumber !== 0) {
      return undefined;
    }
    if (len + result.value >= apduLen) {
      return undefined;
    }
    decodedValue = decodeEnumerated(buffer, offset + len, result.value);
    propertyRef.id = decodedValue.value;
    len += decodedValue.len;
    propertyRef.index = baEnum.ASN1_ARRAY_ALL;
    if (isContextSpecific(buffer[offset + len]) && !isClosingTag(buffer[offset + len])) {
      const tmp = decodeTagNumberAndValue(buffer, offset + len);
      if (tmp.tagNumber === 1) {
        len += tmp.len;
        if (len + tmp.value >= apduLen) {
          return undefined;
        }
        decodedValue = decodeUnsigned(buffer, offset + len, tmp.value);
        propertyRef.index = decodedValue.value;
        len += decodedValue.len;
      }
    }
    propertyIdAndArrayIndex.push(propertyRef);
  }
  if (!decodeIsClosingTagNumber(buffer, offset + len, 1)) {
    return undefined;
  }
  len++;
  value.properties = propertyIdAndArrayIndex;
  return {
    len,
    value,
  };
});

const decodeCovSubscription = (buffer, offset, apduLen) => {
  let len = 0;
  let value = {};
  let result;
  let decodedValue;
  value.recipient = {};
  if (!decodeIsOpeningTagNumber(buffer, offset + len, 0)) {
    return undefined;
  }
  len++;
  if (!decodeIsOpeningTagNumber(buffer, offset + len, 0)) {
    return undefined;
  }
  len++;
  if (!decodeIsOpeningTagNumber(buffer, offset + len, 1)) {
    return undefined;
  }
  len++;
  result = decodeTagNumberAndValue(buffer, offset + len);
  len += result.len;
  if (result.tagNumber !== baEnum.ApplicationTag.UNSIGNED_INTEGER) {
    return undefined;
  }
  decodedValue = decodeUnsigned(buffer, offset + len, result.value);
  len += decodedValue.len;
  value.recipient.net = decodedValue.value;
  result = decodeTagNumberAndValue(buffer, offset + len);
  len += result.len;
  if (result.tagNumber !== baEnum.ApplicationTag.OCTET_STRING) {
    return undefined;
  }
  decodedValue = decodeOctetString(buffer, offset + len, apduLen, 0, result.value);
  len += decodedValue.len;
  value.recipient.adr = decodedValue.value;
  if (!decodeIsClosingTagNumber(buffer, offset + len, 1)) {
    return undefined;
  }
  len++;
  if (!decodeIsClosingTagNumber(buffer, offset + len, 0)) {
    return undefined;
  }
  len++;
  result = decodeTagNumberAndValue(buffer, offset + len);
  len += result.len;
  if (result.tagNumber !== 1) {
    return undefined;
  }
  decodedValue = decodeUnsigned(buffer, offset + len, result.value);
  len += decodedValue.len;
  value.subscriptionProcessId = decodedValue.value;
  if (!decodeIsClosingTagNumber(buffer, offset + len, 0)) {
    return undefined;
  }
  len++;
  if (!decodeIsOpeningTagNumber(buffer, offset + len, 1)) {
    return undefined;
  }
  len++;
  result = decodeTagNumberAndValue(buffer, offset + len);
  len += result.len;
  if (result.tagNumber !== 0) {
    return undefined;
  }
  decodedValue = decodeObjectId(buffer, offset + len);
  len += decodedValue.len;
  value.monitoredObjectId = {
    type: decodedValue.objectType,
    instance: decodedValue.instance,
  };
  result = decodeTagNumberAndValue(buffer, offset + len);
  len += result.len;
  if (result.tagNumber !== 1) {
    return undefined;
  }
  decodedValue = decodeEnumerated(buffer, offset + len, result.value);
  len += decodedValue.len;
  value.monitoredProperty = {};
  value.monitoredProperty.id = decodedValue.value;
  result = decodeTagNumberAndValue(buffer, offset + len);
  if (result.tagNumber === 2) {
    len += result.len;
    decodedValue = decodeUnsigned(buffer, offset + len, result.value);
    len += decodedValue.len;
    value.monitoredProperty.index = decodedValue.value;
  } else {
    value.monitoredProperty.index = baEnum.ASN1_ARRAY_ALL;
  }
  if (!decodeIsClosingTagNumber(buffer, offset + len, 1)) {
    return undefined;
  }
  len++;
  result = decodeTagNumberAndValue(buffer, offset + len);
  len += result.len;
  if (result.tagNumber !== 2) {
    return undefined;
  }
  value.issueConfirmedNotifications = buffer[offset + len] > 0;
  len++;
  result = decodeTagNumberAndValue(buffer, offset + len);
  len += result.len;
  if (result.tagNumber !== 3) {
    return undefined;
  }
  decodedValue = decodeUnsigned(buffer, offset + len, result.value);
  len += decodedValue.len;
  value.timeRemaining = decodedValue.value;
  if (len < apduLen && !isClosingTag(buffer[offset + len])) {
    result = decodeTagNumberAndValue(buffer, offset + len);
    len += result.len;
    if (result.tagNumber !== 4) {
      return undefined;
    }
    decodedValue = decodeReal(buffer, offset + len);
    len += decodedValue.len;
    value.covIncrement = decodedValue.value;
  }
  return {
    len,
    value,
  };
};

const decodeCalendarDate = (buffer, offset) => {
  return {
    len: 4,
    year: buffer[offset],
    month: buffer[offset + 1],
    day: buffer[offset + 2],
    wday: buffer[offset + 3],
  };
};

const decodeCalendarDateRange = (buffer, offset) => {
  let len = 1;
  const startDate = decodeDate(buffer, offset + len);
  len += startDate.len + 1;
  const endDate = decodeDate(buffer, offset + len);
  len += endDate.len + 1;
  return {
    len,
    startDate,
    endDate,
  };
};

const decodeCalendarWeekDay = (buffer, offset) => {
  return {
    len: 3,
    value: {
      month: buffer[offset],
      week: buffer[offset + 1],
      wday: buffer[offset + 2],
    },
  };
};

const decodeCalendar = (buffer, offset, apduLen) => {
  let len = 0;
  const entries = [];
  let decodedValue;
  while (len < apduLen) {
    const result = decodeTagNumber(buffer, offset + len);
    len += result.len;
    switch (result.tagNumber) {
      case 0:
        decodedValue = decodeCalendarDate(buffer, offset + len);
        len += decodedValue.len;
        entries.push(decodedValue);
        break;
      case 1:
        decodedValue = decodeCalendarDateRange(buffer, offset + len);
        len += decodedValue.len;
        entries.push(decodedValue);
        break;
      case 2:
        decodedValue = decodeCalendarWeekDay(buffer, offset + len);
        len += decodedValue.len;
        entries.push(decodedValue);
        break;
      default:
        return {
          len: len - 1,
          value: entries,
        };
    }
  }
};

const bacappDecodeContextApplicationData = (buffer, offset, maxOffset, objectType, propertyId) => {
  let len = 0;
  let result;
  if (isContextSpecific(buffer[offset])) {
    if (propertyId === baEnum.PropertyIdentifier.LIST_OF_GROUP_MEMBERS) {
      result = decodeReadAccessSpecification(buffer, offset, maxOffset);
      if (!result) {
        return undefined;
      }
      return {
        type: baEnum.ApplicationTag.READ_ACCESS_SPECIFICATION,
        value: result.value,
        len: result.len,
      };
    } else if (propertyId === baEnum.PropertyIdentifier.ACTIVE_COV_SUBSCRIPTIONS) {
      result = decodeCovSubscription(buffer, offset, maxOffset);
      if (!result) {
        return undefined;
      }
      return {
        type: baEnum.ApplicationTag.COV_SUBSCRIPTION,
        value: result.value,
        len: result.len,
      };
    } else if (objectType === baEnum.ObjectType.GROUP && propertyId === baEnum.PropertyIdentifier.PRESENT_VALUE) {
      result = decodeReadAccessResult(buffer, offset, maxOffset);
      if (!result) {
        return undefined;
      }
      return {
        type: baEnum.ApplicationTag.READ_ACCESS_RESULT,
        value: result.value,
        len: result.len,
      };
    } else if (propertyId === baEnum.PropertyIdentifier.LIST_OF_OBJECT_PROPERTY_REFERENCES || propertyId === baEnum.PropertyIdentifier.LOG_DEVICE_OBJECT_PROPERTY || propertyId === baEnum.PropertyIdentifier.OBJECT_PROPERTY_REFERENCE) {
      result = decodeDeviceObjPropertyRef(buffer, offset, maxOffset);
      if (!result) {
        return undefined;
      }
      return {
        type: baEnum.ApplicationTag.OBJECT_PROPERTY_REFERENCE,
        value: result.value,
        len: result.len,
      };
    } else if (propertyId === baEnum.PropertyIdentifier.DATE_LIST) {
      result = decodeCalendar(buffer, offset, maxOffset);
      if (!result) {
        return undefined;
      }
      return {
        type: baEnum.ApplicationTag.CONTEXT_SPECIFIC_DECODED,
        value: result.value,
        len: result.len,
      };
    } else if (propertyId === baEnum.PropertyIdentifier.EVENT_TIME_STAMPS) {
      let subEvtResult;
      let evtResult = decodeTagNumberAndValue(buffer, offset + len);
      len += 1;
      if (evtResult.tagNumber === 0) {
        subEvtResult = decodeBacnetTime(buffer, offset + 1);
        return {
          type: baEnum.ApplicationTag.TIMESTAMP,
          value: subEvtResult.value,
          len: subEvtResult.len + 1,
        };
      } else if (evtResult.tagNumber === 1) {
        subEvtResult = decodeUnsigned(buffer, offset + len, evtResult.value);
        return {
          type: baEnum.ApplicationTag.UNSIGNED_INTEGER,
          value: subEvtResult.value,
          len: subEvtResult.len + 1,
        };
      } else if (evtResult.tagNumber === 2) {
        subEvtResult = decodeBacnetDatetime(buffer, offset + len);
        return {
          type: baEnum.ApplicationTag.TIMESTAMP,
          value: subEvtResult.value,
          len: subEvtResult.len + 2,
        };
      } else {
        return undefined;
      }
    }
    const list = [];
    let tagResult = decodeTagNumberAndValue(buffer, offset + len);
    let multipleValues = isOpeningTag(buffer[offset + len]);
    while (len + offset <= maxOffset && !isClosingTag(buffer[offset + len])) {
      let subResult = decodeTagNumberAndValue(buffer, offset + len);
      if (!subResult) {
        return undefined;
      }
      if (subResult.value === 0) {
        len += subResult.len;
        result = bacappDecodeApplicationData(buffer, offset + len, maxOffset, baEnum.ASN1_MAX_OBJECT_TYPE, baEnum.ASN1_MAX_PROPERTY_ID);
        if (!result) {
          return undefined;
        }
        list.push(result);
        len += result.len;
      } else {
        const overrideTagNumber = bacappContextTagType(propertyId, subResult.tagNumber);
        if (overrideTagNumber !== baEnum.ASN1_MAX_APPLICATION_TAG) {
          subResult.tagNumber = overrideTagNumber;
        }
        let bacappResult = bacappDecodeData(buffer, offset + len + subResult.len, maxOffset, subResult.tagNumber, subResult.value);
        if (!bacappResult) {
          return undefined;
        }
        if (bacappResult.len === subResult.value) {
          let resObj = {
            value: bacappResult.value,
            type: bacappResult.type,
          };
          // HACK: Drop string specific handling ASAP
          if (bacappResult.encoding !== undefined) resObj.encoding = bacappResult.encoding;
          list.push(resObj);
          len += subResult.len + subResult.value;
        } else {
          list.push({
            value: buffer.slice(offset + len + subResult.len, offset + len + subResult.len + subResult.value),
            type: baEnum.ApplicationTag.CONTEXT_SPECIFIC_ENCODED,
          });
          len += subResult.len + subResult.value;
        }
      }
      if (multipleValues === false) {
        return {
          len,
          value: list[0],
          type: baEnum.ApplicationTag.CONTEXT_SPECIFIC_DECODED,
        };
      }
    }
    if (len + offset > maxOffset) {
      return undefined;
    }
    if (decodeIsClosingTagNumber(buffer, offset + len, tagResult.tagNumber)) {
      len++;
    }
    return {
      len,
      value: list,
      type: baEnum.ApplicationTag.CONTEXT_SPECIFIC_DECODED,
    };
  }
  return undefined;
};

const bacappEncodeTimestamp = (module.exports.bacappEncodeTimestamp = (buffer, value) => {
  switch (value.type) {
    case baEnum.TimeStamp.TIME:
      encodeContextTime(buffer, 0, value.value);
      break;
    case baEnum.TimeStamp.SEQUENCE_NUMBER:
      encodeContextUnsigned(buffer, 1, value.value);
      break;
    case baEnum.TimeStamp.DATETIME:
      bacappEncodeContextDatetime(buffer, 2, value.value);
      break;
    default:
      throw new Error('NOT_IMPLEMENTED');
  }
});

const bacappEncodeContextTimestamp = (module.exports.bacappEncodeContextTimestamp = (buffer, tagNumber, value) => {
  encodeOpeningTag(buffer, tagNumber);
  bacappEncodeTimestamp(buffer, value);
  encodeClosingTag(buffer, tagNumber);
});

const decodeContextCharacterString = (module.exports.decodeContextCharacterString = (buffer, offset, maxLength, tagNumber) => {
  let len = 0;
  if (!decodeIsContextTag(buffer, offset + len, tagNumber)) {
    return undefined;
  }
  const result = decodeTagNumberAndValue(buffer, offset + len);
  len += result.len;
  const decodedValue = multiCharsetCharacterstringDecode(buffer, offset + 1 + len, maxLength, buffer[offset + len], result.value - 1);
  if (!decodedValue) {
    return undefined;
  }
  len += result.value;
  return {
    len,
    value: decodedValue.value,
    encoding: decodedValue.encoding,
  };
});

const decodeIsContextTagWithLength = (buffer, offset, tagNumber) => {
  const result = decodeTagNumber(buffer, offset);
  return {
    len: result.len,
    value: isContextSpecific(buffer[offset]) && result.tagNumber === tagNumber,
  };
};

module.exports.decodeContextObjectId = (buffer, offset, tagNumber) => {
  const result = decodeIsContextTagWithLength(buffer, offset, tagNumber);
  if (!result.value) {
    return undefined;
  }
  const decodedValue = decodeObjectId(buffer, offset + result.len);
  decodedValue.len = decodedValue.len + result.len;
  return decodedValue;
};

const encodeBacnetCharacterString = (buffer, value, encoding) => {
  encoding = encoding || baEnum.CharacterStringEncoding.UTF_8;
  buffer.buffer[buffer.offset++] = encoding;
  const bufEncoded = iconv.encode(value, getEncodingType(encoding));
  buffer.offset += bufEncoded.copy(buffer.buffer, buffer.offset);
};

const encodeApplicationCharacterString = (module.exports.encodeApplicationCharacterString = (buffer, value, encoding) => {
  const tmp = getBuffer();
  encodeBacnetCharacterString(tmp, value, encoding);
  encodeTag(buffer, baEnum.ApplicationTag.CHARACTER_STRING, false, tmp.offset);
  tmp.buffer.copy(buffer.buffer, buffer.offset, 0, tmp.offset);
  buffer.offset += tmp.offset;
});

const encodeContextCharacterString = (module.exports.encodeContextCharacterString = (buffer, tagNumber, value, encoding) => {
  const tmp = getBuffer();
  encodeBacnetCharacterString(tmp, value, encoding);
  encodeTag(buffer, tagNumber, true, tmp.offset);
  tmp.buffer.copy(buffer.buffer, buffer.offset, 0, tmp.offset);
  buffer.offset += tmp.offset;
});

//fucntion to decode bacnet scheduler

const decodeWeeklySchedule = (module.exports.decodeWeeklySchedule = (buffer, offset, apduLen) => {
  // prop 123, obj type 17
  // if not opening context tag 0 we have a problem
  if (!decodeIsOpeningTagNumber(buffer, offset, 0)) return undefined;
  let len = 1;
  let day = 0;
  let result = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  while (len < apduLen && !decodeIsClosingTagNumber(buffer, offset + len, 3)) {
    /** Begin parse */
    // check if opening tag
    if (decodeIsOpeningTagNumber(buffer, offset + len, 0)) len += decodeTagNumberAndValue(buffer, offset + len).len;

    // check if closing tag
    if (decodeIsClosingTagNumber(buffer, offset + len, 0)) {
      len += decodeTagNumberAndValue(buffer, offset + len).len;
      day = day + 1;
    } else {
      // Get tag id and decode first
      let decoded = { time: null, value: null };
      let tag = decodeTagNumberAndValue(buffer, offset + len);
      len += tag.len;
      let value = bacappDecodeData(buffer, offset + len, apduLen + offset, tag.tagNumber, tag.value);
      if (!value) return undefined;
      value.value = value.value.getTime();
      decoded.time = value;
      len += value.len;
      // get tag id and decode write value
      tag = decodeTagNumberAndValue(buffer, offset + len);
      len += tag.len;
      value = bacappDecodeData(buffer, offset + len, apduLen + offset, tag.tagNumber, tag.value);
      if (!value) return undefined;
      len += value.len;
      decoded.value = value;
      result[day].push(decoded);
      // check if end of parsing day
      if (decodeIsClosingTagNumber(buffer, offset + len, 0)) {
        len += decodeTagNumberAndValue(buffer, offset + len).len;
        day = day + 1;
      }
    }
  }
  len++;
  return { len: len, values: Object.values(result) };
});

const decodeExceptionSchedule = (module.exports.decodeExceptionSchedule = (buffer, offset, apduLen) => {
  let len = 0;
  // prop 38, obj type 17
  // if not opening context tag 0 we have a problem
  if (decodeIsClosingTagNumber(buffer, offset, 3)) {
    len += decodeTagNumberAndValue(buffer, offset).len;
    return { len: len, values: [] };
  }
  if (!decodeIsOpeningTagNumber(buffer, offset, 0)) return undefined;
  len++;
  let day = 0;
  let result = [];
  while (len < apduLen && !decodeIsClosingTagNumber(buffer, offset + len, 3)) {
    /** Begin parse */
    // check if opening tag
    if (decodeIsOpeningTagNumber(buffer, offset + len, 0)) len += decodeTagNumberAndValue(buffer, offset + len).len;

    // check if closing tag
    if (decodeIsClosingTagNumber(buffer, offset + len, 0)) {
      len += decodeTagNumberAndValue(buffer, offset + len).len;
    } else {
      // Get tag id and decode first
      let decoded = { date: null, events: [], priority: null };
      let tag = decodeTagNumberAndValue(buffer, offset + len);
      len += tag.len;
      if (tag.tagNumber === 1 || decodeIsOpeningTagNumber(buffer, offset + len, 1)) {
        // daterange, two rows of type DATE
        if (decodeIsOpeningTagNumber(buffer, offset + len, 1)) len += decodeTagNumberAndValue(buffer, offset + len).len;
        const dates = [];
        while (!decodeIsClosingTagNumber(buffer, offset + len, 1)) {
          let tag = decodeTagNumberAndValue(buffer, offset + len);
          len += tag.len;
          let value = bacappDecodeData(buffer, offset + len, apduLen + offset, tag.tagNumber, tag.value);
          len += value.len;
          tag = decodeTagNumberAndValue(buffer, offset + len);
          if (!value) return undefined;
          value.value = value.value.getTime();
          dates.push(value);
        }
        tag = decodeTagNumberAndValue(buffer, offset + len);
        len += tag.len;
        decoded.date = {
          len: 8,
          type: 102,
          value: dates,
        };
      } else {
        // hack: heck context tag and parse DATE and WEEKNDAY
        if (tag.tagNumber === 0 && tag.value === 4) {
          let value = bacappDecodeData(buffer, offset + len, apduLen + offset, baEnum.ApplicationTag.DATE, tag.value);
          if (!value) return undefined;
          value.value = value.value.getTime();
          decoded.date = value;
          len += value.len;
        } else if (tag.tagNumber === 2 && tag.value === 3) {
          // WEEKNDAY
          let value = bacappDecodeData(buffer, offset + len, apduLen + offset, baEnum.ApplicationTag.WEEKNDAY, tag.value); // context specific tag, override type to WEEKNDAY
          if (!value) return undefined;
          decoded.date = value;
          len += value.len;
        }
      }

      // check if closing tag = 0 and next opening tag = 2
      if (decodeIsClosingTagNumber(buffer, offset + len, 0) && decodeIsOpeningTagNumber(buffer, offset + len + 1, 2)) {
        len += decodeTagNumberAndValue(buffer, offset + len).len;
        len += decodeTagNumberAndValue(buffer, offset + len).len;
        // parse events
        while (len < apduLen && !decodeIsClosingTagNumber(buffer, offset + len, 2)) {
          let event = { time: null, value: null };
          // parse time
          tag = decodeTagNumberAndValue(buffer, offset + len);
          len += tag.len;
          let value = bacappDecodeData(buffer, offset + len, apduLen + offset, tag.tagNumber, tag.value);
          if (!value) return undefined;
          len += value.len;
          try {
            value.value = value.value.getTime();
          } catch (e) {
            value.value = new Date(value.value).getTime();
          }

          event.time = value;
          // parse value
          tag = decodeTagNumberAndValue(buffer, offset + len);
          len += tag.len;
          value = bacappDecodeData(buffer, offset + len, apduLen + offset, tag.tagNumber, tag.value);
          if (!value) return undefined;
          event.value = value;
          len += value.len;
          decoded.events.push(event);
          if (decodeIsClosingTagNumber(buffer, offset + len, 2)) {
            // if closing, break and add length
            len += decodeTagNumberAndValue(buffer, offset + len).len;
            break;
          }
        }
      }
      // when parsing is done, we get priority number
      tag = decodeTagNumberAndValue(buffer, offset + len);
      if (decodeIsClosingTagNumber(buffer, offset + len, 3)) return { len: len, values: result };
      len += tag.len;
      let value = bacappDecodeData(buffer, offset + len, apduLen + offset, tag.tagNumber, tag.value);
      decoded.priority = value;
      len += value.len;
      result.push(decoded);
    }
  }
  len++;
  return { len: len, values: result };
});

// decode schedule effective period
const decodeScheduleEffectivePeriod = (module.exports.decodeScheduleEffectivePeriod = (buffer, offset, apduLen) => {
  // prop 32, obj type 17
  // if not opening context tag 0 we have a problem
  if (!decodeIsOpeningTagNumber(buffer, offset - 1, 3)) return undefined;
  let len = 0;
  let result = [];
  while (len < apduLen && !decodeIsClosingTagNumber(buffer, offset + len, 3)) {
    /** Begin parse */
    let tag = decodeTagNumberAndValue(buffer, offset + len);
    len += tag.len;
    let value = bacappDecodeData(buffer, offset + len, apduLen + offset, tag.tagNumber, tag.value); // context specific tag
    if (!value) return undefined;
    value.value = value.value.getTime();
    result.push(value);
    len += value.len;
  }
  len++;
  return { len: len, values: result };
});

//decode calendar datelist
const decodeCalendarDatelist = (module.exports.decodeCalendarDatelist = (buffer, offset, apduLen) => {
  // prop 23, obj type 6
  // if not opening context tag 0 we have a problem
  if (!decodeIsOpeningTagNumber(buffer, offset - 1, 3)) return undefined;
  let len = 0;
  let result = [];
  while (len < apduLen && !decodeIsClosingTagNumber(buffer, offset + len, 3)) {
    /** Begin parse */
    let tag = decodeTagNumberAndValue(buffer, offset + len);
    len += tag.len;
    if (tag.tagNumber === 1 || decodeIsOpeningTagNumber(buffer, offset + len, 1)) {
      // daterange, two rows of type DATE
      if (decodeIsOpeningTagNumber(buffer, offset + len, 1)) len += decodeTagNumberAndValue(buffer, offset + len).len;
      const dates = [];
      while (!decodeIsClosingTagNumber(buffer, offset + len, 1)) {
        let tag = decodeTagNumberAndValue(buffer, offset + len);
        len += tag.len;
        let value = bacappDecodeData(buffer, offset + len, apduLen + offset, tag.tagNumber, tag.value);
        len += value.len;
        tag = decodeTagNumberAndValue(buffer, offset + len);
        if (!value) return undefined;
        value.value = value.value.getTime();
        dates.push(value);
      }
      tag = decodeTagNumberAndValue(buffer, offset + len);
      len += tag.len;
      result.push({
        len: 8,
        type: 102,
        value: dates,
      });
    } else {
      if (tag.tagNumber === 0 && tag.value === 4) {
        // E_DATE
        let value = bacappDecodeData(buffer, offset + len, apduLen + offset, baEnum.ApplicationTag.DATE, tag.value); // context specific tag, override type to DATE
        if (!value) return undefined;
        value.value = value.value.getTime();
        result.push(value);
        len += value.len;
      } else if (tag.tagNumber === 2 && tag.value === 3) {
        // WEEKNDAY
        let value = bacappDecodeData(buffer, offset + len, apduLen + offset, baEnum.ApplicationTag.WEEKNDAY, tag.value); // context specific tag, override type to WEEKNDAY
        if (!value) return undefined;
        result.push(value);
        len += value.len;
      }
    }
  }
  len++;
  return { len: len, values: result };
});

//decode calendar datelist
const decodeRange = (module.exports.decodeRange = (buffer, offset, apduLen) => {
  if (!decodeIsOpeningTagNumber(buffer, offset - 1, 5) || !decodeIsOpeningTagNumber(buffer, offset, 0)) return undefined; // check that opening tag 5 and then 0 is present
  let len = 0;
  let result = [];
  while (len < apduLen && !decodeIsClosingTagNumber(buffer, offset + len, 5)) {
    let tag = decodeTagNumberAndValue(buffer, offset + len); // decode opening tag
    len += tag.len;
    /** start decode date */
    tag = decodeTagNumberAndValue(buffer, offset + len);
    len += tag.len;
    const date = bacappDecodeData(buffer, offset + len, apduLen + offset, tag.tagNumber, tag.value);
    len += date.len;
    /** start decode time */
    tag = decodeTagNumberAndValue(buffer, offset + len);
    len += tag.len;
    const time = bacappDecodeData(buffer, offset + len, apduLen + offset, tag.tagNumber, tag.value);
    len += time.len;
    /** closing tag 0, then opening tag 1 */
    if (!decodeIsClosingTagNumber(buffer, offset + len, 0) || !decodeIsOpeningTagNumber(buffer, offset + len + 1, 1)) return undefined;
    len += 2;
    tag = decodeTagNumberAndValue(buffer, offset + len);
    len += tag.len;
    /** context specific datatypehandling, handle, enum, uint, real */
    let value = { value: null };
    // real
    if (tag.tagNumber === 2 && tag.value === 4) value = bacappDecodeData(buffer, offset + len, apduLen + offset, baEnum.ApplicationTag.REAL, tag.value);
    // enumerated (uint)
    else if (tag.tagNumber === 4 && tag.value === 1) value = bacappDecodeData(buffer, offset + len, apduLen, baEnum.ApplicationTag.ENUMERATED, tag.value);
    //binary (is uint)
    else if (tag.tagNumber === 3 && tag.value === 1) value = bacappDecodeData(buffer, offset + len, apduLen, baEnum.ApplicationTag.ENUMERATED, tag.value);
    len += value.len;
    // Parse closing tag
    tag = decodeTagNumberAndValue(buffer, offset + len);
    len += tag.len;
    tag = decodeTagNumberAndValue(buffer, offset + len);
    len += tag.len;
    const status = bacappDecodeData(buffer, offset + len, apduLen, baEnum.ApplicationTag.BIT_STRING, tag.value);
    result.push({
      timestamp: new Date(date.value.getFullYear(), date.value.getMonth(), date.value.getDay(), time.value.getHours(), time.value.getMinutes(), time.value.getSeconds(), time.value.getMilliseconds()).getTime(),
      value: value.value,
      status: {
        out_of_service: (status.value.value[0] >> 0) % 2 !== 0,
        overridden: (status.value.value[0] >> 1) % 2 !== 0,
        fault: (status.value.value[0] >> 2) % 2 !== 0,
        in_alarm: (status.value.value[0] >> 3) % 2 !== 0,
      },
    });
    len += status.len;
  }
  return { len: len, values: result };
});
