'use strict';

const baAsn1 = require('../asn1');
const baEnum = require('../enum');

module.exports.encodeResponse = (buffer, payload, deviceAddressBinding, options) => {
  const property = baEnum.PropertyIdentifierName[payload.property.id];
  baAsn1.encodeContextObjectId(buffer, 0, payload.objectId.type, payload.objectId.instance);
  baAsn1.encodeContextEnumerated(buffer, 1, payload.property.id);
  if (property === 'OBJECT_LIST') encodeDeviceObjectList(buffer, payload.objectId.instance, payload.property.index);
  else if (property === 'OBJECT_IDENTIFIER') encodeObjectIdentifier(buffer, payload.objectId.instance);
  else if (property === 'STRUCTURED_OBJECT_LIST') encodeEmptyList(buffer);
  else if (property === 'PROPERTY_LIST') encodeDevicePropertyList(buffer, options, payload.property.index);
  else if (property === 'DEVICE_ADDRESS_BINDING') encodeDeviceAddressBinding(buffer, deviceAddressBinding, payload.property.index);
  else {
    const prop = getDeviceProperties(options)[property];
    if (!prop) throw 'UNKNOWN_PROPERTY';
    baAsn1.encodeOpeningTag(buffer, 3);
    baAsn1.bacappEncodeApplicationData(buffer, { type: prop.datatype, value: prop.value });
    baAsn1.encodeClosingTag(buffer, 3);
  }
};

module.exports.encodeMultipleResponse = (buffer, payload, options, deviceAddressBinding) => {
  if (!options.bacnetDeviceOptions.deviceInstance) options.bacnetDeviceOptions.deviceInstance = 10000;
  const objectMap = new Map();
  payload.properties.forEach((row) => {
    if (!objectMap.has(row.objectId)) objectMap.set(row.objectId, []);
    objectMap.get(row.objectId).push(...row.properties);
  });
  // Start encode
  objectMap.forEach((data, obj) => {
    baAsn1.encodeContextObjectId(buffer, 0, obj.type, obj.instance);
    baAsn1.encodeOpeningTag(buffer, 1);
    if (obj.type !== 8) {
      data.forEach((row) => {
        baAsn1.encodeContextEnumerated(buffer, 2, row.id);
        baAsn1.encodeOpeningTag(buffer, 5);
        baAsn1.encodeApplicationEnumerated(buffer, 2);
        baAsn1.encodeApplicationEnumerated(buffer, 32);
        baAsn1.encodeClosingTag(buffer, 5);
      });
    } else {
      const availableData = Object.values(getDeviceProperties(options));
      var points;
      if (data.length === 1 && data[0].id === baEnum.ObjectType.DEVICE) points = availableData;
      else {
        points = [];
        data.forEach((row) => {
          const existingData = availableData.find((a) => row.id === a.id);
          if (existingData) points.push(existingData);
          else
            points.push({
              id: 255,
              req_id: row.id,
            });
        });
      }
      points.forEach((point) => {
        baAsn1.encodeContextEnumerated(buffer, 2, point.req_id || point.id);
        if (obj.instance !== options.bacnetDeviceOptions.deviceInstance || obj.type !== baEnum.ObjectType.DEVICE) {
        } else
          switch (point.id) {
            case 75: //object identifier
              encodeObjectIdentifier(buffer, options.bacnetDeviceOptions.deviceInstance, 4);
              break;
            case 76: //object list
              encodeDeviceObjectList(buffer, options.bacnetDeviceOptions.deviceInstance, 4294967295, 4);
              break;
            case 371:
              encodeDevicePropertyList(buffer, options, 4294967295, 4);
              break;
            case 30: // Device address binding
              //encodeEmptyList(buffer, 4);
              encodeDeviceAddressBinding(buffer, deviceAddressBinding, 4294967295, 4);
              break;
            case 255:
              //encode error
              baAsn1.encodeOpeningTag(buffer, 5);
              baAsn1.encodeApplicationEnumerated(buffer, 2);
              baAsn1.encodeApplicationEnumerated(buffer, 32);
              baAsn1.encodeClosingTag(buffer, 5);
              break;
            default:
              baAsn1.encodeOpeningTag(buffer, 4);
              baAsn1.bacappEncodeApplicationData(buffer, { type: point.datatype, value: point.value });
              baAsn1.encodeClosingTag(buffer, 4);
          }
      });
    }
    baAsn1.encodeClosingTag(buffer, 1);
  });
};

const encodeEmptyList = (buffer, tagNumber = 3) => {
  baAsn1.encodeOpeningTag(buffer, tagNumber);
  baAsn1.encodeClosingTag(buffer, tagNumber);
};

const encodeDeviceAddressBinding = (buffer, devices, arrayIndex, tagNumber = 3) => {
  if (arrayIndex !== 4294967295) throw 'PROPERTY_IS_NOT_AN_ARRAY';
  baAsn1.encodeOpeningTag(buffer, tagNumber);
  for (const [deviceInstance, address] of devices) {
    baAsn1.encodeApplicationObjectId(buffer, baEnum.ObjectType.DEVICE, deviceInstance);
    if (address.adr == null) {
      baAsn1.bacappEncodeApplicationData(buffer, { type: baEnum.ApplicationTag.UNSIGNED_INTEGER, value: 0 }); // net = 0
      const octets = address.address.split('.');
      const port = parseInt(octets[3].split(':')[1] || 47808);
      const byteArray = octets.map((octet) => parseInt(octet, 10));
      byteArray.push(...convertNumberToByteArray(port));
      baAsn1.bacappEncodeApplicationData(buffer, { type: baEnum.ApplicationTag.OCTET_STRING, value: byteArray });
    } else {
      baAsn1.bacappEncodeApplicationData(buffer, { type: baEnum.ApplicationTag.UNSIGNED_INTEGER, value: address.net });
      baAsn1.bacappEncodeApplicationData(buffer, { type: baEnum.ApplicationTag.OCTET_STRING, value: address.adr });
    }
  }
  baAsn1.encodeClosingTag(buffer, tagNumber);
};

const encodeDeviceObjectList = (buffer, objectInstance, arrayIndex, tagNumber = 3) => {
  if (arrayIndex !== 4294967295 && arrayIndex !== 0) {
    throw 'INVALID_ARRAY_INDEX';
  } else {
    if (arrayIndex === 0) baAsn1.encodeContextEnumerated(buffer, 2, 0);
  }
  baAsn1.encodeOpeningTag(buffer, tagNumber);
  baAsn1.encodeApplicationObjectId(buffer, baEnum.ObjectType.DEVICE, objectInstance);
  baAsn1.encodeClosingTag(buffer, tagNumber);
};

const encodeDevicePropertyList = (buffer, options, arrayIndex, tagNumber = 3) => {
  const properties = Object.values(getDeviceProperties(options)).filter((value, index) => index === arrayIndex || arrayIndex === 4294967295);
  if (arrayIndex !== 4294967295) baAsn1.encodeContextEnumerated(buffer, 2, arrayIndex);
  if (properties.length < 1) throw 'INVALID_ARRAY_INDEX';
  baAsn1.encodeOpeningTag(buffer, tagNumber);
  for (const prop of properties) {
    baAsn1.bacappEncodeApplicationData(buffer, { type: baEnum.ApplicationTag.ENUMERATED, value: prop.id });
  }
  baAsn1.encodeClosingTag(buffer, tagNumber);
};
const encodeObjectIdentifier = (buffer, instance, tagNumber = 3) => {
  baAsn1.encodeOpeningTag(buffer, tagNumber);
  baAsn1.encodeApplicationObjectId(buffer, baEnum.ObjectType.DEVICE, instance);
  baAsn1.encodeClosingTag(buffer, tagNumber);
};

const convertNumberToByteArray = (number) => {
  const byteArray = [];

  for (let i = 0; i < 2; i++) {
    const byte = number & 0xff;
    byteArray.push(byte);
    number >>= 8;
  }
  [byteArray[0], byteArray[1]] = [byteArray[1], byteArray[0]];
  return byteArray;
};

const convertByteArrayToNumber = (byteArray) => {
  let number = 0;

  for (let i = byteArray.length - 1; i >= 0; i--) {
    number <<= 8;
    number |= byteArray[i] & 0xff;
  }

  return number;
};

const getDeviceProperties = (options = {}) => {
  return {
    OBJECT_NAME: {
      id: 77,
      datatype: 7, //Character String
      value: options.bacnetDeviceOptions.deviceName,
    },
    OBJECT_TYPE: {
      id: 79,
      datatype: 9, //Enumerated
      value: 8,
    },
    OBJECT_IDENTIFIER: {
      id: 75,
      datatype: 12, //Objectidentifier
      value: options.bacnetDeviceOptions.deviceInstance,
    },
    SYSTEM_STATUS: {
      id: 112,
      datatype: 9, //Enumerated
      value: 0,
    },
    VENDOR_NAME: {
      id: 121,
      datatype: 7, //String Character Set
      value: options.bacnetDeviceOptions.vendorName,
    },
    VENDOR_IDENTIFIER: {
      id: 120,
      datatype: 2, //Unsigned integer
      value: options.bacnetDeviceOptions.vendorIdentifier, //
    },
    MODEL_NAME: {
      id: 70,
      datatype: 7, //Character String
      value: options.bacnetDeviceOptions.modelName, //
    },
    FIRMWARE_REVISION: {
      id: 44,
      datatype: 7, //Character String
      value: options.bacnetDeviceOptions.firmwareRevision,
    },
    APPLICATION_SOFTWARE_VERSION: {
      id: 12,
      datatype: 7, //Character string
      value: options.bacnetDeviceOptions.applicationSoftwareVersion,
    },
    PROTOCOL_VERSION: {
      id: 98,
      datatype: 2, //Unsigned
      value: 1,
    },
    PROTOCOL_SERVICES_SUPPORTED: {
      id: 97,
      datatype: 8, //Bitstring
      value: { bitsUsed: 49, value: [0, 16, 0, 0, 0, 0, 0, 0] }, //
    },
    PROTOCOL_OBJECT_TYPES_SUPPORTED: {
      id: 96,
      datatype: 8, //Bitstring
      value: { bitsUsed: 63, value: [0, 1, 0, 0, 0, 0, 0, 0] }, //
    },
    OBJECT_LIST: {
      id: 76,
      datatype: 255, //Array of objects
      values: [{ type: 8, instance: null }], // Only device object
    },
    PROPERTY_LIST: {
      id: 371,
      datatype: 255, //Array of objects
      values: null, //
    },
    MAX_APDU_LENGTH_ACCEPTED: {
      id: 62,
      datatype: 2, //Unsigned integer
      value: 1476, // Max UDP payload
    },
    SEGMENTATION_SUPPORTED: {
      id: 107,
      datatype: 9, //Unsigned integer
      value: baEnum.Segmentation.SEGMENTED_RECEIVE, // Segmented receive
    },
    APDU_TIMEOUT: {
      id: 11,
      datatype: 2, //Unsigned integer
      value: options.apduTimeout, //
    },
    NUMBER_OF_APDU_RETRIES: {
      id: 73,
      datatype: 2, //Unsigned integer
      value: 0, // No retries
    },
    DEVICE_ADDRESS_BINDING: {
      id: 30,
      datatype: null, //Device address binding
      values: [],
    },
    LOCATION: {
      id: 58,
      datatype: 7, //String
      value: options.bacnetDeviceOptions.location,
    },
    DESCRIPTION: {
      id: 28,
      datatype: 7, //String
      value: options.bacnetDeviceOptions.description,
    },
    PROTOCOL_REVISION: {
      id: 139,
      datatype: 2, //Unsigned integer
      value: 23,
    },
    /*PROTOCOL_CONFORMANCE_CLASS: {
      id: 95,
      datatype: 2, //Unsigned integer
      value: 1,
    },*/
    DATABASE_REVISION: {
      id: 155,
      datatype: 2, //Unsigned integer
      value: 0,
    },
  };
};
