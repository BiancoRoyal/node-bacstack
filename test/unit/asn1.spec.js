'use strict';

const expect = require('chai').expect;
const utils = require('./utils');
const baAsn1 = require('../../lib/asn1');

describe('bacnet - ASN1 layer', () => {
  describe('decodeUnsigned', () => {
    it('should successfully decode 8-bit unsigned integer', () => {
      const result = baAsn1.decodeUnsigned(Buffer.from([0x00, 0xff, 0xff, 0xff, 0xff]), 1, 1);
      expect(result).to.deep.equal({ len: 1, value: 255 });
    });

    it('should successfully decode 16-bit unsigned integer', () => {
      const result = baAsn1.decodeUnsigned(Buffer.from([0x00, 0xff, 0xff, 0xff, 0xff]), 1, 2);
      expect(result).to.deep.equal({ len: 2, value: 65535 });
    });

    it('should successfully decode length 0', () => {
      const result = baAsn1.decodeUnsigned(Buffer.from([]), 0, 0);
      expect(result).to.deep.equal({ len: 0, value: 0 });
    });

    it('should successfully decode 32-bit unsigned integer', () => {
      const result = baAsn1.decodeUnsigned(Buffer.from([0x00, 0xff, 0xff, 0xff, 0xff]), 1, 4);
      expect(result).to.deep.equal({ len: 4, value: 4294967295 });
    });
  });

  describe('encodeBacnetObjectId', () => {
    it('should successfully encode with object-type > 512', () => {
      const buffer = { buffer: Buffer.alloc(4), offset: 0 };
      baAsn1.encodeBacnetObjectId(buffer, 600, 600);
      expect(buffer).to.deep.equal({ buffer: Buffer.from([150, 0, 2, 88]), offset: 4 });
    });

    it('should successfully encode with opening-tag > 14 = 15', () => {
      const buffer = { buffer: Buffer.alloc(15, 10), offset: 0 };
      baAsn1.encodeOpeningTag(buffer, 15);
      expect(buffer).to.deep.equal({ buffer: Buffer.from([254, 15, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]), offset: 2 });
    });

    it('should successfully encode with opening-tag > 253 = 255', () => {
      const buffer = { buffer: Buffer.alloc(255, 12), offset: 0 };
      const testBuffer = Buffer.alloc(255, 12);
      const testBufferChange = Buffer.from([142, 12, 12, 12]);
      testBuffer.fill(testBufferChange, 0, 4);
      const bufferToCompare = { buffer: testBuffer, offset: 1 };
      baAsn1.encodeOpeningTag(buffer, 8);
      expect(buffer).to.deep.equal(bufferToCompare);
    });

    it('should successfully encode with closing-tag > 14 = 15', () => {
      const buffer = { buffer: Buffer.alloc(15, 10), offset: 0 };
      baAsn1.encodeClosingTag(buffer, 15);
      expect(buffer).to.deep.equal({ buffer: Buffer.from([255, 15, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]), offset: 2 });
    });

    it('should successfully encode with closing-tag > 253 = 255', () => {
      const buffer = { buffer: Buffer.alloc(255, 12), offset: 0 };
      const testBuffer = Buffer.alloc(255, 12);
      const testBufferChange = Buffer.from([143, 12, 12, 12]);
      testBuffer.fill(testBufferChange, 0, 4);
      const bufferToCompare = { buffer: testBuffer, offset: 1 };
      baAsn1.encodeClosingTag(buffer, 8);
      expect(buffer).to.deep.equal(bufferToCompare);
    });

    it('should successfully encode with Date 1-1-1', () => {
      const buffer = { buffer: Buffer.alloc(15, 10), offset: 0 };
      const testBuffer = Buffer.alloc(15, 10);
      const testBufferChange = Buffer.from([1, 2, 1, 5]);
      testBuffer.fill(testBufferChange, 0, 4);
      const bufferToCompare = { buffer: testBuffer, offset: 4 };
      baAsn1.encodeBacnetDate(buffer, new Date(1, 1, 1));
      expect(buffer).to.deep.equal(bufferToCompare);
    });

    it('should successfully encode with Date 257-1-1', () => {
      const buffer = { buffer: Buffer.alloc(15, 10), offset: 0 };
      const bufferToCompare = { buffer: Buffer.alloc(15, 10), offset: 0 };
      try {
        baAsn1.encodeBacnetDate(buffer, new Date(257, 1, 1));
      } catch (e) {
        expect(e.message).to.be.equal('invaide year: 257');
        expect(buffer).to.deep.equal(bufferToCompare);
      }
    });

    it('should successfully encode with Date 2020-6-1', () => {
      const buffer = { buffer: Buffer.alloc(15, 10), offset: 0 };
      const testBuffer = Buffer.alloc(15, 10);
      const testBufferChange = Buffer.from([120, 7, 1, 3]);
      testBuffer.fill(testBufferChange, 0, 4);
      const bufferToCompare = { buffer: testBuffer, offset: 4 };
      baAsn1.encodeBacnetDate(buffer, new Date(2020, 6, 1));
      expect(buffer).to.deep.equal(bufferToCompare);
    });
  });
});
