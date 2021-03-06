// Portions Copyright 2019 Jimb Esser (https://github.com/Jimbly/)
// Released under MIT License: https://opensource.org/licenses/MIT

const assert = require('assert');
const { ChannelWorker } = require('./channel_worker.js');
const md5 = require('../../common/md5.js');
const { isProfane } = require('../../common/words/profanity_common.js');
const random_names = require('./random_names.js');

const DISPLAY_NAME_MAX_LENGTH = 30;
const DISPLAY_NAME_WAITING_PERIOD = 23 * 60 * 60 * 1000;
const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validDisplayName(display_name) {
  if (!display_name || isProfane(display_name) || display_name.length > DISPLAY_NAME_MAX_LENGTH) {
    return false;
  }
  return true;
}

export class DefaultUserWorker extends ChannelWorker {
  constructor(channel_server, channel_id, channel_data) {
    super(channel_server, channel_id, channel_data);
    this.user_id = this.channel_subid; // 1234
  }
  cmdRename(new_name, resp_func) {
    if (this.cmd_parse_source.user_id !== this.channel_subid) {
      return resp_func('ERR_INVALID_USER');
    }
    if (!new_name) {
      return resp_func('Missing name');
    }
    if (!validDisplayName(new_name)) {
      return resp_func('Invalid display name');
    }
    let old_name = this.getChannelData('public.display_name');
    if (new_name === old_name) {
      return resp_func('Name unchanged');
    }
    let unimportant = new_name.toLowerCase() === old_name.toLowerCase();
    let now = Date.now();
    let last_change = this.getChannelData('private.display_name_change');
    if (last_change && now - last_change < DISPLAY_NAME_WAITING_PERIOD && !unimportant) {
      return resp_func('You must wait before changing your display name again');
    }
    this.setChannelData('public.display_name', new_name);
    if (!unimportant) {
      this.setChannelData('private.display_name_change', now);
    }
    return resp_func(null, 'Successfully renamed');
  }
  cmdRenameRandom(ignored, resp_func) {
    return this.cmdRename(random_names.get(), resp_func);
  }
  handleLogin(src, data, resp_func) {
    if (!data.password) {
      return resp_func('Missing password');
    }

    if (!this.getChannelData('private.password')) {
      return resp_func('ERR_USER_NOT_FOUND');
    }
    if (md5(data.salt + this.getChannelData('private.password')) !== data.password) {
      return resp_func('Invalid password');
    }
    this.setChannelData('private.login_ip', data.ip);
    this.setChannelData('private.login_time', Date.now());
    return resp_func(null, this.getChannelData('public'));
  }
  handleLoginFacebook(src, data, resp_func) {
    //Should the authentication step happen here instead?
    if (!this.getChannelData('private.external')) {
      this.setChannelData('private.external', true);
      return this.createShared(data, resp_func);
    }
    this.setChannelData('private.login_ip', data.ip);
    this.setChannelData('private.login_time', Date.now());
    return resp_func(null, this.getChannelData('public'));
  }
  handleCreate(src, data, resp_func) {
    if (this.getChannelData('private.password') || this.getChannelData('private.external')) {
      return resp_func('Account already exists');
    }
    if (!data.password) {
      return resp_func('Missing password');
    }
    if (this.require_email && !email_regex.test(data.email)) {
      return resp_func('Email invalid');
    }
    if (!validDisplayName(data.display_name)) {
      return resp_func('Invalid display name');
    }
    return this.createShared(data, resp_func);
  }
  createShared(data, resp_func) {
    if (this.onUserCreate) {
      let err = this.onUserCreate(data);
      if (err) {
        return resp_func(err);
      }
    }

    let public_data = this.data.public;
    let private_data = this.data.private;

    public_data.display_name = data.display_name;
    if (!validDisplayName(public_data.display_name)) { // If from external auth
      public_data.display_name = random_names.get();
    }
    private_data.password = data.password;
    private_data.email = data.email;
    private_data.creation_ip = data.ip;
    private_data.creation_time = Date.now();
    private_data.login_ip = data.ip;
    private_data.login_time = Date.now();
    this.setChannelData('private', private_data);
    this.setChannelData('public', public_data);
    return resp_func(null, this.getChannelData('public'));
  }
  handleSetChannelData(src, key, value) {
    if (!this.defaultHandleSetChannelData(src, key, value)) {
      return false;
    }
    assert(src);
    assert(src.type);
    if (src.type !== 'client') {
      // from another channel, accept it
      return true;
    }
    // Only allow changes from own client!
    if (src.user_id !== this.user_id) {
      return false;
    }
    return true;
  }
}
DefaultUserWorker.prototype.auto_destroy = true;
DefaultUserWorker.prototype.require_email = true;

class ChannelServerWorker extends ChannelWorker {
  handleWorkerRemoved(src, data, resp_func) {
    assert(!resp_func.expecting_response); // this is a broadcast
    this.channel_server.handleWorkerRemoved(data);
  }
}

ChannelServerWorker.prototype.no_datastore = true; // No datastore instances created here as no persistance is needed

export const regex_valid_username = /^[a-z][a-z0-9_]{1,32}$/;
const regex_valid_channelname = /^(?:fb\$|[a-z])[a-z0-9_]{1,32}$/;

let inited = false;
let user_worker = DefaultUserWorker;
let user_worker_init_data = {
  autocreate: true,
  subid_regex: regex_valid_channelname,
  cmds: [{
    cmd: 'rename',
    help: 'Change display name',
    usage: 'Changes your name as seen by others, your user name (login) remains the same.\n  Usage: /rename New Name',
    func: DefaultUserWorker.prototype.cmdRename,
  },{
    cmd: 'rename_random',
    help: 'Change display name to something random',
    func: DefaultUserWorker.prototype.cmdRenameRandom,
  }],
  handlers: {
    login_facebook: DefaultUserWorker.prototype.handleLoginFacebook,
    login: DefaultUserWorker.prototype.handleLogin,
    create: DefaultUserWorker.prototype.handleCreate,
  },
};
export function overrideUserWorker(new_user_worker, extra_data) {
  assert(!inited);
  user_worker = new_user_worker;
  for (let key in extra_data) {
    let v = extra_data[key];
    if (Array.isArray(v)) {
      let dest = user_worker_init_data[key] = user_worker_init_data[key] || [];
      for (let ii = 0; ii < v.length; ++ii) {
        dest.push(v[ii]);
      }
    } else if (typeof v === 'object') {
      let dest = user_worker_init_data[key] = user_worker_init_data[key] || {};
      for (let subkey in v) {
        dest[subkey] = v[subkey];
      }
    } else {
      user_worker_init_data[key] = v;
    }
  }
}

const CHAT_MAX_MESSAGES = 50;
const CHAT_MAX_LEN = 1024; // Client must be set to this or fewer
const CHAT_USER_FLAGS = 0x1;
export function handleChat(src, pak, resp_func) {
  // eslint-disable-next-line no-invalid-this
  let self = this;
  let { user_id, channel_id, display_name } = src; // user_id is falsey if not logged in
  let client_id = src.id;
  let flags = pak.readInt();
  let msg = pak.readString().trim();
  if (!msg) {
    return resp_func('ERR_EMPTY_MESSAGE');
  }
  if (msg.length > CHAT_MAX_LEN) {
    return resp_func('ERR_MESSAGE_TOO_LONG');
  }
  if (flags & ~CHAT_USER_FLAGS) {
    return resp_func('ERR_INVALID_FLAGS');
  }
  let chat = self.getChannelData('private.chat', null);
  if (!chat) {
    chat = {
      idx: 0,
      msgs: [],
    };
  }
  let ts = Date.now();
  let id = user_id || channel_id;
  // Not saving display name, client can look that up if absolutely needed
  let data_saved = { id, msg, flags, ts };
  // Not broadcasting timestamp, so client will use local timestamp for smooth fading
  // Need client_id on broadcast so client can avoid playing a sound for own messages
  let data_broad = { id, msg, flags, client_id, display_name };
  chat.msgs[chat.idx] = data_saved;
  chat.idx = (chat.idx + 1) % CHAT_MAX_MESSAGES;
  // Setting whole 'chat' blob, since we re-serialize the whole metadata anyway
  self.setChannelData('private.chat', chat);
  self.channelEmit('chat', data_broad);
  // Log entire, non-truncated chat string
  console.info(`${self.channel_id}: chat from ${id} ("${display_name}") ` +
    `(${channel_id}): ${JSON.stringify(msg)}`);
  return resp_func();
}

export function handleChatGet(src, data, resp_func) {
  // eslint-disable-next-line no-invalid-this
  resp_func(null, this.getChannelData('private.chat'));
}

export function init(channel_server) {
  inited = true;
  channel_server.registerChannelWorker('user', user_worker, user_worker_init_data);
  channel_server.registerChannelWorker('channel_server', ChannelServerWorker, {
    autocreate: false,
    subid_regex: /^[0-9-]+$/,
    handlers: {
      worker_removed: ChannelServerWorker.prototype.handleWorkerRemoved,
    },
  });
}
