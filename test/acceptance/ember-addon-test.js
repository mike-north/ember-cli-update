'use strict';

const { describe, it } = require('../helpers/mocha');
const { expect } = require('../helpers/chai');
const { AddonTestApp } = require('ember-cli-addon-tests');
const {
  gitInit,
  commit: _commit,
  postCommit,
  processIo,
  fixtureCompare: _fixtureCompare
} = require('git-fixtures');
const run = require('../../src/run');
const {
  assertNormalUpdate,
  assertNoUnstaged
} = require('../helpers/assertions');
const denodeify = require('denodeify');
const cpr = denodeify(require('cpr'));

const commitMessage = 'add files';

// function resetAndClean(cwd) {
//   run('git reset --hard', { cwd });
//   run('git clean -f', { cwd });
// }

function reset(tmpPath) {
  run('git rm -r .', { cwd: tmpPath });

  return cpr('test/fixtures/app/local/my-app', tmpPath);
}

function init(tmpPath) {
  gitInit({
    cwd: tmpPath
  });

  _commit({
    cwd: tmpPath
  });
}

function commit(tmpPath) {
  _commit({
    m: commitMessage,
    cwd: tmpPath
  });

  postCommit({
    cwd: tmpPath
  });
}

describe(function() {
  this.timeout(10 * 60 * 1000);

  let app;

  beforeEach(function() {
    app = new AddonTestApp();

    return app.create('my-app', {
      fixturesPath: 'test/fixtures/app/local',
      skipNpm: true
    }).then(() => {
      init(app.path);

      // remove newer fixture files not present in older versions
      return reset(app.path);
    }).then(() => {
      app.editPackageJSON(pkg => {
        pkg.devDependencies['ember-cli-update'] = '*';
      });

      commit(app.path);

      return app.run('npm', 'install', '--no-package-lock');
    }).then(() => {
      // get rid of package-lock.json
      // and reset line ending changes on Windows
      // might not be needed because of --no-package-lock above
      // resetAndClean(app.path);

      return app.startServer({
        command: 'update',
        additionalArguments: [
          '--to',
          '3.2.0-beta.1',
          '--resolve-conflicts'
        ],
        detectServerStart() {
          return true;
        }
      });
    });
  });

  function fixtureCompare({
    mergeFixtures
  }) {
    let actual = app.path;
    let expected = mergeFixtures;

    _fixtureCompare({
      expect,
      actual,
      expected
    });
  }

  function merge() {
    return processIo({
      ps: app.server,
      cwd: app.path,
      commitMessage,
      expect
    });
  }

  it('works', function() {
    return merge().then(({
      status
    }) => {
      // remove addon because it's not in the fixtures
      app.editPackageJSON(pkg => {
        delete pkg.devDependencies['ember-cli-update'];
      });

      fixtureCompare({
        mergeFixtures: 'test/fixtures/app/merge/my-app'
      });

      assertNormalUpdate(status);
      assertNoUnstaged(status);
    });
  });
});
