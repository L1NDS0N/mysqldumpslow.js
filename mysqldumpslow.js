#!/usr/bin/env node
// mysqldumpslow.js - parse and summarize the MySQL slow query log
// Node.js port of the original mysqldumpslow.pl (MySQL / Oracle, GPLv2).
//
// Usage: node mysqldumpslow.js [OPTS...] [LOGS...]

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function usage(str) {
  const text = `Usage: mysqldumpslow [ OPTS... ] [ LOGS... ]

Parse and summarize the MySQL slow query log. Options are

  --verbose    verbose
  --debug      debug
  --help       write this text to standard output

  -v           verbose
  -d           debug
  -s ORDER     what to sort by (al, at, ar, c, l, r, t), 'at' is default
                al: average lock time
                ar: average rows sent
                at: average query time
                 c: count
                 l: lock time
                 r: rows sent
                 t: query time
  -r           reverse the sort order (largest last instead of first)
  -t NUM       just show the top n queries
  -a           don't abstract all numbers to N and strings to 'S'
  -n NUM       abstract numbers with at least n digits within names
  -g PATTERN   grep: only consider stmts that include this string
  -h HOSTNAME  hostname of db server for *-slow.log filename (can be wildcard),
               default is '*', i.e. match all
  -i NAME      name of server instance (if using mysql.server startup script)
  -l           don't subtract lock time from total time
`;
  if (str) {
    process.stderr.write(`ERROR: ${str}\n\n`);
    process.stderr.write(text);
    process.exit(1);
  } else {
    process.stdout.write(text);
    process.exit(0);
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- argument parsing (mirrors Getopt::Long usage in the Perl original) ---
function parseArgs(argv) {
  const opt = { s: 'at', h: '*' };
  const files = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    let m;

    if (a === '--') {
      files.push(...argv.slice(i + 1));
      break;
    } else if (a === '-v' || a === '--verbose') {
      opt.v = (opt.v || 0) + 1;
    } else if (a === '--help') {
      opt.help = (opt.help || 0) + 1;
    } else if (a === '-d' || a === '--debug') {
      opt.d = (opt.d || 0) + 1;
    } else if (a === '-s' || a === '--sort') {
      opt.s = argv[++i];
    } else if ((m = a.match(/^--sort=(.*)$/))) {
      opt.s = m[1];
    } else if (a === '-r') {
      opt.r = true;
    } else if (a === '--no-r') {
      opt.r = false;
    } else if (a === '-t' || a === '--top') {
      opt.t = parseInt(argv[++i], 10);
    } else if ((m = a.match(/^--top=(.*)$/))) {
      opt.t = parseInt(m[1], 10);
    } else if (a === '-a') {
      opt.a = true;
    } else if (a === '--no-a') {
      opt.a = false;
    } else if (a === '-n') {
      opt.n = parseInt(argv[++i], 10);
    } else if ((m = a.match(/^--n=(.*)$/))) {
      opt.n = parseInt(m[1], 10);
    } else if (a === '-g' || a === '--grep') {
      opt.g = argv[++i];
    } else if ((m = a.match(/^--grep=(.*)$/))) {
      opt.g = m[1];
    } else if (a === '-h' || a === '--host') {
      opt.h = argv[++i];
    } else if ((m = a.match(/^--host=(.*)$/))) {
      opt.h = m[1];
    } else if (a === '-i' || a === '--instance') {
      opt.i = argv[++i];
    } else if ((m = a.match(/^--instance=(.*)$/))) {
      opt.i = m[1];
    } else if (a === '-l') {
      opt.l = true;
    } else if (a === '--no-l') {
      opt.l = false;
    } else if (a.length > 1 && a[0] === '-') {
      usage(`bad option: ${a}`);
    } else {
      files.push(a);
    }
  }

  return { opt, files };
}

// --- figure out the default slow log file(s) when none given on the CLI ---
function globInDir(dir, pattern) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (e) {
    return [];
  }
  const reStr = '^' + pattern.split('*').map(escapeRegex).join('.*') + '$';
  const re = new RegExp(reStr);
  return entries.filter((f) => re.test(f)).map((f) => path.join(dir, f));
}

function getDefaultLogFiles(opt) {
  let defaults;
  try {
    defaults = execSync('my_print_defaults mysqld', { encoding: 'utf8' });
  } catch (e) {
    process.stderr.write(`Can't run 'my_print_defaults mysqld': ${e.message}\n`);
    process.exit(1);
  }

  const basedirMatch = defaults.match(/--basedir=(.*)/);
  if (!basedirMatch) {
    process.stderr.write(
      `Can't determine basedir from 'my_print_defaults mysqld' output: ${defaults}\n`
    );
    process.exit(1);
  }
  if (opt.v) process.stderr.write(`basedir=${basedirMatch[1]}\n`);

  const datadirMatch = defaults.match(/--datadir=(.*)/);
  let datadir = datadirMatch ? datadirMatch[1] : null;
  const slowlogMatch = defaults.match(/--slow-query-log-file=(.*)/);
  const slowlog = slowlogMatch ? slowlogMatch[1] : null;

  if (!datadir || opt.i) {
    let instances = '';
    try {
      instances = execSync('my_print_defaults instances', { encoding: 'utf8' });
    } catch (e) {
      instances = '';
    }
    if (!instances) {
      process.stderr.write(
        `Can't determine datadir from 'my_print_defaults mysqld' output: ${defaults}\n`
      );
      process.exit(1);
    }
    const instanceNames = [...instances.matchAll(/^--(\w+)-/gm)].map((m) => m[1]);
    if (!opt.i) {
      process.stderr.write(
        `No -i 'instance_name' specified to select among known instances: ${instanceNames.join(' ')}.\n`
      );
      process.exit(1);
    }
    if (!instanceNames.includes(opt.i)) {
      process.stderr.write(
        `Instance '${opt.i}' is unknown (known instances: ${instanceNames.join(' ')})\n`
      );
      process.exit(1);
    }
    const ddMatch = instances.match(new RegExp(`--${opt.i}-datadir=(.*)`));
    if (!ddMatch) {
      process.stderr.write(
        `Can't determine --${opt.i}-datadir from 'my_print_defaults instances' output: ${instances}\n`
      );
      process.exit(1);
    }
    datadir = ddMatch[1];
    if (opt.v) process.stderr.write(`datadir=${datadir}\n`);
  }

  if (slowlog) {
    try {
      if (fs.statSync(slowlog).isFile()) return [slowlog];
    } catch (e) {
      /* fall through to glob */
    }
  }

  const pattern = `${opt.h}-slow.log`;
  const found = globInDir(datadir, pattern);
  if (found.length === 0) {
    process.stderr.write(`Can't find '${path.join(datadir, pattern)}'\n`);
    process.exit(1);
  }
  return found;
}

// --- record splitting: replicates Perl's $/ = ";\n#" paragraph-mode read ---
function splitRecords(content) {
  if (content.length === 0) return [];
  const DELIM = ';\n#';
  const parts = content.split(DELIM);
  const records = [];
  for (let i = 0; i < parts.length; i++) {
    if (i < parts.length - 1) {
      records.push(parts[i] + DELIM);
    } else if (parts[i].length) {
      records.push(parts[i]);
    }
  }
  return records;
}

function processRecord(record, opt, stmt) {
  record = record.replace(
    /^#? Time: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+(Z|[+-]\d{2}:\d{2})[^\n]*\n/,
    ''
  );

  let user = '';
  let host = '';
  const uhRe = /^#? User@Host:\s+(\S+)\s+@\s+(\S+)\s+\S+(\s+Id:\s+(\d+))?[^\n]*\n/;
  const uhMatch = record.match(uhRe);
  if (uhMatch) {
    user = uhMatch[1];
    host = uhMatch[2];
    record = record.replace(uhRe, '');
  }

  const qtRe = /^# Query_time: ([0-9.]+)\s+Lock_time: ([0-9.]+)\s+Rows_sent: ([0-9.]+)[^\n]*\n/;
  const qtMatch = record.match(qtRe);
  let t = 0;
  let l = 0;
  let r = 0;
  if (qtMatch) {
    t = parseFloat(qtMatch[1]);
    l = parseFloat(qtMatch[2]);
    r = parseFloat(qtMatch[3]);
    record = record.replace(qtRe, '');
  }
  if (!opt.l) t -= l;

  // remove fluff that mysqld writes to log when it (re)starts
  record = record.replace(/^\/.*Version.*started with:.*\n/gm, '');
  record = record.replace(/^Tcp port: \d+  Unix socket: \S+\n/gm, '');
  record = record.replace(/^Time.*Id.*Command.*Argument.*\n/gm, '');

  record = record.replace(/^use \w+;\n/, ''); // not consistently added
  record = record.replace(/^SET timestamp=\d+;\n/, '');

  record = record.replace(/^[ \t]*\n/gm, ''); // delete blank lines
  record = record.replace(/^[ \t]*/gm, '  '); // normalize leading whitespace
  record = record.replace(/\s*;\s*(#\s*)?$/, ''); // trailing semicolon(+hash)

  if (opt.g && !new RegExp(opt.g, 'i').test(record)) return;

  if (!opt.a) {
    record = record.replace(/\b\d+\b/g, 'N');
    record = record.replace(/\b0x[0-9A-Fa-f]+\b/g, 'N');
    record = record.replace(/''/g, "'S'");
    record = record.replace(/""/g, '"S"');
    record = record.replace(/\\'/g, '');
    record = record.replace(/\\"/g, '');
    record = record.replace(/'[^']+'/g, "'S'");
    record = record.replace(/"[^"]+"/g, '"S"');
    // -n=8: turn log_20001231 into log_NNNNNNNN
    if (opt.n) {
      const nre = new RegExp(`([a-z_]+)(\\d{${opt.n},})`, 'gi');
      record = record.replace(nre, (m, p1, p2) => p1 + 'N'.repeat(p2.length));
    }
    // abbreviate massive "in (...)" statements and similar
    record = record.replace(/(([NS],){100,})/g, (m, p1) => {
      return `${p1}{repeated ${Math.floor(p1.length / 2)} times}`;
    });
  }

  if (opt.d) process.stderr.write(`{{${record}}}\n\n`);

  if (!stmt[record]) {
    stmt[record] = { c: 0, t: 0, l: 0, r: 0, users: {}, hosts: {} };
  }
  const s = stmt[record];
  s.c += 1;
  s.t += t;
  s.l += l;
  s.r += r;
  if (user) s.users[user] = (s.users[user] || 0) + 1;
  if (host) s.hosts[host] = (s.hosts[host] || 0) + 1;
}

function outputResults(stmt, opt) {
  const keys = Object.keys(stmt);
  for (const k of keys) {
    const v = stmt[k];
    v.at = v.t / v.c;
    v.al = v.l / v.c;
    v.ar = v.r / v.c;
  }

  let sorted = keys.slice().sort((a, b) => stmt[b][opt.s] - stmt[a][opt.s]);
  if (opt.t) sorted = sorted.slice(0, opt.t);
  if (opt.r) sorted = sorted.reverse();

  for (const k of sorted) {
    const v = stmt[k];
    const users = Object.keys(v.users);
    const user = users.length === 1 ? users[0] : `${users.length}users`;
    const hosts = Object.keys(v.hosts);
    const host = hosts.length === 1 ? hosts[0] : `${hosts.length}hosts`;

    process.stdout.write(
      `Count: ${v.c}  Time=${v.at.toFixed(2)}s (${Math.trunc(v.t)}s)  ` +
        `Lock=${v.al.toFixed(2)}s (${Math.trunc(v.l)}s)  ` +
        `Rows=${v.ar.toFixed(1)} (${Math.trunc(v.r)}), ${user}@${host}\n${k}\n\n`
    );
  }
}

function main() {
  const { opt, files } = parseArgs(process.argv.slice(2));
  if (opt.help) usage();

  let inputFiles = files;
  if (inputFiles.length === 0) {
    inputFiles = getDefaultLogFiles(opt);
  }

  process.stderr.write(`\nReading mysql slow query log from ${inputFiles.join(' ')}\n`);

  const stmt = {};
  const pending = [];

  for (const file of inputFiles) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (e) {
      process.stderr.write(`Can't open ${file}: ${e.message}\n`);
      process.exit(1);
    }
    pending.push(...splitRecords(content));
  }

  const headerRe = /^\/.*Version.*started with[\s\S]*?Time.*Id.*Command.*Argument.*\n/m;

  while (pending.length) {
    const record = pending.shift();
    if (opt.d) process.stderr.write(`[[${record}]]\n`);

    const chunks = record.split(headerRe);
    if (chunks.length > 1) {
      const nonEmpty = chunks.filter((c) => c.length);
      pending.unshift(...nonEmpty);
      if (opt.d) process.stderr.write('<<' + chunks.join('>>\n<<') + '>>\n');
      continue;
    }

    processRecord(record, opt, stmt);
  }

  outputResults(stmt, opt);
}

main();
