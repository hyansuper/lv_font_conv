'use strict';


const assert = require('assert');
const Font   = require('../../lib/font/font');

/*eslint-disable max-len*/

// Regenerate:
// ./lv_font_conv.js --font ./node_modules/roboto-fontface/fonts/roboto/Roboto-Regular.woff -r 65-65 -r 86-86 --bpp 1 --size 10 --format dump -o 1111 --full-info
const font_data_AV = require('./fixtures/font_info_AV.json');
const font_options = { bpp: 2 };

/*eslint-enable max-len*/


describe('Font', function () {

  it('head table', function () {
    let font = new Font(font_data_AV, font_options);
    let bin = font.head.toBin();

    assert.equal(bin.readUInt32LE(0), bin.length);
    assert.equal(bin.length % 4, 0);

    // Make sure name chars order is proper
    assert.equal(bin.readUInt8(4), 'h'.charCodeAt(0));
    assert.equal(bin.readUInt8(5), 'e'.charCodeAt(0));
    assert.equal(bin.readUInt8(6), 'a'.charCodeAt(0));
    assert.equal(bin.readUInt8(7), 'd'.charCodeAt(0));

    assert.equal(bin.readUInt32LE(8), 1); // version
    assert.equal(bin.readUInt16LE(12), 4); // amount of next tables
    assert.equal(bin.readUInt16LE(14), font_data_AV.size);
    assert.equal(bin.readUInt16LE(16), font_data_AV.ascent);
    assert.equal(bin.readInt16LE(18), font_data_AV.descent);
    assert.equal(bin.readUInt16LE(20), font_data_AV.typoAscent);
    assert.equal(bin.readInt16LE(22), font_data_AV.typoDescent);
    assert.equal(bin.readUInt16LE(24), font_data_AV.typoLineGap);

    assert.equal(bin.readInt16LE(26), 0); // minY
    assert.equal(bin.readInt16LE(28), 8); // maxY

    // Default advanceWidth 0 for proportional fonts
    assert.equal(bin.readUInt16LE(30), 0);

    assert.equal(bin.readUInt8(32), 0); // indexToLocFormat
    assert.equal(bin.readUInt8(33), 0); // glyphIdFofmat
    assert.equal(bin.readUInt8(34), 0); // kerningFormat
    assert.equal(bin.readUInt8(35), 1); // advanceWidthFormat (with fractional)

    assert.equal(bin.readUInt8(36), font_options.bpp);

    assert.equal(bin.readUInt8(37), 1); // xy_bits
    assert.equal(bin.readUInt8(38), 4); // wh_bits
    assert.equal(bin.readUInt8(39), 8); // advanceWidth bits (FP4.4)

    assert.equal(bin.readUInt8(40), 1); // compression id
  });


  it('loca table', function () {
    let font = new Font(font_data_AV, font_options);
    let bin = font.loca.toBin();

    assert.equal(bin.readUInt16LE(0), bin.length);
    assert.equal(bin.length % 4, 0);
    assert.equal(bin.readUInt32LE(4), Buffer.from('loca').readUInt32LE(0));

    // Entries (2 chars + reserved 'zero')
    assert.equal(bin.readUInt32LE(8), 3);

    // Check glyph data offsets
    // Offset = 12 is for `zero`, start check from 14
    assert.equal(bin.readUInt16LE(14), font.glyf.getOffset(1)); // for "A"
    assert.equal(bin.readUInt16LE(14), 8);
    assert.equal(bin.readUInt16LE(16), font.glyf.getOffset(2)); // for "W"
    assert.equal(bin.readUInt16LE(16), 25);
  });


  it('glyf table', function () {
    let font = new Font(font_data_AV, font_options);
    let bin = font.glyf.toBin();

    assert.equal(bin.readUInt16LE(0), bin.length);
    assert.equal(bin.length % 4, 0);
    assert.equal(bin.readUInt32LE(4), Buffer.from('glyf').readUInt32LE(0));
  });


  it('cmap table', function () {
    let font = new Font(font_data_AV, font_options);
    let bin = font.cmap.toBin();

    assert.equal(bin.readUInt16LE(0), bin.length);
    assert.equal(bin.length % 4, 0);
    assert.equal(bin.readUInt32LE(4), Buffer.from('cmap').readUInt32LE(0));

    assert.equal(bin.readUInt32LE(8), 1); // subtables count

    const SUB1_HEAD_OFFSET = 12;
    const SUB1_DATA_OFFSET = 12 + 16;

    // Check subtable header
    assert.equal(bin.readUInt32LE(SUB1_HEAD_OFFSET + 0), SUB1_DATA_OFFSET);
    assert.equal(bin.readUInt32LE(SUB1_HEAD_OFFSET + 4), 65); // "A"
    assert.equal(bin.readUInt16LE(SUB1_HEAD_OFFSET + 8), 22);  // Range length, 86-65+1
    assert.equal(bin.readUInt16LE(SUB1_HEAD_OFFSET + 10), 1); // Glyph ID offset
    assert.equal(bin.readUInt16LE(SUB1_HEAD_OFFSET + 12), 2); // Entries count
    assert.equal(bin.readUInt8(SUB1_HEAD_OFFSET + 14), 2); // Subtable type

    // Check IDs (sparsed subtable)
    assert.equal(bin.readUInt16LE(SUB1_DATA_OFFSET + 0), 0); // 'A' => 65+0 => 65
    assert.equal(bin.readUInt16LE(SUB1_DATA_OFFSET + 2), 0); // 'A' ID => 1+0 => 1
    assert.equal(bin.readUInt16LE(SUB1_DATA_OFFSET + 4), 21); // 'W' => 65+21 => 86
    assert.equal(bin.readUInt16LE(SUB1_DATA_OFFSET + 6), 1); // 'W' ID => 1+1 => 2
  });


  it('kern table', function () {
    let font = new Font(font_data_AV, font_options);
    let bin = font.kern.toBin();

    assert.equal(bin.readUInt16LE(0), bin.length);
    assert.equal(bin.length % 4, 0);
    assert.equal(bin.readUInt32LE(4), Buffer.from('kern').readUInt32LE(0));

    // Entries
    assert.equal(bin.readUInt32LE(8), 2);

    const PAIRS_OFFSET = 12;
    const VAL_OFFSET = PAIRS_OFFSET + bin.readUInt32LE(8) * 2;

    // Pairs of IDs

    // [ AV ] => [ 1, 2 ]
    assert.equal(bin.readUInt8(PAIRS_OFFSET + 0), 1);
    assert.equal(bin.readUInt8(PAIRS_OFFSET + 1), 2);
    // [ VA ] => [ 2, 1 ]
    assert.equal(bin.readUInt8(PAIRS_OFFSET + 2), 2);
    assert.equal(bin.readUInt8(PAIRS_OFFSET + 3), 1);

    // Values
    const AV_KERN_FP4 = Math.round(font_data_AV.glyphs[0].kerning['V'.charCodeAt(0)] * 16);
    assert.equal(bin.readInt8(VAL_OFFSET + 0), AV_KERN_FP4);
    const VA_KERN_FP4 = Math.round(font_data_AV.glyphs[1].kerning['A'.charCodeAt(0)] * 16);
    assert.equal(bin.readInt8(VAL_OFFSET + 1), VA_KERN_FP4);
  });
});
