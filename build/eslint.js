const assert = require('assert');
const gb = require('glov-build');
const { callbackify } = gb;
const path = require('path');

module.exports = function (opts) {
  let { input, name, name_files } = opts;
  name = name || 'eslint';
  name_files = name_files || `${name}_files`;

  let eslint;
  let linter;
  function initLinter() {
    if (linter) {
      return;
    }
    // eslint-disable-next-line global-require
    const { ESLint } = require('eslint');
    eslint = new ESLint();
    linter = callbackify(eslint.lintText.bind(eslint));
  }
  function eslintFilesTaskInit(next) {
    initLinter();
    next();
  }
  function eslintFilesTask(job, done) {
    let file = job.getFile();
    let source_code = file.contents.toString();
    linter(source_code, {
      filePath: path.join(job.gb.getSourceRoot(), file.relative),
    }, function (err, results) {
      if (results) {
        assert.equal(results.length, 1);
        let result = results[0];
        if (result.errorCount || result.warningCount || result.messages.length) {
          job.out({
            relative: `${file.relative}.json`,
            contents: JSON.stringify(results),
          });
        }
      }
      done(err);
    });
  }

  let formatter;
  function eslintFormatterTaskInit(next) {
    initLinter();
    eslint.loadFormatter().then(function (result) {
      formatter = result;
      // prime it / load any other deps
      linter('', { filePath: path.join(gb.getSourceRoot(), 'foo.js') }, function (err, results) {
        if (err) {
          throw err;
        }
        formatter.format(results);
        next();
      });
    });
  }
  function eslintFormatterTask(job, done) {
    let updated_files = job.getFilesUpdated();
    let user_data = job.getUserData();
    let files = user_data.files = user_data.files || {};

    for (let ii = 0; ii < updated_files.length; ++ii) {
      let f = updated_files[ii];
      if (!f.contents) {
        delete files[f.relative];
      } else {
        files[f.relative] = JSON.parse(f.contents);
      }
    }

    let all_results = [];
    let keys = Object.keys(files);
    keys.sort();
    // let error_count = 0;
    // let warning_count = 0;
    for (let ii = 0; ii < keys.length; ++ii) {
      let results = files[keys[ii]];
      // assert.equal(results.length, 1);
      // let result = results[0];
      // error_count += result.errorCount;
      // warning_count += result.warningCount;
      all_results = all_results.concat(results);
    }

    if (all_results.length) {
      let results_text = formatter.format(all_results);
      if (results_text) {
        job.error(results_text);
      }
    }
    // if (error_count) {
    //   job.error(`${error_count} lint error${error_count===1?'':'s'}`);
    // }
    // if (warning_count) {
    //   job.warn(`${warning_count} lint warning${warning_count===1?'':'s'}`);
    // }
    done();
  }

  gb.task({
    name: name_files,
    type: gb.SINGLE,
    input,
    init: eslintFilesTaskInit,
    func: eslintFilesTask,
  });

  return {
    type: gb.ALL,
    input: `${name_files}:**`,
    init: eslintFormatterTaskInit,
    func: eslintFormatterTask,
  };
};
