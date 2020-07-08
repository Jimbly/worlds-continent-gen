(function () {
var fs = window.glov_webfs = window.glov_webfs || {};
fs['shaders/hex.fp'] = [4566,'#pragma WebGL2\n\nprecision lowp float;\n\nuniform sampler2D tex0;\nuniform sampler2D tex1;\n\nuniform vec4 hex_param;\n\nvarying lowp vec4 interp_color;\nvarying vec2 interp_texcoord;\n\n//const float SKEW_X = sqrt(0.5*0.5 + 1.0);\nconst float HEX_HEIGHT = 1.0;\nconst vec2 VIEW_OFFS = vec2(0.5, 0.0);\nconst float HEX_EDGE = HEX_HEIGHT / sqrt(3.0);\nconst float HEX_EXTRA_WIDTH = 0.5 * HEX_EDGE; // cos(60/180*PI) * HEX_EDGE\nconst float HEX_WIDTH = HEX_EDGE + HEX_EXTRA_WIDTH; // 1.5 * HEX_EDGE\nconst float HEX_NON_EXTRA = HEX_EDGE / HEX_WIDTH; // 2/3rds\nconst float HEX_HEIGHT_2 = HEX_HEIGHT / 2.0; // sin(60/180*PI) (0.85) * HEX_EDGE\nconst float HEX_SLOPE = HEX_HEIGHT_2 / HEX_EXTRA_WIDTH;\n\n// Returns distance to the line from point p0\n// dir is a normalized direction\nfloat pointLineDist(vec2 p1, vec2 dir, vec2 p0) {\n  vec2 b = p1 - p0;\n  return abs(dir.x * b.y - dir.y * b.x);\n}\n\n\nvoid main(void) {\n  vec2 fpos = (interp_texcoord - VIEW_OFFS) * vec2(1.0 / HEX_WIDTH, 1.0 / HEX_HEIGHT);\n  float ix = floor(fpos.x);\n  bool odd = ix - 2.0 * floor(ix/2.0) == 1.0;\n  if (odd) {\n    fpos.y -= 0.5;\n  }\n  float fracx = fpos.x - ix;\n  float iy = floor(fpos.y);\n  float fracy = fpos.y - iy;\n  if (fracx < HEX_NON_EXTRA) {\n    // in solid section\n  } else {\n    // in overlapping section\n    float run = ((fracx - HEX_NON_EXTRA) * HEX_WIDTH);\n    if (fracy > 0.5) {\n      // in top half\n      float slope = (1.0 - fracy) * HEX_HEIGHT / run;\n      if (slope < HEX_SLOPE) {\n        // in next over and up\n        ix++;\n        if (odd) {\n          iy++;\n        }\n        fracy -= 0.5;\n        fracx -= 1.0;\n      }\n    } else {\n      // in bottom half\n      float slope = (fracy * HEX_HEIGHT) / run;\n      if (slope < HEX_SLOPE) {\n        // in next over and down\n        ix++;\n        if (!odd) {\n          iy--;\n        }\n        fracy += 0.5;\n        fracx -= 1.0;\n      }\n    }\n  }\n\n  // integer hex coordinates\n  vec2 texcoords = vec2(ix, iy);\n  // texcoords = vec2(floor(interp_texcoord / HEX_HEIGHT));\n\n  texcoords = (texcoords + 0.5) / hex_param.x;\n\n  vec4 tex = texture2D(tex0, texcoords);\n  vec4 tex_color = texture2D(tex1, texcoords);\n  float alpha = interp_color.a;\n  float mode = hex_param.y;\n  vec3 color = tex_color.rgb;\n  if (mode == 3.0) {\n    // rivers\n    vec4 bits1;\n    vec3 bits2;\n    float bits_source = tex.x * 255.0;\n    bits1.x = bits_source * 0.5 + 0.1;\n    bits1.y = floor(bits1.x) * 0.5 + 0.1;\n    bits1.z = floor(bits1.y) * 0.5 + 0.1;\n    bits1.w = floor(bits1.z) * 0.5 + 0.1;\n    bits2.x = floor(bits1.w) * 0.5 + 0.1;\n    bits2.y = floor(bits2.x) * 0.5 + 0.1;\n    bits2.z = floor(bits2.y) * 0.25 + 0.1;\n    bits1 = floor(fract(bits1) * 2.0);\n    bits2 = floor(fract(bits2) * vec3(2.0, 2.0, 4.0));\n\n    float strahler = tex.y * 255.0;\n\n    fracx = fracx * 0.75 + 0.25;\n    float r = 0.0;\n    vec2 pt = vec2(fracx, fracy);\n    float RHWIDTH = min(strahler * 0.04, 0.24) + hex_param.z;\n    float mul = hex_param.w * 0.5;\n    //float mindist = 1.0;\n    float dist = pointLineDist(vec2(0.5, 0.0), vec2(0.0, 1.0), pt);\n    float v = (RHWIDTH - dist) * mul;\n    // Not sure if this form or the dot() form below is better\n    r = max(r, v * ((fracy < 0.5 ? bits1.w : 0.0) + (fracy < 0.5 ? 0.0 : bits1.x)));\n    //mindist = min(mindist, mix(1.0, dist, dot(bits1.wx, vec2(fracy < 0.5 ? 1.0 : 0.0, fracy < 0.5 ? 0.0 : 1.0))));\n    dist = pointLineDist(vec2(-0.25, 0.0), vec2(0.83205, 0.5547), pt);\n    v = (RHWIDTH - dist) * mul;\n    r = max(r, v * dot(vec2(bits2.x, bits1.y), vec2(fracx < 0.5 ? 1.0 : 0.0, fracx < 0.5 ? 0.0 : 1.0)));\n    //mindist = min(mindist, mix(1.0, dist, dot(vec2(bits2.x, bits1.y), vec2(fracx < 0.5 ? 1.0 : 0.0, fracx < 0.5 ? 0.0 : 1.0))));\n    dist = pointLineDist(vec2(1.25, 0.0), vec2(-0.83205, 0.5547), pt);\n    v = (RHWIDTH - dist) * mul;\n    r = max(r, v * dot(vec2(bits2.y, bits1.z), vec2(fracx < 0.5 ? 1.0 : 0.0, fracx < 0.5 ? 0.0 : 1.0)));\n    //mindist = min(mindist, mix(1.0, dist, dot(vec2(bits2.y, bits1.z), vec2(fracx < 0.5 ? 1.0 : 0.0, fracx < 0.5 ? 0.0 : 1.0))));\n    dist = distance(pt, vec2(0.5, 0.5));\n    v = ((RHWIDTH - hex_param.z) * 1.1 + hex_param.z - dist) * mul;\n    r = max(r, v * clamp(bits_source, 0.0, 1.0));\n    //mindist = min(mindist, mix(1.0, dist, clamp(bits_source, 0.0, 1.0)));\n    //r = clamp((RHWIDTH - mindist) * mul, 0.0, 1.0);\n\n    r = min(r, 1.0);\n\n    r *= min(1.0, strahler * 0.25);\n\n    color.rgb = mix(color.rgb, vec3(0.0, 0.0, 1.0), r);\n  }\n  if (ix < 0.0 || ix >= hex_param.x || iy < 0.0 || iy >= hex_param.x) {\n    alpha = 0.0;\n  }\n  gl_FragColor = vec4(color * interp_color.rgb, alpha);\n}\n'];
fs['shaders/test.fp'] = [2008,'#pragma WebGL2\nprecision mediump float;\nprecision mediump int;\n\nvarying lowp vec4 interp_color;\nvarying highp vec2 interp_texcoord;\nuniform vec4 params;\n\n// Partially From: https://www.shadertoy.com/view/lsl3RH\n// Created by inigo quilez - iq/2013\n// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.\n// See here for a tutorial on how to make this: http://www.iquilezles.org/www/articles/warp/warp.htm\n\nconst mat2 m = mat2( 0.80,  0.60, -0.60,  0.80 );\n\nfloat noise( in vec2 x )\n{\n  return sin(1.5*x.x)*sin(1.5*x.y);\n}\n\nfloat fbm4( vec2 p )\n{\n  float f = 0.0;\n  f += 0.5000*noise( p ); p = m*p*2.02;\n  f += 0.2500*noise( p ); p = m*p*2.03;\n  f += 0.1250*noise( p ); p = m*p*2.01;\n  f += 0.0625*noise( p );\n  return f/0.9375;\n}\n\nfloat fbm6( vec2 p )\n{\n  float f = 0.0;\n  f += 0.500000*(0.5+0.5*noise( p )); p = m*p*2.02;\n  f += 0.250000*(0.5+0.5*noise( p )); p = m*p*2.03;\n  f += 0.125000*(0.5+0.5*noise( p )); p = m*p*2.01;\n  f += 0.062500*(0.5+0.5*noise( p )); p = m*p*2.04;\n  f += 0.031250*(0.5+0.5*noise( p )); p = m*p*2.01;\n  f += 0.015625*(0.5+0.5*noise( p ));\n  return f/0.96875;\n}\n\n\nfloat func( vec2 q )\n{\n  float iTime = params.w;\n  float ql = length( q );\n  q.x += 0.05*sin(0.27*iTime+ql*4.1);\n  q.y += 0.05*sin(0.23*iTime+ql*4.3);\n  q *= 0.5;\n\n  vec2 o = vec2(0.0);\n  o.x = 0.5 + 0.5*fbm4( vec2(2.0*q          )  );\n  o.y = 0.5 + 0.5*fbm4( vec2(2.0*q+vec2(5.2))  );\n\n  float ol = length( o );\n  o.x += 0.02*sin(0.12*iTime+ol)/ol;\n  o.y += 0.02*sin(0.14*iTime+ol)/ol;\n\n  vec2 n;\n  n.x = fbm6( vec2(4.0*o+vec2(9.2))  );\n  n.y = fbm6( vec2(4.0*o+vec2(5.7))  );\n\n  vec2 p = 4.0*q + 4.0*n;\n\n  float f = 0.5 + 0.5*fbm4( p );\n\n  f = mix( f, f*f*f*3.5, f*abs(n.x) );\n\n  float g = 0.5 + 0.5*sin(4.0*p.x)*sin(4.0*p.y);\n  f *= 1.0-0.5*pow( g, 8.0 );\n\n  return f;\n}\n\n\n\nvec3 doMagic(vec2 p)\n{\n  vec2 q = p*5.0;\n\n  float f = func(q);\n\n  vec3 col = mix(interp_color.rgb, params.rgb, f );\n  return col;\n}\n\nvoid main()\n{\n  gl_FragColor = vec4( doMagic( interp_texcoord ), 1.0 );\n}\n'];
fs['glov/shaders/default.fp'] = [1031,'// Portions Copyright 2019 Jimb Esser (https://github.com/Jimbly/)\n// Released under MIT License: https://opensource.org/licenses/MIT\n#pragma WebGL\n\nprecision lowp float;\n\nuniform sampler2D tex0; // source\n\nuniform vec3 light_diffuse;\nuniform vec3 light_dir_vs;\nuniform vec3 ambient;\n\nvarying vec4 interp_color;\nvarying vec2 interp_texcoord;\nvarying vec3 interp_normal_vs;\n\nvoid main(void) {\n  vec4 texture0 = texture2D(tex0, interp_texcoord.xy);\n#ifndef NOGAMMA\n  texture0.rgb = texture0.rgb * texture0.rgb; // pow(2)\n#endif\n  vec4 albedo = texture0 * interp_color;\n  if (albedo.a < 0.01) // TODO: Probably don\'t want this, but makes hacking transparent things together easier for now\n    discard;\n\n  vec3 normal_vs = normalize(interp_normal_vs);\n  float diffuse = max(0.0, 0.5 + 0.5 * dot(normal_vs, -light_dir_vs.rgb));\n\n  vec3 light_color = diffuse * light_diffuse.rgb + ambient.rgb;\n  gl_FragColor = vec4(light_color * albedo.rgb, albedo.a);\n\n#ifndef NOGAMMA\n  gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1.0/2.0));\n#endif\n}'];
fs['glov/shaders/default.vp'] = [974,'// Portions Copyright 2019 Jimb Esser (https://github.com/Jimbly/)\n// Released under MIT License: https://opensource.org/licenses/MIT\n#pragma WebGL\nprecision highp float;\n\n// per-vertex input\nattribute vec3 POSITION;\n//attribute vec3 COLOR;\nattribute vec2 TEXCOORD;\nattribute vec3 NORMAL;\n\n// per-drawcall input\nuniform mat3 mv_inv_trans;\nuniform mat4 projection;\nuniform mat4 mat_mv;\nuniform vec4 color;\n\n// output\nvarying vec4 interp_color;\nvarying vec2 interp_texcoord;\nvarying vec3 interp_normal_vs;\n// varying vec3 interp_pos_vs;\n\nvoid main(void) {\n  //interp_color = vec4(COLOR * color.rgb, color.a);\n  interp_color = color;\n  interp_texcoord = vec2(TEXCOORD);\n  interp_normal_vs = mv_inv_trans * NORMAL;\n  // gl_Position = vec4(POSITION, 1.0);\n\n  // gl_Position = mat_vp * (mat_m * vec4(POSITION, 1.0));\n  // gl_Position = mvp * vec4(POSITION, 1.0);\n  vec4 pos_vs = mat_mv * vec4(POSITION, 1.0);\n  // interp_pos_vs = pos_vs.xyz;\n  gl_Position = projection * pos_vs;\n}'];
fs['glov/shaders/effects_bloom_merge.fp'] = [1118,'#pragma WebGL\n\nprecision highp float;\nprecision highp int;\n\nvarying vec2 interp_texcoord;\n\nvec4 _ret_0;\nvec4 _TMP3;\nvec4 _TMP5;\nfloat _TMP2;\nvec4 _TMP1;\nfloat _TMP0;\nvec4 _TMP36;\nuniform float bloomSaturation;\nuniform float originalSaturation;\nuniform float bloomIntensity;\nuniform float originalIntensity;\nuniform sampler2D inputTexture0;\nuniform sampler2D inputTexture1;\n\nvoid main()\n{\nvec4 _orig;\nvec4 _bloom;\n_orig = texture2D(inputTexture0, interp_texcoord);\n_bloom = texture2D(inputTexture1, interp_texcoord);\n_TMP0 = dot(_bloom.xyz, vec3(2.12599993E-01, 7.15200007E-01, 7.22000003E-02));\n_TMP1 = vec4(_TMP0, _TMP0, _TMP0, _TMP0) + bloomSaturation * (_bloom - vec4(_TMP0, _TMP0, _TMP0, _TMP0));\n_bloom = _TMP1 * bloomIntensity;\n_TMP2 = dot(_orig.xyz, vec3(2.12599993E-01, 7.15200007E-01, 7.22000003E-02));\n_TMP3 = vec4(_TMP2, _TMP2, _TMP2, _TMP2) + originalSaturation * (_orig - vec4(_TMP2, _TMP2, _TMP2, _TMP2));\n_TMP5 = min(vec4(1.0, 1.0, 1.0, 1.0), _bloom);\n_TMP36 = max(vec4(0.0, 0.0, 0.0, 0.0), _TMP5);\n_orig = (_TMP3 * (1.0 - _TMP36)) * originalIntensity;\n_ret_0 = _bloom + _orig;\ngl_FragColor = _ret_0;\n}\n'];
fs['glov/shaders/effects_bloom_threshold.fp'] = [740,'#pragma WebGL\n\nprecision highp float;\nprecision highp int;\n\nvarying vec2 interp_texcoord;\n\nvec4 _ret_0;\nfloat _TMP1;\nfloat _TMP0;\nfloat _a0025;\nfloat _x0027;\nuniform float bloomThreshold;\nuniform float thresholdCutoff;\nuniform sampler2D inputTexture0;\n\nvoid main()\n{\nvec4 _col;\nfloat _luminance;\nfloat _x;\nfloat _cut;\n_col = texture2D(inputTexture0, interp_texcoord);\n_luminance = dot(_col.xyz, vec3(2.12599993E-01, 7.15200007E-01, 7.22000003E-02));\n_x = float((_luminance >= bloomThreshold));\n_a0025 = 3.14159274 * (_luminance / bloomThreshold - 0.5);\n_TMP0 = sin(_a0025);\n_x0027 = 0.5 * (1.0 + _TMP0);\n_TMP1 = pow(_x0027, thresholdCutoff);\n_cut = bloomThreshold * _TMP1;\n_ret_0 = (_x + (1.0 - _x) * _cut) * _col;\ngl_FragColor = _ret_0;\n}\n'];
fs['glov/shaders/effects_color_matrix.fp'] = [453,'#pragma WebGL\n\nprecision lowp float;\n\nvarying vec2 interp_texcoord;\n\nuniform vec4 colorMatrix[3];\nuniform sampler2D tex0;\n\nvoid main()\n{\n  vec4 _color;\n  vec4 _mutc;\n  _color = texture2D(tex0, interp_texcoord);\n  _mutc = _color;\n  _mutc.w = 1.0;\n  vec3 _r0019;\n  _r0019.x = dot(colorMatrix[0], _mutc);\n  _r0019.y = dot(colorMatrix[1], _mutc);\n  _r0019.z = dot(colorMatrix[2], _mutc);\n  _mutc.xyz = _r0019;\n  _mutc.w = _color.w;\n  gl_FragColor = _mutc;\n}'];
fs['glov/shaders/effects_copy.fp'] = [178,'#pragma WebGL\n\nprecision lowp float;\n\nvarying vec2 interp_texcoord;\n\nuniform sampler2D inputTexture0;\nvoid main()\n{\n  gl_FragColor = texture2D(inputTexture0, interp_texcoord);\n}\n'];
fs['glov/shaders/effects_copy.vp'] = [279,'#pragma WebGL\nprecision highp float;\n\nvarying vec2 interp_texcoord;\nattribute vec2 POSITION;\n\nuniform vec2 copy_uv_scale;\nuniform vec4 clip_space;\n\nvoid main()\n{\n  interp_texcoord = POSITION * copy_uv_scale;\n  gl_Position = vec4(POSITION * clip_space.xy + clip_space.zw, 0, 1);\n}'];
fs['glov/shaders/effects_distort.fp'] = [727,'#pragma WebGL\n\nprecision highp float;\nprecision highp int;\n\nvarying vec2 interp_texcoord;\n\nvec4 _ret_0;\nvec2 _UV1;\nvec4 _TMP1;\nvec2 _r0020;\nvec2 _r0028;\nvec2 _v0028;\nuniform vec2 strength;\nuniform vec3 transform[2];\nuniform vec2 invTransform[2];\nuniform sampler2D inputTexture0;\nuniform sampler2D distortTexture;\n\nvoid main()\n{\nvec3 _uvt;\n_uvt = vec3(interp_texcoord.x, interp_texcoord.y, 1.0);\n_r0020.x = dot(transform[0], _uvt);\n_r0020.y = dot(transform[1], _uvt);\n_TMP1 = texture2D(distortTexture, _r0020);\n_v0028 = _TMP1.xy - 0.5;\n_r0028.x = dot(invTransform[0], _v0028);\n_r0028.y = dot(invTransform[1], _v0028);\n_UV1 = interp_texcoord + _r0028 * strength;\n_ret_0 = texture2D(inputTexture0, _UV1);\ngl_FragColor = _ret_0;\n}\n'];
fs['glov/shaders/effects_gaussian_blur.fp'] = [720,'#pragma WebGL\n\nprecision lowp float;\n\nvarying vec2 interp_texcoord;\n\nvec4 _ret_0;\nvec4 _TMP2;\nvec4 _TMP1;\nvec2 _c0022;\nvec2 _c0024;\nuniform vec3 sampleRadius;\nuniform sampler2D inputTexture0;\n\nvoid main()\n{\n  vec2 uv = interp_texcoord;\n  vec2 step = sampleRadius.xy;\n  float glow = sampleRadius.z;\n  gl_FragColor =\n    ((texture2D(inputTexture0, uv - step * 3.0) + texture2D(inputTexture0, uv + step * 3.0)) * 0.085625 +\n    (texture2D(inputTexture0, uv - step * 2.0) + texture2D(inputTexture0, uv + step * 2.0)) * 0.12375 +\n    (texture2D(inputTexture0, uv - step * 1.0) + texture2D(inputTexture0, uv + step * 1.0)) * 0.234375 +\n    texture2D(inputTexture0, uv) * 0.3125) * 0.83333333333333333333333333333333 * glow;\n}\n'];
fs['glov/shaders/error.fp'] = [78,'#pragma WebGL\n\nvoid main(void) {\n  gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);\n}\n'];
fs['glov/shaders/error.vp'] = [289,'// Portions Copyright 2019 Jimb Esser (https://github.com/Jimbly/)\n// Released under MIT License: https://opensource.org/licenses/MIT\n#pragma WebGL\nattribute vec2 POSITION;\nvoid main() {\n  gl_Position = vec4(POSITION.xy * vec2(2.0 / 1024.0, -2.04 / 1024.0) + vec2(-1.0, 1.0), 0.0, 1.0);\n}\n'];
fs['glov/shaders/font_aa.fp'] = [355,'#pragma WebGL2\n\nprecision lowp float;\n\nvarying vec2 interp_texcoord;\nvarying lowp vec4 interp_color;\nvec4 _ret_0;\nuniform sampler2D tex0;\nuniform vec4 param0;\nvoid main()\n{\n  float texture0 = texture2D(tex0,interp_texcoord).r;\n  float res = clamp(texture0 * param0.x + param0.y, 0.0, 1.0);\n  gl_FragColor = vec4(interp_color.rgb, interp_color.a * res);\n}\n'];
fs['glov/shaders/font_aa_glow.fp'] = [637,'#pragma WebGL2\n\nprecision lowp float;\n\nvarying vec2 interp_texcoord;\nvarying lowp vec4 interp_color;\nvec4 _ret_0;\nuniform sampler2D tex0;\nuniform vec4 param0;\nuniform vec4 glowColor;\nuniform vec4 glowParams;\nvoid main()\n{\n  float texture0=texture2D(tex0,interp_texcoord).r;\n  // Glow\n  vec2 glowCoord = interp_texcoord + glowParams.xy;\n  float textureGlow = texture2D(tex0, glowCoord).r;\n  float t = clamp(textureGlow * glowParams.z + glowParams.w, 0.0, 1.0);\n  vec4 outcolor = vec4(glowColor.xyz, t * glowColor.w);\n  // Main body\n  t = clamp(texture0 * param0.x + param0.y, 0.0, 1.0);\n  gl_FragColor = mix(outcolor, interp_color, t);\n}\n'];
fs['glov/shaders/font_aa_outline.fp'] = [635,'#pragma WebGL2\n\nprecision lowp float;\n\nvarying highp vec2 interp_texcoord;\nvarying lowp vec4 interp_color;\nvec4 _ret_0;\nuniform sampler2D tex0;\nuniform vec4 param0;\nuniform vec4 outlineColor;\nvoid main()\n{\n  float texture0=texture2D(tex0,interp_texcoord).r;\n  // Outline\n  vec4 outcolor = vec4(outlineColor.xyz, 0);\n  outcolor.w = clamp(texture0 * param0.x + param0.z, 0.0, 1.0);\n  outcolor.w = outcolor.w * outlineColor.w;\n  // outcolor = mix(outcolor, outlineColor, outcolor.w); // Makes a blackish border\n  // Main body\n  float t = clamp(texture0 * param0.x + param0.y, 0.0, 1.0);\n  gl_FragColor = mix(outcolor, interp_color, t);\n}\n'];
fs['glov/shaders/font_aa_outline_glow.fp'] = [847,'#pragma WebGL2\n\nprecision lowp float;\n\nvarying highp vec2 interp_texcoord;\nvarying lowp vec4 interp_color;\nvec4 _ret_0;\nuniform sampler2D tex0;\nuniform vec4 param0;\nuniform vec4 outlineColor;\nuniform vec4 glowColor;\nuniform vec4 glowParams;\nvoid main()\n{\n  float texture0=texture2D(tex0,interp_texcoord).r;\n  // Glow\n  vec2 glowCoord = interp_texcoord + glowParams.xy;\n  float textureGlow = texture2D(tex0, glowCoord).r;\n  float t = clamp(textureGlow * glowParams.z + glowParams.w, 0.0, 1.0);\n  vec4 outcolor = vec4(glowColor.xyz, t * glowColor.w);\n  // vec4outclor = t * glowColor.xyz;\n  // Outline\n  t = clamp(texture0 * param0.x + param0.z, 0.0, 1.0);\n  t = t * outlineColor.w;\n  outcolor = mix(outcolor, outlineColor, t);\n  // Main body\n  t = clamp(texture0 * param0.x + param0.y, 0.0, 1.0);\n  gl_FragColor = mix(outcolor, interp_color, t);\n}\n'];
fs['glov/shaders/pixely_expand.fp'] = [2432,'// Portions Copyright 2019 Jimb Esser (https://github.com/Jimbly/)\n// Released under MIT License: https://opensource.org/licenses/MIT\n#pragma WebGL\n\nprecision mediump float;\nprecision mediump int;\n\nvarying highp vec2 interp_texcoord;\nuniform sampler2D inputTexture0; // source\nuniform sampler2D inputTexture1; // hblur\nuniform sampler2D inputTexture2; // hblur+vblur\nuniform vec4 orig_pixel_size;\n\n// 1D Gaussian.\nfloat Gaus(float pos, float scale) {\n  return exp2(scale*pos*pos);\n}\n\nconst float SHADE = 0.75;\nconst float EASING = 1.25;\n\n#define DO_WARP\n#ifdef DO_WARP\n// Display warp.\n// 0.0 = none\n// 1.0/8.0 = extreme\nconst vec2 WARP=vec2(1.0/32.0,1.0/24.0);\n\n// Distortion of scanlines, and end of screen alpha.\nvec2 Warp(vec2 pos){\n  pos=pos*2.0-1.0;\n  pos*=vec2(1.0+(pos.y*pos.y)*WARP.x,1.0+(pos.x*pos.x)*WARP.y);\n  return pos*0.5+0.5;\n}\n#else\n#define Warp(v) v\n#endif\n\nfloat easeInOut(float v) {\n  float va = pow(v, EASING);\n  return va / (va + pow((1.0 - v), EASING));\n}\n\nfloat easeIn(float v) {\n  return 2.0 * easeInOut(0.5 * v);\n}\n\nfloat easeOut(float v) {\n  return 2.0 * easeInOut(0.5 + 0.5 * v) - 1.0;\n}\n\nvoid main()\n{\n  vec2 texcoords = Warp(interp_texcoord);\n  vec2 intcoords = (floor(texcoords.xy * orig_pixel_size.xy) + 0.5) * orig_pixel_size.zw;\n  vec2 deltacoords = (texcoords.xy - intcoords) * orig_pixel_size.xy; // -0.5 ... 0.5\n  // for horizontal sampling, map [-0.5 .. -A .. A .. 0.5] -> [-0.5 .. 0 .. 0 .. 0.5];\n  float A = 0.25;\n  float Ainv = (0.5 - A) * 2.0;\n  float uoffs = clamp((abs(deltacoords.x) - A) / Ainv, 0.0, 1.0) * orig_pixel_size.z;\n  uoffs *= sign(deltacoords.x);\n  vec2 sample_coords = vec2(intcoords.x + uoffs, intcoords.y);\n  // sample_coords = intcoords;\n  vec3 color = texture2D(inputTexture1, sample_coords).rgb;\n  vec3 color_scanline = texture2D(inputTexture2, texcoords.xy + vec2(0.0, 0.5 * orig_pixel_size.w)).rgb * SHADE;\n  // color_scanline = vec3(0);\n\n  // float mask = Gaus(deltacoords.y, -12.0);\n  float mask = easeOut(2.0*(0.5 - abs(deltacoords.y)));\n  // float mask = abs(deltacoords.y) > 0.25 ? 0.0 : 1.0;\n  color = mix(color_scanline, color, mask);\n  // color = vec3(mask);\n\n#ifdef DO_WARP\n  // vignette\n  float dist = min(1.0, 100.0 * min(0.5 - abs(texcoords.x - 0.5), 0.5 - abs(texcoords.y - 0.5)));\n  color *= 0.5 + 0.5 * dist;\n#endif\n\n  gl_FragColor = vec4(color, 1.0);\n  // gl_FragColor = vec4(color_scanline, 1.0);\n  // gl_FragColor = vec4(sample_coords, 0.0, 1.0);\n}\n'];
fs['glov/shaders/snapshot.fp'] = [528,'#pragma WebGL2\n\nprecision lowp float;\n\nuniform sampler2D tex0;\nuniform sampler2D tex1;\nuniform lowp vec4 color1;\n\nvarying lowp vec4 interp_color;\nvarying vec2 interp_texcoord;\n\nvoid main(void) {\n  vec3 tex0 = texture2D(tex0,interp_texcoord).rgb;\n  float tex1 = texture2D(tex1,interp_texcoord).r;\n  float alpha = tex0.r - tex1 + 1.0;\n  // TODO: (perf?) (quality?) better to output pre-multiplied alpha (tex0) and change state?\n  vec3 orig_rgb = tex0 / max(0.01, alpha);\n  gl_FragColor = vec4(orig_rgb, alpha * interp_color.a);\n}\n'];
fs['glov/shaders/sprite.fp'] = [231,'#pragma WebGL2\n\nprecision lowp float;\n\nuniform sampler2D tex0;\n\nvarying lowp vec4 interp_color;\nvarying vec2 interp_texcoord;\n\nvoid main(void) {\n  vec4 tex = texture2D(tex0, interp_texcoord);\n  gl_FragColor = tex * interp_color;\n}\n'];
fs['glov/shaders/sprite.vp'] = [533,'// Portions Copyright 2019 Jimb Esser (https://github.com/Jimbly/)\n// Released under MIT License: https://opensource.org/licenses/MIT\n#pragma WebGL2\nprecision highp float;\n\n// per-vertex input\nattribute vec2 POSITION;\nattribute vec4 COLOR;\nattribute vec2 TEXCOORD;\n\n// output\nvarying lowp vec4 interp_color;\nvarying vec2 interp_texcoord;\n\n// global parameters\nuniform vec4 clip_space;\n\nvoid main()\n{\n  interp_texcoord = TEXCOORD;\n  interp_color = COLOR;\n  gl_Position = vec4(POSITION.xy * clip_space.xy + clip_space.zw, 0.0, 1.0);\n}\n'];
fs['glov/shaders/sprite_dual.fp'] = [567,'#pragma WebGL2\n\nprecision lowp float;\n\nuniform sampler2D tex0;\nuniform sampler2D tex1;\nuniform lowp vec4 color1;\n\nvarying lowp vec4 interp_color;\nvarying vec2 interp_texcoord;\n\nvoid main(void) {\n  vec4 tex0 = texture2D(tex0,interp_texcoord);\n  vec2 tex1 = texture2D(tex1,interp_texcoord).rg;\n  float value = dot(tex0.rgb, vec3(0.2, 0.5, 0.3));\n  vec3 valueR = value * interp_color.rgb;\n  vec3 valueG = value * color1.rgb;\n  vec3 value3 = mix(tex0.rgb, valueG, tex1.g);\n  value3 = mix(value3, valueR, tex1.r);\n  gl_FragColor = vec4(value3, tex0.a * interp_color.a);\n}\n'];
fs['glov/shaders/transition_pixelate.fp'] = [956,'#pragma WebGL2\n\nprecision lowp float;\n\nvarying highp vec2 interp_texcoord;\n\nuniform sampler2D tex0;\nuniform vec4 param0;\nuniform vec4 param1;\n\nvoid main(void)\n{\n  vec2 interp_uvs = interp_texcoord;\n  // TODO: for best look, should generate an appropriate mipmap and sample from that/just render it w/ nearest neighbor\n  // result = texture2D(tex0, min(floor(interp_uvs.xy * param0.xy + 0.5) * param0.zw - param1.xy, param1.zw) );\n\n  // Unlike ARBfp version, shift RGB channels separately (3x slowdown)\n  vec4 texture0r = texture2D(tex0, min(floor(interp_uvs.xy * param0.xy + vec2(0.58, 0.5)) * param0.zw - param1.xy, param1.zw) );\n  vec4 texture0g = texture2D(tex0, min(floor(interp_uvs.xy * param0.xy + vec2(0.5, 0.48)) * param0.zw - param1.xy, param1.zw) );\n  vec4 texture0b = texture2D(tex0, min(floor(interp_uvs.xy * param0.xy + vec2(0.42, 0.5)) * param0.zw - param1.xy, param1.zw) );\n  gl_FragColor = vec4(texture0r.r, texture0g.g, texture0b.b, 1);\n}\n'];
fs['glov/models/box_textured_embed.glb'] = [2252,'glTF~~~Ì\b~~h~~JSON{"asset":{"generator":"COLLADA2GLTF","version":"2.0"},"scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"children":[1],"matrix":[1,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,1]},{"mesh":0}],"meshes":[{"primitives":[{"attributes":{"NORMAL":1,"POSITION":2,"TEXCOORD_0":3},"indices":0,"mode":4,"material":0}],"name":"Mesh"}],"accessors":[{"bufferView":0,"byteOffset":0,"componentType":5123,"count":36,"max":[23],"min":[0],"type":"SCALAR"},{"bufferView":1,"byteOffset":0,"componentType":5126,"count":24,"max":[1,1,1],"min":[-1,-1,-1],"type":"VEC3"},{"bufferView":1,"byteOffset":288,"componentType":5126,"count":24,"max":[0.5,0.5,0.5],"min":[-0.5,-0.5,-0.5],"type":"VEC3"},{"bufferView":2,"byteOffset":0,"componentType":5126,"count":24,"max":[6,1],"min":[0,0],"type":"VEC2"}],"materials":[{"pbrMetallicRoughness":{"baseColorTexture":{"index":0,"texCoord":0},"metallicFactor":0,"baseColorFactor":[1,1,1,1],"roughnessFactor":1},"name":"Texture","emissiveFactor":[0,0,0],"alphaMode":"OPAQUE","doubleSided":false}],"textures":[{"sampler":0,"source":0}],"samplers":[{"magFilter":9729,"minFilter":9986,"wrapS":10497,"wrapT":10497}],"bufferViews":[{"buffer":0,"byteOffset":0,"byteLength":72,"target":34963},{"buffer":0,"byteOffset":72,"byteLength":576,"byteStride":12,"target":34962},{"buffer":0,"byteOffset":648,"byteLength":192,"byteStride":8,"target":34962}],"buffers":[{"name":"box_textured","byteLength":840}]}H~~BIN~~~~~~~~~~~~~~\b~\t~\n~\v~\n~\t~\f~\r~~~~\r~~~~~~~~~~~~~~~~~~~~~~~?~~~~~~~~~~?~~~~~~~~~~?~~~~~~~~~~?~~?~~~~~~~~~~?~~~~~~~~~~?~~~~~~~~~~?~~~~~~~~~~~~~~?~~~~~~~~~~?~~~~~~~~~~?~~~~~~~~~~?~~~~~~~~~~¿~~~~~~~~~~¿~~~~~~~~~~¿~~~~~~~~~~¿~~~~~~¿~~~~~~~~~~¿~~~~~~~~~~¿~~~~~~~~~~¿~~~~~~~~~~~~~~~~~~¿~~~~~~~~~~¿~~~~~~~~~~¿~~~~~~~~~~¿~~~¿~~~¿~~~?~~~?~~~¿~~~?~~~¿~~~?~~~?~~~?~~~?~~~?~~~?~~~?~~~?~~~?~~~¿~~~?~~~?~~~?~~~¿~~~?~~~¿~~~¿~~~¿~~~?~~~?~~~?~~~?~~~?~~~¿~~~?~~~¿~~~?~~~?~~~¿~~~?~~~¿~~~?~~~¿~~~¿~~~?~~~?~~~¿~~~¿~~~¿~~~¿~~~¿~~~¿~~~¿~~~?~~~¿~~~?~~~?~~~¿~~~¿~~~¿~~~¿~~~?~~~¿~~~¿~~~¿~~~¿~~~¿~~~?~~~¿~~~?~~~¿~~~¿~~~?~~~?~~~¿~~À@~~~~~~ @~~~~~~À@þÿ?~~ @þÿ?~~@~~~~~~ @~~~~~~@~~?~~ @~~?~~~@~~~~~~?~~~~~~~@~~?~~?~~?~~@@~~~~~~@~~~~~~@@~~?~~@~~?~~@@~~~~~~~@~~~~~~@@~~?~~~@~~?~~~~~~~~~~~~þÿ?~~?~~~~~~?þÿ?'];
fs['glov/words/replacements.txt'] = [32,'blast\nrust\nspark\nburn\nbloop\nderp'];
fs['../common/words/filter.gkg'] = [3027,'nrbyhf\nnubyr\nnany\nnanycebor\nnavyvathf\nnahf\nnerbyn\nnerbyr\nnevna\nnelna\nnff\nnffrng\nnffonat\nnffshpx\nnffung\nnffubyr\nnffznfgre\nnffzhapu\nnffjvcr\nnmm\nonyyfnpx\nonfgneq\nornare\norneqrqpynz\norngpu\nornire\norrlbgpu\norbgpu\novngpu\novtgvg\novzob\novgpu\novgpuneq\noybjwbo\nobbo\nobbovr\nobbol\nobbxvr\nobbgrr\nobbgvr\nobbgl\nohxxnxr\nohyyfuvg\nohyygheq\nohggshpx\nohggcyht\npnzrygbr\npnecrgzhapure\npnjx\npuvap\npuvax\npubqr\npyvg\npyvgbevf\npyvgbehf\npbpx\npbpxoybpx\npbpxubyfgre\npbpxxabpxre\npbpxfzbxre\npbpxfhpxre\npbba\npbexfhpxre\npenpxjuber\nphz\nphzz\nphzzva\nphzfubg\nphzfyhg\nphzfgnva\nphavyvathf\nphaavyvathf\nphag\nphagsnpr\nphaguhag\nphagyvpx\nqntb\nqnzzvg\nqnza\nqnzavg\nqvpx\nqvpxont\nqvpxqvcc\nqvpxsnpr\nqvpxsyvcc\nqvpxurnq\nqvpxvfu\nqvpxevcc\nqvpxfvcc\nqvpxjrrq\nqvpxjuvcc\nqvpxmvcc\nqvxr\nqvyqb\nqvyvtns\nqvcfuvc\nqvcfuvg\nqbbshf\nqbbfu\nqbhpur\nqbhpuront\nqhznff\nqhzonff\nqlxr\nrwnphyngr\nrerpg\nrerpgvba\nrffbuorr\nsnpx\nsnt\nsntt\nsnttrg\nsnttvg\nsnttbg\nsntbg\nsnvt\nsnvtg\nsnaalonaqvg\nsrypu\nsryyngr\nsryyngvb\nsrygpu\nsbnq\nsberfxva\nserrk\nsevtt\nsevttn\nsh\nshh\nshhh\nshhhh\nshpx\nshpxnff\nshpxsnpr\nshpxurnq\nshpxahttrg\nshpxahg\nshpxbss\nshpxgneq\nshpxhc\nshpxjnq\nshpxjvg\nshqtrcnpx\nshx\nshhpx\nshhhpx\nshhhhpx\nshhhhhpx\nsipx\nskpx\ntnr\ntnv\ntnl\ntrl\ntsl\ntunl\nturl\ntbngfr\ntbqnza\ntbqnzavg\ntbqqnz\ntbqqnzzvg\ntbqqnza\ntbyqrafubjre\ntbbx\ntevatb\ntfcbg\nthvqb\nunaqwbo\nuror\nurro\nuryy\nubont\nubzb\nubbxre\nubbgre\nubeal\nuhffl\nulzra\nvaoerq\nvaprfg\nvawha\nwnpxnff\nwnpxubyr\nwnpxbss\nwnc\nwrexbss\nwvfz\nwvm\nwvmz\nwvmm\nxvxr\nxxx\nxyna\nxaboraq\nxbbpu\nxbbgpu\nxenhg\nxlxr\nynovn\nyrfob\nyrmob\nyrmmv\nyrmml\nznfgreongr\nznfgreong\nznfgreongvba\nznfgheongr\nznfgheong\nznfgheongvba\nznkv\nzrafrf\nzrafgehngr\nzrafgehngvba\nzrgu\nzshpxvat\nzbsb\nzbyrfg\nzbbyvr\nzbgureshpxn\nzbgureshpx\nzgureshpx\nzgueshpx\nzhss\nzhssqvire\nzhgunshpxnm\nzhgunshpx\nzhgureshpx\nzhgueshpx\nanxrq\nanmv\nanmvfz\narteb\navttn\navttnu\navttn\navttnm\navtt\navttyr\navtyrg\navccyr\nabbxl\nalzcub\nbshpx\nbeny\nbetnfz\nbetnfzvp\nbetvrf\nbetl\nbinel\nbihz\nbihzf\ncnqql\ncnxv\ncnagl\ncnfgvr\ncnfgl\ncpc\ncrpxre\ncrqb\ncrqbcuvyr\ncrqbcuvyvn\ncrqbcuvyvnp\ncrr\ncrrcrr\ncrargengr\ncrargengvba\ncravny\ncravyr\ncravf\ncrlbgr\ncunyyv\ncunyyvp\ncuhpx\ncvyybjovgre\ncvzc\ncvaxb\ncvff\ncvffbss\nczf\ncbynpx\ncbyybpx\ncbba\ncbbagnat\ncbea\ncbeab\ncbeabtencul\ncevpx\ncevt\ncebfgvghgr\ncehqr\nchor\nchovp\nchovf\nchaxnff\nchff\nchffv\nchffl\nchfflcbhaqre\nchgb\ndhrns\ndhrrs\ndhrrs\ndhrre\ndhrreb\ndhvpxl\ndhvz\nencr\nencrq\nencre\nencvfg\nenhapu\nerpgny\nerpghz\nerpghf\nerrsre\nerrgneq\nervpu\nergneq\nevzwbo\nevgneq\negneq\nehzcenzzre\nehfxv\nfpnt\nfpuybat\nfperj\nfpebt\nfpebg\nfpebgr\nfpebghz\nfpehq\nfphz\nfrzra\nfrk\nfrkhny\nfunzrqnzr\nfuvg\nfuvgr\nfuvgrngre\nfuvgsnpr\nfuvgurnq\nfuvgubyr\nfuvgubhfr\nfuvgg\nfuvm\nfvffl\nfxnt\nfxnax\nfynir\nfyrnmr\nfyrnml\nfyhg\nfyhgqhzcre\nfyhgxvff\nfzrtzn\nfzhg\nfzhgg\nfahss\nfbqbz\nfbhfr\nfbhfrq\nfcrez\nfcvp\nfcvpx\nfcvx\nfgvssl\nfgevc\nfgebxr\ngnzcba\ngneq\ngrnonttvat\ngrng\ngreq\ngrfgr\ngrfgrr\ngrfgvpyr\ngvg\ngvgshpx\ngvgv\ngvggvrshpx\ngvggv\ngvgg\ngvgglshpx\ngenzc\nghotvey\ngheq\nghfu\ngjng\nhtyl\nhaqvrf\nhevany\nhevar\nhgrehf\nint\nintvan\ninyvhz\nivnten\nihyin\njnq\njnat\njnax\njrravr\njvrare\njrvare\njrapu\njrgonpx\njuvgrl\njubenyvpvbhf\njuber\njubernyvpvbhf\njubersnpr\njuberubcc\njuberubhfr\njube\njvttre\njbbql\njbc\njgfuvg\njgshpx\nkengrq\nkkk\nlrnfgl\nlboob\nmnyhcn\n'];
}());