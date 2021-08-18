// Portions Copyright 2019 Jimb Esser (https://github.com/Jimbly/)
// Released under MIT License: https://opensource.org/licenses/MIT

const { serverConfig } = require('./server_config.js');

// Options pulled in from serverConfig
// how far behind proxies that reliably add x-forwarded-for headers are we?
let forward_depth = serverConfig().forward_depth || 0;
let forward_loose = serverConfig().forward_loose || false;

function skipWarn(req) {
  if (forward_loose) {
    return true;
  }
  if (req.url === '/' || req.url === '/status') {
    // skipping warning on '/' because lots of internal health checks or
    // something on GCP seem to hit this, and / is not an endpoint that could
    // have anything interesting on its own.
    return true;
  }
  return false;
}

const regex_ipv4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/;
export function ipFromRequest(req) {
  // See getRemoteAddressFromRequest() for more implementation details, possibilities, proxying options
  // console.log('Client connection headers ' + JSON.stringify(req.headers));

  if (req.glov_ip) {
    return req.glov_ip;
  }

  let raw_ip = req.client.remoteAddress || req.client.socket && req.client.socket.remoteAddress;
  let ip = raw_ip;
  if (forward_depth) {
    // Security note: must check x-forwarded-for *only* if we know this request came from a
    //   reverse proxy, should warn if missing x-forwarded-for.
    // If forwarded through multiple proxies, want to get just the original client IP,
    //   but the configuration must specify how many trusted proxies we passed through.
    let header = req.headers['x-forwarded-for'];
    if (!header) {
      if (!skipWarn(req)) {
        console.warn('Received request missing any x-forwarded-for header from ' +
          `${raw_ip} for ${req.url}, assuming trusted local`);
      }
      // Use raw IP
    } else {
      let forward_list = (header || '').split(',');
      let forward_ip = (forward_list[forward_list.length - forward_depth] || '').trim();
      if (!forward_ip) {
        // forward_depth is incorrect, or someone is not getting the appropriate headers
        // Best guess: leftmost or raw IP
        ip = forward_list[0].trim() || raw_ip;
        if (forward_loose) {
          // don't warn, just use best guess
        } else {
          if (!skipWarn(req)) {
            console.warn(`Received request missing expected x-forwarded-for header from ${raw_ip} for ${req.url}`);
          }
          // use a malformed IP so that it does not pass "is local" IP checks, etc
          ip = `untrusted:${ip}`;
        }
      } else {
        ip = forward_ip;
      }
    }
  }
  if (!ip) {
    // client already disconnected?
    return 'unknown';
  }
  let m = ip.match(regex_ipv4);
  if (m) {
    ip = m[1];
  }
  req.glov_ip = ip;
  return ip;
  // return `${ip}${port ? `:${port}` : ''}`;
}

let cache = {};
let debug_ips = /^(?:(?:::1)|(?:127\.0\.0\.1)(?::\d+)?)$/;
export function isLocalHost(ip) {
  let cached = cache[ip];
  if (cached === undefined) {
    cache[ip] = cached = Boolean(ip.match(debug_ips));
    if (cached) {
      console.info(`Allowing dev access from ${ip}`);
    } else {
      console.debug(`NOT Allowing dev access from ${ip}`);
    }
  }
  return cached;
}

export function allowMapFromLocalhostOnly(app) {
  app.use(function (req, res, next) {
    let ip = ipFromRequest(req);
    req.glov_is_dev = isLocalHost(ip);
    next();
  });
  app.all('*.map', function (req, res, next) {
    if (req.glov_is_dev) {
      return void next();
    }
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end(`Cannot ${req.method} ${req.url}`);
  });
}

export function safeString(str) {
  return str.replace(/["<>\\]/g, '');
}

export function respondArray(req, res, next, err, arr) {
  if (err) {
    return void next(err);
  }
  let text;
  if (req.query.format === 'csv' || req.query.format === 'tsv') {
    res.setHeader('Content-Type', 'text/plain');
    let delim = req.query.format === 'csv' ? ',' : '\t';
    let header = [];
    let keys = {};
    let lines = [];
    for (let ii = 0; ii < arr.length; ++ii) {
      let elem = arr[ii];
      for (let key in elem) {
        let idx = keys[key];
        if (idx === undefined) {
          keys[key] = header.length;
          header.push(key);
        }
      }
      lines.push(header.map((f) => `${elem[f]}`).join(delim));
    }
    text = `${header.join(delim)}\n${lines.join('\n')}`;
  } else {
    res.setHeader('Content-Type', 'application/json');
    text = JSON.stringify(arr);
  }
  res.end(text);
}

export function setOriginHeaders(req, res, next) {
  if (req.headers.origin) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  }
  next();
}
