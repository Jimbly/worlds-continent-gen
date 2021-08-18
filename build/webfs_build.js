const assert = require('assert');
const concat = require('glov-build-concat');
const gb = require('glov-build');
const { forwardSlashes } = gb;
const path = require('path');

const preamble = `(function () {
var fs = window.glov_webfs = window.glov_webfs || {};`;
const postamble = '}());';

let chars = (function () {
  const ESC = String.fromCharCode(27);
  let ret = [];
  for (let ii = 0; ii < 256; ++ii) {
    ret[ii] = String.fromCharCode(ii);
  }
  // ASCII text must encode directly
  // single-byte nulls
  ret[0] = String.fromCharCode(126);
  // escape our escape character and otherwise overlapped values
  ret[27] = `${ESC}${String.fromCharCode(27)}`;
  ret[126] = `${ESC}${String.fromCharCode(126)}`;
  // escape things not valid in Javascript strings
  ret[8] = '\\b';
  ret[9] = '\\t';
  ret[10] = '\\n';
  ret[11] = '\\v';
  ret[12] = '\\f';
  ret[13] = '\\r';
  ret['\''.charCodeAt(0)] = '\\\'';
  ret['\\'.charCodeAt(0)] = '\\\\';
  // All other characters are fine (though many get turned into 2-byte UTF-8 strings)
  return ret;
}());

function encodeString(buf) {
  let ret = [];
  for (let ii = 0; ii < buf.length; ++ii) {
    let c = buf[ii];
    ret.push(chars[c]);
  }
  return ret.join('');
}

function fileFSName(opts, name) {
  name = forwardSlashes(name).replace('autogen/', '');
  if (opts.base) {
    name = forwardSlashes(path.relative(opts.base, name));
  }
  return name;
}

module.exports = function webfsBuild(opts) {
  assert(opts.output);
  return concat({
    preamble,
    postamble,
    output: opts.output,
    proc: function (job, file, next) {
      let name = fileFSName(opts, file.relative);
      let data = file.contents;
      let line = `fs['${name}'] = [${data.length},'${encodeString(data)}'];`;
      next(null, { contents: line });
    },
  });
};
