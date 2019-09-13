'use strict';


const ft_render_fabric = require('./build/ft_render');

let m = null;     // compiled module instance
let library = 0;  // pointer to library struct in webasm


// workaround because of bug in emscripten:
// https://github.com/emscripten-core/emscripten/issues/5820
const runtime_initialized = new Promise(resolve => {
  ft_render_fabric().then(module_instance => {
    m = module_instance;
    resolve();
  });
});

function from_26_6(fixed_point) {
  return fixed_point / 64;
}

let FT_New_Memory_Face,
    FT_Set_Char_Size,
    FT_Set_Pixel_Sizes,
    FT_Get_Char_Index,
    FT_Load_Glyph,
    FT_Done_Face;

module.exports.init = async function () {
  await runtime_initialized;
  m._init_constants();

  FT_New_Memory_Face = module.exports.FT_New_Memory_Face =
    m.cwrap('FT_New_Memory_Face', 'number', [ 'number', 'number', 'number', 'number', 'number' ]);

  FT_Set_Char_Size = module.exports.FT_Set_Char_Size =
    m.cwrap('FT_Set_Char_Size', 'number', [ 'number', 'number', 'number', 'number', 'number' ]);

  FT_Set_Pixel_Sizes = module.exports.FT_Set_Pixel_Sizes =
    m.cwrap('FT_Set_Pixel_Sizes', 'number', [ 'number', 'number', 'number' ]);

  FT_Get_Char_Index = module.exports.FT_Get_Char_Index =
    m.cwrap('FT_Get_Char_Index', 'number', [ 'number', 'number' ]);

  FT_Load_Glyph = module.exports.FT_Load_Glyph =
    m.cwrap('FT_Load_Glyph', 'number', [ 'number', 'number', 'number' ]);

  FT_Done_Face = module.exports.FT_Done_Face =
    m.cwrap('FT_Done_Face', 'number', [ 'number' ]);

  if (!library) {
    let ptr = m._malloc(4);
    let error = m.ccall('FT_Init_FreeType', 'number', [ 'number' ], [ ptr ]);

    if (error) throw new Error(`error in FT_Init_FreeType: ${error}`);

    library = m.getValue(ptr, 'i32');
    m._free(ptr);
  }
};


module.exports.fontface_create = function (source, size) {
  let ptr = m._malloc(4);
  let font_buf = m._malloc(source.length);
  let error;

  m.writeArrayToMemory(source, font_buf);

  error = FT_New_Memory_Face(library, font_buf, source.length, 0, ptr);

  if (error) throw new Error(`error in FT_New_Memory_Face: ${error}`);

  let face = m.getValue(ptr, 'i32');
  m._free(ptr);

  error = FT_Set_Char_Size(face, 0, size * 64, 300, 300);

  if (error) throw new Error(`error in FT_Set_Char_Size: ${error}`);

  error = FT_Set_Pixel_Sizes(face, 0, size);

  if (error) throw new Error(`error in FT_Set_Pixel_Sizes: ${error}`);

  return {
    ptr: face,
    font: font_buf
  };
};


module.exports.glyph_exists = function (face, code) {
  let glyph_index = FT_Get_Char_Index(face.ptr, code);

  return glyph_index !== 0;
};


module.exports.glyph_render = function (face, code) {
  let glyph_index = FT_Get_Char_Index(face.ptr, code);

  if (glyph_index === 0) throw new Error(`glyph does not exist for codepoint ${code}`);

  let load_flags = m.FT_LOAD_DEFAULT |
    m.FT_LOAD_RENDER |
    m.FT_LOAD_FORCE_AUTOHINT;
  // Add for monochrome output: m.FT_LOAD_TARGET_MONO

  let error = FT_Load_Glyph(face.ptr, glyph_index, load_flags);

  if (error) throw new Error(`error in FT_Load_Glyph: ${error}`);

  let glyph = m.getValue(face.ptr + m.OFFSET_FACE_GLYPH, 'i32');

  let g_w = m.getValue(glyph + m.OFFSET_GLYPH_BITMAP_WIDTH, 'i32');
  let g_h = m.getValue(glyph + m.OFFSET_GLYPH_BITMAP_ROWS, 'i32');
  let g_x = m.getValue(glyph + m.OFFSET_GLYPH_BITMAP_LEFT, 'i32');
  let g_y = m.getValue(glyph + m.OFFSET_GLYPH_BITMAP_TOP, 'i32');

  let buffer = m.getValue(glyph + m.OFFSET_GLYPH_BITMAP_BUFFER, 'i32');

  let advance_x = from_26_6(m.getValue(glyph + m.OFFSET_GLYPH_BITMAP_ADVANCE_X, 'i32'));
  let advance_y = from_26_6(m.getValue(glyph + m.OFFSET_GLYPH_BITMAP_ADVANCE_Y, 'i32'));

  let output = [];

  for (let y = 0; y < g_h; y++) {
    let line = [];
    for (let x = 0; x < g_w; x++) {
      let value = m.getValue(buffer + y * g_w + x, 'i8');
      line.push(value + (value < 0 ? 0x100 : 0));
    }
    output.push(line);
  }

  return {
    x: g_x,
    y: g_y,
    width: g_w,
    height: g_h,
    advance_x,
    advance_y,
    pixels: output
  };
};


module.exports.fontface_destroy = function (face) {
  let error = FT_Done_Face(face.ptr);

  if (error) throw new Error(`error in FT_Done_Face: ${error}`);

  m._free(face.font);
  face.ptr = 0;
  face.font = 0;
};


module.exports.destroy = function () {
  let error = m.ccall('FT_Done_FreeType', 'number', [ 'number' ], [ library ]);

  if (error) throw new Error(`error in FT_Done_FreeType: ${error}`);

  library = 0;

  // don't unload webasm - slows down tests too much
  //m = null;
};