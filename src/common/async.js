const assert = require('assert');

// Various async functions

let nextTick = typeof process !== 'undefined' ?
  process.nextTick :
  window.setImmediate ? window.setImmediate : (fn) => setTimeout(fn, 1);

// Derived from https://github.com/hughsk/async-series - MIT Licensed
function series(arr, done) {
  let length = arr.length;

  if (!length) {
    return void nextTick(done);
  }

  function handleItem(idx) {
    arr[idx](function (err) {
      if (err) {
        return done(err);
      }
      if (idx < length - 1) {
        return handleItem(idx + 1);
      }
      return done();
    });
  }

  handleItem(0);
}
exports.series = series;

// Originally derived from https://github.com/feross/run-parallel-limit - MIT licensed
function eachLimit(arr, limit, proc, done) {
  assert.equal(typeof limit, 'number');
  assert(Array.isArray(arr));
  assert.equal(typeof proc, 'function');
  assert.equal(typeof done, 'function');
  let len = arr.length;
  let pending = len;
  let is_errored;

  let next;
  let results = [];
  function doNext(idx, err, result) {
    results[idx] = result;
    if (err) {
      is_errored = true;
    }
    if (--pending === 0 || err) {
      if (done) {
        done(err, results);
      }
      done = null;
    } else if (!is_errored && next < len) {
      let key = next++;
      proc(arr[key], doNext.bind(null, key));
    }
  }

  if (!pending) {
    // empty
    return void nextTick(done.bind(null, null, results));
  }
  next = limit;
  for (let ii = 0; ii < arr.length && ii < limit; ++ii) {
    proc(arr[ii], doNext.bind(null, ii));
  }
}
exports.eachLimit = eachLimit;

function each(arr, proc, done) {
  eachLimit(arr, Infinity, proc, done);
}
exports.each = each;

function parallelLimit(tasks, limit, done) {
  eachLimit(tasks, limit, function (task, next) {
    task(next);
  }, done);
}
exports.parallelLimit = parallelLimit;

Object.keys(exports).forEach((key) => {
  exports[`async${key[0].toUpperCase()}${key.slice(1)}`] = exports[key];
});
