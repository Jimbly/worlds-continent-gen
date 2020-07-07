// Portions Copyright 2019 Jimb Esser (https://github.com/Jimbly/)
// Released under MIT License: https://opensource.org/licenses/MIT
/* eslint-env browser */

const assert = require('assert');
const engine = require('./engine.js');
const { filewatchOn } = require('./filewatch.js');
const local_storage = require('./local_storage.js');
const urlhash = require('./urlhash.js');
const { callEach, isPowerOfTwo, nextHighestPowerOfTwo, ridx } = require('../../common/util.js');

const TEX_UNLOAD_TIME = 5 * 60 * 1000; // for textures loaded (each frame) with auto_unload: true

export let textures = {};
export let load_count = 0;
let aniso = 4;
let max_aniso = 0;
let aniso_enum;

let default_filter_min;
let default_filter_mag;

const cube_faces = [
  { target: 'TEXTURE_CUBE_MAP_NEGATIVE_X', pos: [0,1] },
  { target: 'TEXTURE_CUBE_MAP_POSITIVE_X', pos: [0,0] },
  { target: 'TEXTURE_CUBE_MAP_NEGATIVE_Y', pos: [1,0] },
  { target: 'TEXTURE_CUBE_MAP_POSITIVE_Y', pos: [1,1] },
  { target: 'TEXTURE_CUBE_MAP_NEGATIVE_Z', pos: [2,0] },
  { target: 'TEXTURE_CUBE_MAP_POSITIVE_Z', pos: [2,1] },
];

export const format = {
  R8: { count: 1 },
  RGB8: { count: 3 },
  RGBA8: { count: 4 },
};

export function defaultFilters(min, mag) {
  default_filter_min = min;
  default_filter_mag = mag;
}

let bound_unit = null;
let bound_tex = [];

let handle_loading;
let handle_error;

let global_timer;

function setUnit(unit) {
  if (unit !== bound_unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    bound_unit = unit;
  }
}

function bindHandle(unit, target, handle) {
  if (bound_tex[unit] !== handle) {
    setUnit(unit);
    gl.bindTexture(target, handle);
    bound_tex[unit] = handle;
  }
}

function unbindAll(target) {
  for (let unit = 0; unit < bound_tex.length; ++unit) {
    setUnit(unit);
    gl.bindTexture(target, target === gl.TEXTURE_2D ? handle_loading : null);
    bound_tex[unit] = null;
  }
}

export function bind(unit, tex) {
  tex.last_use = global_timer;
  // May or may not change the unit
  bindHandle(unit, tex.target, tex.eff_handle);
}

// hot path inlined for perf
export function bindArray(texs) {
  for (let ii = 0; ii < texs.length; ++ii) {
    let tex = texs[ii];
    tex.last_use = global_timer;
    let handle = tex.eff_handle;
    if (bound_tex[ii] !== handle) {
      if (ii !== bound_unit) {
        gl.activeTexture(gl.TEXTURE0 + ii);
        bound_unit = ii;
      }
      gl.bindTexture(tex.target, handle);
      bound_tex[ii] = handle;
    }
  }
}

export function isArrayBound(texs) {
  for (let ii = 0; ii < texs.length; ++ii) {
    let tex = texs[ii];
    let handle = tex.eff_handle;
    if (bound_tex[ii] !== handle) {
      return false;
    }
  }
  return true;
}

let auto_unload_textures = [];

function Texture(params) {
  this.name = params.name;
  this.loaded = false;
  this.load_fail = false;
  this.target = params.target || gl.TEXTURE_2D;
  this.is_array = this.target === gl.TEXTURE_2D_ARRAY;
  this.is_cube = this.target === gl.TEXTURE_CUBE_MAP;
  this.handle = gl.createTexture();
  this.eff_handle = handle_loading;
  this.setSamplerState(params);
  this.src_width = this.src_height = 1;
  this.width = this.height = 1;
  this.nozoom = params.nozoom || false;
  this.on_load = [];
  this.gpu_mem = 0;
  this.soft_error = params.soft_error || false;
  this.last_use = global_timer;
  this.auto_unload = params.auto_unload || false;
  if (this.auto_unload) {
    auto_unload_textures.push(this);
  }

  this.format = params.format || format.RGBA8;

  if (params.data) {
    let err = this.updateData(params.width, params.height, params.data);
    assert(!err, err);
  } else {
    // texture is not valid, do not leave bound
    unbindAll(this.target);
    if (params.url) {
      this.url = params.url;
      this.loadURL(params.url);
    }
  }
}

Texture.prototype.updateGPUMem = function () {
  let new_size = this.width * this.height * this.format.count;
  if (this.mipmaps) {
    new_size *= 1.5;
  }
  let diff = new_size - this.gpu_mem;
  engine.perf_state.gpu_mem.tex += diff;
  this.gpu_mem = diff;
};

Texture.prototype.setSamplerState = function (params) {
  let target = this.target;
  setUnit(0);
  bound_tex[0] = null; // Force a re-bind, no matter what
  bindHandle(0, target, this.handle);

  this.filter_min = params.filter_min || default_filter_min;
  this.filter_mag = params.filter_mag || default_filter_mag;
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, this.filter_min);
  gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, this.filter_mag);
  this.wrap_s = params.wrap_s || gl.REPEAT;
  this.wrap_t = params.wrap_t || gl.REPEAT;
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, this.wrap_s);
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, this.wrap_t);

  this.mipmaps = this.filter_min >= 0x2700 && this.filter_min <= 0x2703; // Probably gl.LINEAR_MIPMAP_LINEAR

  if (max_aniso) {
    if (this.mipmaps && params.filter_mag !== gl.NEAREST) {
      gl.texParameterf(gl.TEXTURE_2D, aniso_enum, aniso);
    } else {
      gl.texParameterf(gl.TEXTURE_2D, aniso_enum, 1);
    }
  }
};

Texture.prototype.updateData = function updateData(w, h, data) {
  assert(!this.destroyed);
  setUnit(0);
  bound_tex[0] = null; // Force a re-bind, no matter what
  bindHandle(0, this.target, this.handle);
  this.last_use = global_timer;
  this.src_width = w;
  this.src_height = h;
  this.width = w;
  this.height = h;
  gl.getError(); // clear the error flag if there is one
  // Resize NP2 if this is not being used for a texture array, and it is not explicitly allowed (non-mipmapped, wrapped)
  let np2 = (!isPowerOfTwo(w) || !isPowerOfTwo(h)) && !this.is_array && !this.is_cube &&
    !(!this.mipmaps && this.wrap_s === gl.CLAMP_TO_EDGE && this.wrap_t === gl.CLAMP_TO_EDGE);
  if (np2) {
    this.width = nextHighestPowerOfTwo(w);
    this.height = nextHighestPowerOfTwo(h);
    gl.texImage2D(this.target, 0, this.format.internal_type, this.width, this.height, 0,
      this.format.internal_type, this.format.gl_type, null);
  }
  if (data instanceof Uint8Array) {
    assert(data.length >= w * h * this.format.count);
    assert(!this.is_cube);
    if (this.is_array) {
      let num_images = h / w; // assume square
      gl.texImage3D(this.target, 0, this.format.internal_type, w, w,
        num_images, 0, this.format.internal_type, this.format.gl_type, data);
    } else if (np2) {
      // Could do multiple upload thing like below, but smarter, but we really shouldn't be doing this for
      // in-process generated images!
      gl.texSubImage2D(this.target, 0, 0, 0, w, h, this.format.internal_type, this.format.gl_type, data);
    } else {
      gl.texImage2D(this.target, 0, this.format.internal_type, w, h, 0,
        this.format.internal_type, this.format.gl_type, data);
    }
  } else {
    assert(data.width); // instanceof Image fails with ublock AdBlocker; also, this is either an Image or Canvas
    if (this.is_cube) {
      assert.equal(w * 2, h * 3);
      let tex_size = h / 2;
      let canvas = document.createElement('canvas');
      canvas.width = tex_size;
      canvas.height = tex_size;
      let ctx = canvas.getContext('2d');
      for (let ii = 0; ii < cube_faces.length; ++ii) {
        let face = cube_faces[ii];
        ctx.drawImage(data, face.pos[0] * tex_size, face.pos[1] * tex_size, tex_size, tex_size,
          0, 0, tex_size, tex_size);
        gl.texImage2D(gl[face.target], 0, this.format.internal_type, this.format.internal_type, this.format.gl_type,
          canvas);
      }
    } else if (this.is_array) {
      let num_images = h / w;
      gl.texImage3D(this.target, 0, this.format.internal_type, w, w,
        num_images, 0, this.format.internal_type, this.format.gl_type, data);

      if (gl.getError()) {
        // Fix for Samsung devices (Chris's and Galaxy S8 on CrossBrowserTesting)
        // Also fixes locally on Chrome when using a 8K source texture (was 896x57344),
        //  perhaps some auto-scaling is going on in the gl.texImage3D call if required?
        // Try drawing to canvas first
        let canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        let ctx = canvas.getContext('2d');
        ctx.drawImage(data, 0, 0);
        gl.texImage3D(this.target, 0, this.format.internal_type, w, w,
          num_images, 0, this.format.internal_type, this.format.gl_type, canvas);
      }

    } else if (np2) {
      // Pad up to power of two
      // Duplicate right and bottom pixel row by sending image 3 times
      if (w !== this.width) {
        gl.texSubImage2D(this.target, 0, 1, 0, this.format.internal_type, this.format.gl_type, data);
      }
      if (h !== this.height) {
        gl.texSubImage2D(this.target, 0, 0, 1, this.format.internal_type, this.format.gl_type, data);
      }
      gl.texSubImage2D(this.target, 0, 0, 0, this.format.internal_type, this.format.gl_type, data);
    } else {
      gl.texImage2D(this.target, 0, this.format.internal_type, this.format.internal_type, this.format.gl_type, data);
    }
  }
  let gl_err = gl.getError();
  if (gl_err) {
    return gl_err;
  }
  if (this.mipmaps) {
    gl.generateMipmap(this.target);
    assert(!gl.getError());
  }
  this.updateGPUMem();
  this.eff_handle = this.handle;
  this.loaded = true;

  callEach(this.on_load, this.on_load = null, this);

  return 0;
};

Texture.prototype.onLoad = function (cb) {
  if (this.loaded) {
    cb(this); // eslint-disable-line callback-return
  } else {
    this.on_load.push(cb);
  }
};

let texture_base_url = '';
export function getExternalTextureURL(url) {
  if (!url.match(/^.{2,7}:/)) {
    url = `${texture_base_url||urlhash.getURLBase()}${url}`;
  }
  return url;
}
export function setExternalTextureBaseURL(base_url) {
  texture_base_url = base_url;
}

const TEX_RETRY_COUNT = 4;
Texture.prototype.loadURL = function loadURL(url, filter) {
  let tex = this;
  assert(!tex.destroyed);

  // When our browser's location has been changed from 'site.com/foo/' to
  //  'site.com/foo/bar/7' our relative image URLs are still relative to the
  //  base.  Maybe should set some meta tag to do this instead?
  if (!url.match(/^.{2,7}:/)) {
    url = `${urlhash.getURLBase()}${url}`;
  }

  let load_gen = tex.load_gen = (tex.load_gen || 0) + 1;
  function tryLoad(next) {
    let did_next = false;
    function done(img) {
      if (!did_next) {
        did_next = true;
        return void next(img);
      }
    }

    let img = new Image();
    img.onload = function () {
      done(img);
    };
    function fail() {
      done(null);
    }
    img.onerror = fail;
    img.crossOrigin = 'anonymous';
    img.src = url;
  }

  ++load_count;
  let retries = 0;
  function handleLoad(img) {
    if (tex.load_gen !== load_gen || tex.destroyed) {
      // someone else requested this texture to be loaded!  Or, it was already unloaded
      --load_count;
      return;
    }
    let err_details = '';
    if (img) {
      tex.format = format.RGBA8;
      if (filter) {
        img = filter(tex, img);
      }
      let err = tex.updateData(img.width, img.height, img);
      if (err) {
        err_details = `: GLError(${err})`;
        // Samsung TV gets 1282 on texture arrays
        // Samsung Galaxy S6 gets 1281 on texture arrays
        // Note: Any failed image load (partial read of a bad png, etc) also results in 1281!
        if (tex.is_array && (String(err) === '1282' || String(err) === '1281') && engine.webgl2 && !engine.DEBUG) {
          local_storage.setJSON('webgl2_disable', {
            ua: navigator.userAgent,
            ts: Date.now(),
          });
          console.error(`Error loading array texture "${url}"${err_details}, reloading without WebGL2..`);
          engine.reloadSafe();
          return;
        }
        if (!tex.for_reload) {
          retries = TEX_RETRY_COUNT; // do not retry this
        }
      } else {
        --load_count;
        return;
      }
    }
    let err = `Error loading texture "${url}"${err_details}`;
    retries++;
    if (retries > TEX_RETRY_COUNT) {
      --load_count;
      tex.eff_handle = handle_error;
      tex.load_fail = true;
      console.error(`${err}${err_details ? '' : ', retries failed'}`);
      if (tex.soft_error) {
        tex.err = 'Load failed';
      } else {
        assert(false, err);
      }
      return;
    }
    console.error(`${err}, retrying... `);
    setTimeout(tryLoad.bind(null, handleLoad), 100 * retries * retries);
  }
  tryLoad(handleLoad);
};

Texture.prototype.copyTexImage = function (x, y, w, h) {
  assert(!this.destroyed);
  assert(w && h);
  bindHandle(0, this.target, this.handle);
  gl.copyTexImage2D(this.target, 0, gl.RGB, x, y, w, h, 0);
  this.last_use = global_timer;
  this.src_width = this.width = w;
  this.src_height = this.height = h;
  this.updateGPUMem();
};

Texture.prototype.destroy = function () {
  if (this.destroyed) {
    return;
  }
  assert(this.name);
  let auto_unload = this.auto_unload;
  if (auto_unload) {
    this.auto_unload = null;
    let idx = auto_unload_textures.indexOf(this);
    assert(idx !== -1);
    ridx(auto_unload_textures, idx);
  }
  delete textures[this.name];
  unbindAll(this.target);
  gl.deleteTexture(this.handle);
  this.width = this.height = 0;
  this.updateGPUMem();
  this.destroyed = true;
  if (typeof auto_unload === 'function') {
    auto_unload();
  }
};

function create(params) {
  assert(params.name);
  let texture = new Texture(params);
  textures[params.name] = texture;
  return texture;
}

let last_temporary_id = 0;
export function createForCapture(unique_name, auto_unload) {
  let name = unique_name || `screen_temporary_tex_${++last_temporary_id}`;
  assert(!textures[name]);
  let texture = create({
    filter_min: gl.NEAREST,
    filter_mag: gl.NEAREST,
    wrap_s: gl.CLAMP_TO_EDGE,
    wrap_t: gl.CLAMP_TO_EDGE,
    format: format.RGB8,
    name,
    auto_unload,
  });
  texture.loaded = true;
  texture.eff_handle = texture.handle;
  return texture;
}

export function load(params) {
  let key = params.name = params.name || params.url;
  assert(key);
  let tex = textures[key];
  if (!tex) {
    tex = create(params);
  }
  tex.last_use = global_timer;
  return tex;
}

export function cname(key) {
  let idx = key.lastIndexOf('/');
  if (idx !== -1) {
    key = key.slice(idx+1);
  }
  idx = key.indexOf('.');
  if (idx !== -1) {
    key = key.slice(0, idx);
  }
  return key.toLowerCase();
}
export function findTexForReplacement(search_key) {
  search_key = cname(search_key);
  for (let key in textures) {
    let compare_key = cname(key);
    if (compare_key === search_key) {
      return textures[key];
    }
  }
  return null;
}

let tick_next_tex = 0;
export function texturesTick() {
  global_timer = engine.global_timer;
  let len = auto_unload_textures.length;
  if (!len) {
    return;
  }
  if (tick_next_tex >= len) {
    tick_next_tex = 0;
  }
  let tex = auto_unload_textures[tick_next_tex];
  if (tex.last_use < global_timer - TEX_UNLOAD_TIME) {
    console.log(`Unloading texture ${tex.name}`);
    tex.destroy();
  } else {
    ++tick_next_tex;
  }
}

export function texturesUnloadDynamic() {
  while (auto_unload_textures.length) {
    auto_unload_textures[0].destroy();
  }
}

function textureReload(filename) {
  let tex = textures[filename];
  if (tex && tex.url) {
    tex.for_reload = true;
    tex.loadURL(`${tex.url}?rl=${Date.now()}`);
    return true;
  }
  return false;
}

export function startup() {

  default_filter_min = gl.LINEAR_MIPMAP_LINEAR;
  default_filter_mag = gl.LINEAR;

  format.R8.internal_type = gl.LUMINANCE;
  format.R8.gl_type = gl.UNSIGNED_BYTE;
  format.RGB8.internal_type = gl.RGB;
  format.RGB8.gl_type = gl.UNSIGNED_BYTE;
  format.RGBA8.internal_type = gl.RGBA;
  format.RGBA8.gl_type = gl.UNSIGNED_BYTE;

  let ext_anisotropic = (
    gl.getExtension('EXT_texture_filter_anisotropic') ||
    gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
    gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
  );
  if (ext_anisotropic) {
    aniso_enum = ext_anisotropic.TEXTURE_MAX_ANISOTROPY_EXT;
    aniso = max_aniso = gl.getParameter(ext_anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
  }

  handle_error = load({
    name: 'error',
    width: 2, height: 2,
    nozoom: true,
    format: format.RGBA8,
    filter_mag: gl.NEAREST,
    data: new Uint8Array([
      255, 20, 147, 255,
      255, 0, 0, 255,
      255, 255, 255, 255,
      255, 20, 147, 255
    ]),
  }).handle;

  handle_loading = load({
    name: 'loading',
    width: 2, height: 2,
    nozoom: true,
    format: format.RGBA8,
    data: new Uint8Array([
      127, 127, 127, 255,
      0, 0, 0, 255,
      64, 64, 64, 255,
      127, 127, 127, 255,
    ]),
  }).handle;

  load({
    name: 'white',
    width: 2, height: 2,
    nozoom: true,
    format: format.RGBA8,
    data: new Uint8Array([
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
    ]),
  });

  load({
    name: 'invisible',
    width: 2, height: 2,
    nozoom: true,
    format: format.RGBA8,
    data: new Uint8Array([
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]),
  });

  filewatchOn('.png', textureReload);
}
