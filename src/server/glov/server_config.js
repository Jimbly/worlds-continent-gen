/* eslint global-require:off */
const argv = require('minimist')(process.argv.slice(2));
const assert = require('assert');
const fs = require('fs');
const json5 = require('json5');
const path = require('path');
const { defaultsDeep } = require('../../common/util.js');

let server_config;

function determinEnv() {
  let env;
  if (argv.env || server_config.env) {
    // explicitly specified, use it
    env = argv.env || server_config.env;
  } else if (process.env.GKE_PROJECTNAME) {
    env = process.env.GKE_PROJECTNAME;
  } else if (process.env.PODNAME) {
    env = 'local-k8s';
  } else if (argv.dev) {
    env = 'dev';
  } else {
    env = 'prod';
  }

  server_config.env = env;
  return env;
}

export function serverConfigStartup(user_defaults) {
  assert(!server_config);
  let config_file = 'config/server.json';
  if (argv.config) {
    config_file = argv.config;
  }
  let user = {};
  let config_path = path.join(process.cwd(), config_file);
  if (fs.existsSync(config_path)) {
    console.log(`Using local server config from ${config_path}`);
    user = json5.parse(fs.readFileSync(config_path, 'utf8'));
  }
  server_config = defaultsDeep(user, user_defaults);

  let env = determinEnv(); // After getting explicit server_config

  let env_path = path.join(__dirname, '../config/env.json');
  if (fs.existsSync(env_path)) {
    console.log(`Using config environment "${env}"`);
    let env_data = json5.parse(fs.readFileSync(env_path, 'utf8'));
    if (!env_data[env]) {
      console.error(`Invalid config environment specified: "${env}"`);
    } else {
      server_config = defaultsDeep(server_config, env_data[env]);
    }
    server_config = defaultsDeep(server_config, env_data.defaults);
  }
}

export function serverConfig() {
  if (!server_config) {
    serverConfigStartup({});
  }
  return server_config;
}
