import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  TARGETS,
  buildNotices,
  cargoClosure,
  hash,
  licenseFiles,
  npmClosure,
  readEvidence,
  syncArtifacts,
} from './notices.mjs';

const temp = (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buddy-notices-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
};
const write = (root, file, bytes) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), bytes);
};
const writeJson = (root, file, value) =>
  write(root, file, JSON.stringify(value));
const edge = (pkg, kind = null) => ({ pkg, dep_kinds: [{ kind }] });

test('Cargo inventory follows normal/build edges and excludes unused/dev packages', () => {
  const metadata = {
    packages: ['root', 'normal', 'build', 'transitive', 'dev', 'unused'].map(
      (id) => ({ id, source: id === 'root' ? null : 'registry' }),
    ),
    resolve: {
      root: 'root',
      nodes: [
        {
          id: 'root',
          deps: [edge('normal'), edge('build', 'build'), edge('dev', 'dev')],
        },
        { id: 'normal', deps: [edge('transitive')] },
        { id: 'transitive', deps: [edge('normal')] },
        { id: 'build', deps: [] },
        { id: 'dev', deps: [] },
        { id: 'unused', deps: [] },
      ],
    },
  };
  assert.deepEqual(
    cargoClosure(metadata).map((pkg) => pkg.id),
    ['normal', 'build', 'transitive'],
  );
});

test('npm inventory resolves nested/hoisted/peer dependencies and excludes dev tools', () => {
  const lock = {
    packages: {
      '': { dependencies: { fox: '1' }, devDependencies: { tool: '1' } },
      'node_modules/fox': {
        dependencies: { shared: '1', nested: '1' },
        peerDependencies: { peer: '1' },
      },
      'node_modules/shared': {},
      'node_modules/peer': {},
      'node_modules/fox/node_modules/nested': {},
      'node_modules/tool': {},
    },
  };
  assert.deepEqual(
    npmClosure(lock).map((pkg) => pkg.key),
    [
      'node_modules/fox',
      'node_modules/fox/node_modules/nested',
      'node_modules/peer',
      'node_modules/shared',
    ],
  );
  assert.throws(
    () =>
      npmClosure({ packages: { '': { dependencies: { '../private': '1' } } } }),
    /Invalid npm package/,
  );
  assert.throws(
    () => npmClosure({ packages: { '': { dependencies: { missing: '1' } } } }),
    /Unresolved runtime/,
  );
});

test('license collection preserves bytes, removes duplicate absolute names, and rejects traversal', (t) => {
  const root = temp(t);
  const bytes = Buffer.from('Copyright original\r\nPermission text\r\n');
  write(root, 'package/LICENSE', bytes);
  write(root, 'secret', 'must not be collected');
  const files = licenseFiles(
    path.join(root, 'package'),
    path.join(root, 'package/LICENSE'),
  );
  assert.equal(files.length, 1);
  assert.equal(files[0].name, 'LICENSE');
  assert.deepEqual(files[0].bytes, bytes);
  assert.throws(
    () => readEvidence(path.join(root, 'package'), '../secret'),
    /escapes its package/,
  );
});

test(
  'license collection refuses a symlink to a file outside the package',
  { skip: process.platform === 'win32' },
  (t) => {
    const root = temp(t);
    write(root, 'secret', 'private');
    fs.mkdirSync(path.join(root, 'package'));
    fs.symlinkSync(
      path.join(root, 'secret'),
      path.join(root, 'package/LICENSE'),
    );
    assert.throws(
      () => licenseFiles(path.join(root, 'package')),
      /escapes its package/,
    );
  },
);

function fixture(t) {
  const root = temp(t);
  writeJson(root, 'package-lock.json', {
    packages: {
      '': { dependencies: { demo: '1' } },
      'node_modules/demo': {
        version: '1.0.0',
        resolved: 'https://registry.npmjs.org/demo',
      },
    },
  });
  writeJson(root, 'node_modules/demo/package.json', {
    name: 'demo',
    version: '1.0.0',
    license: 'MIT',
  });
  write(root, 'node_modules/demo/LICENSE', 'Shared license bytes\r\n');
  write(root, 'registry/demo/LICENSE', 'Shared license bytes\r\n');
  write(root, 'registry/demo/Cargo.toml', '');
  writeJson(root, 'registry/demo/.cargo_vcs_info.json', {
    git: { sha1: 'a'.repeat(40) },
  });
  write(root, 'src-tauri/Cargo.lock', 'version = 4\n');
  writeJson(root, 'third-party/supplements.json', {});
  writeJson(root, 'third-party/runtime-helpers.json', []);
  write(root, 'assets/NOTICE.md', 'Original assets\n');
  const metadata = {
    packages: [
      { id: 'app', source: null },
      {
        id: 'crate',
        name: 'demo',
        version: '1.0.0',
        source: 'registry',
        repository: 'https://github.com/example/demo',
        license: 'MIT',
        manifest_path: path.join(root, 'registry/demo/Cargo.toml'),
      },
    ],
    resolve: {
      root: 'app',
      nodes: [
        { id: 'app', deps: [edge('crate')] },
        { id: 'crate', deps: [] },
      ],
    },
  };
  return { root, resolutions: TARGETS.map((target) => ({ target, metadata })) };
}

test('notices are deterministic across target order, deduplicate texts, and report gaps', (t) => {
  const { root, resolutions } = fixture(t);
  const first = buildNotices(root, resolutions);
  const second = buildNotices(root, [...resolutions].reverse());
  assert.deepEqual([...first.artifacts], [...second.artifacts]);
  assert.equal(first.inventory.packageCount, 2);
  assert.equal(first.inventory.uniqueLicenseFiles, 1);
  assert.equal(JSON.stringify(first.inventory).includes(root), false);
  assert.deepEqual(first.inventory.unresolved, []);
  assert.equal(
    first.artifacts
      .get(`licenses/${hash(Buffer.from('Shared license bytes\r\n'))}.txt`)
      .toString(),
    'Shared license bytes\r\n',
  );
  fs.unlinkSync(path.join(root, 'registry/demo/LICENSE'));
  assert.deepEqual(buildNotices(root, resolutions).inventory.unresolved, [
    'cargo:demo@1.0.0',
  ]);
  assert.throws(
    () => buildNotices(root, resolutions.slice(1)),
    /every supported target/,
  );
});

test('upstream supplements require matching revision, license, URL, and stored bytes', (t) => {
  const { root, resolutions } = fixture(t);
  const item = {
    revision: 'a'.repeat(40),
    license: 'MIT',
    files: [
      {
        file: 'upstream/demo.txt',
        upstream: `https://raw.githubusercontent.com/example/demo/${'a'.repeat(40)}/LICENSE`,
        sha256: hash('upstream license'),
      },
    ],
  };
  write(root, 'third-party/upstream/demo.txt', 'upstream license');
  writeJson(root, 'third-party/supplements.json', { 'cargo:demo@1.0.0': item });
  assert.equal(buildNotices(root, resolutions).inventory.uniqueLicenseFiles, 2);
  write(root, 'third-party/upstream/demo.txt', 'changed bytes');
  assert.throws(() => buildNotices(root, resolutions), /hash mismatch/);
  write(root, 'third-party/upstream/demo.txt', 'upstream license');
  item.revision = 'b'.repeat(40);
  writeJson(root, 'third-party/supplements.json', { 'cargo:demo@1.0.0': item });
  assert.throws(
    () => buildNotices(root, resolutions),
    /Stale upstream evidence/,
  );
  item.revision = 'a'.repeat(40);
  item.license = 'Apache-2.0';
  writeJson(root, 'third-party/supplements.json', { 'cargo:demo@1.0.0': item });
  assert.throws(
    () => buildNotices(root, resolutions),
    /Stale upstream evidence/,
  );
  item.license = 'MIT';
  item.files[0].upstream =
    'https://raw.githubusercontent.com/example/demo/main/LICENSE';
  writeJson(root, 'third-party/supplements.json', { 'cargo:demo@1.0.0': item });
  assert.throws(() => buildNotices(root, resolutions), /not pinned/);
});

test('explicit build-emitted helpers are included without bundling their tool dependency graph', (t) => {
  const { root, resolutions } = fixture(t);
  const lock = JSON.parse(
    fs.readFileSync(path.join(root, 'package-lock.json')),
  );
  lock.packages[''].devDependencies = { bundler: '2' };
  lock.packages['node_modules/bundler'] = {
    version: '2.0.0',
    dependencies: { compiler: '1' },
  };
  lock.packages['node_modules/compiler'] = { version: '1.0.0' };
  writeJson(root, 'package-lock.json', lock);
  writeJson(root, 'node_modules/bundler/package.json', {
    name: 'bundler',
    version: '2.0.0',
    license: 'MIT',
  });
  write(root, 'node_modules/bundler/LICENSE', 'Helper license');
  assert.equal(buildNotices(root, resolutions).inventory.packageCount, 2);
  writeJson(root, 'third-party/runtime-helpers.json', [
    { package: 'node_modules/bundler', usage: 'Emitted helper' },
  ]);
  const inventory = buildNotices(root, resolutions).inventory;
  assert.equal(inventory.packageCount, 3);
  assert.equal(
    inventory.packages.find((pkg) => pkg.name === 'bundler').usage,
    'Emitted helper',
  );
  assert.equal(
    inventory.packages.some((pkg) => pkg.name === 'compiler'),
    false,
  );
});

test('stale checks catch changed/missing/extra files and generation preserves unmanaged files', (t) => {
  const root = temp(t);
  const output = path.join(root, 'generated');
  const artifacts = new Map([['NOTICES.md', Buffer.from('expected')]]);
  syncArtifacts(output, artifacts, false);
  syncArtifacts(output, artifacts, true);
  fs.unlinkSync(path.join(output, 'NOTICES.md'));
  assert.throws(
    () => syncArtifacts(output, artifacts, true),
    /Stale third-party/,
  );
  syncArtifacts(output, artifacts, false);
  write(output, 'NOTICES.md', 'changed');
  assert.throws(
    () => syncArtifacts(output, artifacts, true),
    /Stale third-party/,
  );
  syncArtifacts(output, artifacts, false);
  const stale = `licenses/${'a'.repeat(64)}.txt`;
  write(output, stale, 'old');
  assert.throws(
    () => syncArtifacts(output, artifacts, true),
    /Stale third-party/,
  );
  syncArtifacts(output, artifacts, false);
  assert.equal(fs.existsSync(path.join(output, stale)), false);
  write(output, 'human-notes.md', 'preserve this');
  assert.throws(
    () => syncArtifacts(output, artifacts, false),
    /Unmanaged file/,
  );
  assert.equal(
    fs.readFileSync(path.join(output, 'human-notes.md'), 'utf8'),
    'preserve this',
  );
});
