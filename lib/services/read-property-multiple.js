'use strict';

const baAsn1 = require('../asn1');
const baEnum = require('../enum');

module.exports.encode = (buffer, properties) => {
  properties.forEach((value) => {
    baAsn1.encodeReadAccessSpecification(buffer, value);
  });
};

module.exports.decode = (buffer, offset, apduLen) => {
  let len = 0;
  const values = [];
  while (apduLen - len > 0) {
    const decodedValue = baAsn1.decodeReadAccessSpecification(buffer, offset + len, apduLen - len);
    if (!decodedValue) {
      return undefined;
    }
    len += decodedValue.len;
    values.push(decodedValue.value);
  }
  return {
    len,
    properties: values,
  };
};

module.exports.encodeAcknowledge = (buffer, values) => {
  values.forEach((value) => {
    baAsn1.encodeReadAccessResult(buffer, value);
  });
};

module.exports.decodeAcknowledge = (buffer, offset, apduLen) => {
  let len = 0;
  const values = [];
  while (apduLen - len > 0) {
    const result = baAsn1.decodeReadAccessResult(buffer, offset + len, apduLen - len);
    if (!result) {
      return undefined;
    }
    len += result.len;
    values.push(result.value);
  }
  return {
    len,
    values,
  };
};
