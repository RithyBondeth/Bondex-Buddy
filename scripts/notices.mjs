import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TARGETS = [
  'aarch64-apple-darwin',
  'x86_64-apple-darwin',
  'x86_64-pc-windows-msvc',
];
export const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const legalName = /^(licen[cs]e|copying|copyright|notice|unlicense)([._-]|$)/i;
const inside = (root, file) => {
  const rel = path.relative(root, file);
  return (
    rel === '' ||
    (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel))
  );
};

export function readEvidence(root, relative) {
  const base = fs.realpathSync(root);
  const resolved = fs.realpathSync(path.resolve(base, relative));
  if (!inside(base, resolved))
    throw new Error(`License evidence escapes its package: ${relative}`);
  if (
    !fs.statSync(resolved).isFile() ||
    fs.statSync(resolved).size > 2 * 1024 * 1024
  )
    throw new Error(`Invalid license evidence: ${relative}`);
  return fs.readFileSync(resolved);
}

export function licenseFiles(root, declared) {
  const names = new Set();
  const visit = (directory, depth) => {
    for (const entry of fs.readdirSync(path.join(root, directory), {
      withFileTypes: true,
    })) {
      const relative = path.join(directory, entry.name);
      if (
        entry.isDirectory() &&
        depth < 2 &&
        /^(licenses?|licences?|notices?)$/i.test(entry.name)
      )
        visit(relative, depth + 1);
      else if (
        !entry.isDirectory() &&
        (directory || legalName.test(entry.name))
      )
        names.add(relative);
    }
  };
  visit('', 0);
  if (declared) names.add(declared);
  const files = new Map();
  for (const name of names) {
    const bytes = readEvidence(root, name);
    const relative = path
      .relative(
        fs.realpathSync(root),
        fs.realpathSync(path.resolve(root, name)),
      )
      .split(path.sep)
      .join('/');
    files.set(relative, { name: relative, bytes });
  }
  return [...files.values()].sort((a, b) => compare(a.name, b.name));
}

/** Traverse normal/build edges, rather than including every package Cargo metadata lists. */
export function cargoClosure(metadata) {
  if (!metadata.resolve?.root)
    throw new Error('Cargo dependency resolution is missing');
  const nodes = new Map(metadata.resolve.nodes.map((node) => [node.id, node]));
  const seen = new Set();
  const pending = [metadata.resolve.root];
  while (pending.length) {
    const id = pending.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const node = nodes.get(id);
    if (!node) throw new Error(`Missing Cargo dependency node: ${id}`);
    for (const dependency of node.deps)
      if (
        dependency.dep_kinds.some(
          (kind) => kind.kind === null || kind.kind === 'build',
        )
      )
        pending.push(dependency.pkg);
  }
  return metadata.packages.filter((pkg) => seen.has(pkg.id) && pkg.source);
}

/** Follow runtime and peer dependencies through npm's nested/hoisted package-lock paths. */
export function npmClosure(lock) {
  const result = [];
  const seen = new Set();
  const pending = [''];
  while (pending.length) {
    const key = pending.pop();
    if (seen.has(key)) continue;
    seen.add(key);
    const pkg = lock.packages[key];
    if (!pkg) throw new Error(`Missing npm lock entry: ${key}`);
    if (key) result.push({ key, ...pkg });
    const names = Object.keys({
      ...pkg.dependencies,
      ...pkg.optionalDependencies,
      ...pkg.peerDependencies,
    }).sort(compare);
    for (const name of names) {
      if (
        !/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name) ||
        name.split('/').some((part) => part === '.' || part === '..')
      )
        throw new Error(`Invalid npm package name: ${name}`);
      let parent = key;
      let resolved;
      while (true) {
        const candidate = `${parent ? `${parent}/` : ''}node_modules/${name}`;
        if (lock.packages[candidate]) {
          resolved = candidate;
          break;
        }
        if (!parent) break;
        parent = path.posix.dirname(parent);
        if (parent === '.') parent = '';
      }
      if (!resolved) throw new Error(`Unresolved runtime dependency: ${name}`);
      pending.push(resolved);
    }
  }
  return result.sort((a, b) => compare(a.key, b.key));
}

const cell = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', '&#124;')
    .replaceAll('`', '&#96;')
    .replaceAll('\n', ' ');
const serialized = (value) =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

export function buildNotices(root, resolutions) {
  if (
    resolutions.length !== TARGETS.length ||
    [...new Set(resolutions.map((r) => r.target))].sort(compare).join(',') !==
      [...TARGETS].sort(compare).join(',')
  )
    throw new Error('Resolve every supported target exactly once');
  const artifacts = new Map();
  const packages = new Map();
  const supplements = json(path.join(root, 'third-party/supplements.json'));
  const usedSupplements = new Set();
  const attach = (pkg, evidence) => {
    pkg.files = evidence.map(({ name, bytes, upstream }) => {
      const sha256 = hash(bytes);
      const file = `licenses/${sha256}.txt`;
      artifacts.set(file, bytes);
      return { name, file, sha256, ...(upstream ? { upstream } : {}) };
    });
    pkg.issues = [];
    if (!pkg.license)
      pkg.issues.push(
        'License expression missing; inspect the source package.',
      );
    if (!pkg.files.length)
      pkg.issues.push(
        'No standalone license text collected; inspect source headers and upstream licensing.',
      );
  };
  for (const { target, metadata } of resolutions) {
    for (const dependency of cargoClosure(metadata)) {
      const id = `cargo:${dependency.name}@${dependency.version}`;
      const existing = packages.get(id);
      if (existing) {
        if (existing.source !== dependency.source)
          throw new Error(`Conflicting package sources: ${id}`);
        existing.targets.push(target);
        continue;
      }
      const directory = path.dirname(dependency.manifest_path);
      const vcsFile = path.join(directory, '.cargo_vcs_info.json');
      const vcs = fs.existsSync(vcsFile)
        ? JSON.parse(readEvidence(directory, '.cargo_vcs_info.json'))
        : null;
      const pkg = {
        id,
        ecosystem: 'cargo',
        name: dependency.name,
        version: dependency.version,
        license: dependency.license,
        source: dependency.source,
        repository: dependency.repository,
        revision: vcs?.git?.sha1 ?? null,
        targets: [target],
      };
      const evidence = licenseFiles(directory, dependency.license_file);
      const supplement = supplements[id];
      if (supplement) {
        if (
          supplement.revision !== pkg.revision ||
          supplement.license !== pkg.license
        )
          throw new Error(`Stale upstream evidence: ${id}`);
        usedSupplements.add(id);
        for (const source of supplement.files) {
          if (
            path.isAbsolute(source.file) ||
            source.file.includes('\\') ||
            source.file.split('/').some((part) => part === '..')
          )
            throw new Error(
              `Upstream evidence must use a relative package path: ${id}`,
            );
          const url = new URL(source.upstream);
          const repository = pkg.repository
            ?.replace(/^git\+/, '')
            .replace(/\.git$/, '')
            .replace(/\/$/, '');
          const expected = `${new URL(repository).pathname}/${pkg.revision}/`;
          if (
            url.protocol !== 'https:' ||
            url.hostname !== 'raw.githubusercontent.com' ||
            !url.pathname.startsWith(expected)
          )
            throw new Error(
              `Upstream evidence is not pinned to the package revision: ${id}`,
            );
          const bytes = readEvidence(
            path.join(root, 'third-party'),
            source.file,
          );
          if (hash(bytes) !== source.sha256)
            throw new Error(`Upstream evidence hash mismatch: ${id}`);
          evidence.push({
            name: source.file,
            bytes,
            upstream: source.upstream,
          });
        }
      }
      attach(pkg, evidence);
      packages.set(id, pkg);
    }
  }
  for (const id of Object.keys(supplements))
    if (!usedSupplements.has(id))
      throw new Error(`Unused upstream evidence: ${id}`);
  const lock = json(path.join(root, 'package-lock.json'));
  const selectedNpm = new Map(
    npmClosure(lock).map((dependency) => [
      dependency.key,
      { ...dependency, usage: 'Runtime dependency' },
    ]),
  );
  for (const helper of json(
    path.join(root, 'third-party/runtime-helpers.json'),
  )) {
    if (
      !helper.package.startsWith('node_modules/') ||
      helper.package.includes('\\') ||
      helper.package.split('/').some((part) => part === '..') ||
      !lock.packages[helper.package]
    )
      throw new Error(`Invalid runtime helper package: ${helper.package}`);
    if (!selectedNpm.has(helper.package))
      selectedNpm.set(helper.package, {
        key: helper.package,
        ...lock.packages[helper.package],
        usage: helper.usage,
      });
  }
  for (const dependency of [...selectedNpm.values()].sort((a, b) =>
    compare(a.key, b.key),
  )) {
    const directory = path.join(root, dependency.key);
    const installed = JSON.parse(readEvidence(directory, 'package.json'));
    if (installed.version !== dependency.version)
      throw new Error(
        `Installed npm version differs from lockfile: ${dependency.key}`,
      );
    const id = `npm:${installed.name}@${installed.version}`;
    const pkg = {
      id,
      ecosystem: 'npm',
      name: installed.name,
      version: installed.version,
      usage: dependency.usage,
      license: typeof installed.license === 'string' ? installed.license : null,
      source: dependency.resolved ?? null,
      repository:
        typeof installed.repository === 'string'
          ? installed.repository
          : (installed.repository?.url ?? null),
      targets: TARGETS,
    };
    attach(pkg, licenseFiles(directory));
    packages.set(id, pkg);
  }
  const entries = [...packages.values()].sort((a, b) => compare(a.id, b.id));
  for (const pkg of entries)
    pkg.targets = [...new Set(pkg.targets)].sort(compare);
  const locks = Object.fromEntries(
    ['package-lock.json', 'src-tauri/Cargo.lock'].map((name) => [
      name,
      hash(
        fs.readFileSync(path.join(root, name), 'utf8').replaceAll('\r\n', '\n'),
      ),
    ]),
  );
  const inventory = {
    schemaVersion: 1,
    scope:
      'npm runtime closure plus explicitly identified build-emitted runtime helpers, and Cargo normal/build dependency closure; Rust build-time packages are included; development-only npm tools are excluded',
    targets: TARGETS,
    locks,
    packageCount: entries.length,
    uniqueLicenseFiles: artifacts.size,
    unresolved: entries.filter((pkg) => pkg.issues.length).map((pkg) => pkg.id),
    packages: entries,
  };
  const rows = entries.map(
    (pkg) =>
      `| ${cell(pkg.id)} | ${cell(pkg.license || 'UNSPECIFIED')} | ${pkg.files.map((file, i) => `[text ${i + 1}](${file.file})`).join(', ') || '**Review required**'} |`,
  );
  const markdown = [
    '# Third-party notices',
    '',
    'Generated by `npm run notices:generate`. Full copied license/notice texts are linked below; provenance and SHA-256 hashes are in `inventory.json`.',
    '',
    inventory.scope + '.',
    '',
    `${entries.length} packages; ${inventory.uniqueLicenseFiles} distinct text files; ${inventory.unresolved.length} packages require further license-evidence review.`,
    '',
    'Project artwork/audio provenance is in `ASSET_NOTICES.md`. No project license has been selected.',
    '',
    '## Evidence still requiring review',
    '',
    ...inventory.unresolved.map((id) => `- ${cell(id)}`),
    '',
    '## Dependency texts',
    '',
    '| Package | Declared license | Copied texts |',
    '| --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
  artifacts.set('inventory.json', serialized(inventory));
  artifacts.set('NOTICES.md', Buffer.from(markdown));
  artifacts.set(
    'ASSET_NOTICES.md',
    fs.readFileSync(path.join(root, 'assets/NOTICE.md')),
  );
  return { artifacts, inventory };
}

/** Only the generator-owned files are writable; unexpected files/symlinks are preserved. */
export function syncArtifacts(directory, artifacts, check) {
  const existing = [];
  const walk = (relative = '') => {
    const current = path.join(directory, relative);
    if (!fs.existsSync(current)) return;
    if (fs.lstatSync(current).isSymbolicLink())
      throw new Error('Generated notices cannot contain symlinks');
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const name = relative ? `${relative}/${item.name}` : item.name;
      if (item.isSymbolicLink())
        throw new Error('Generated notices cannot contain symlinks');
      if (item.isDirectory() && name === 'licenses') walk(name);
      else if (
        item.isFile() &&
        (/^licenses\/[a-f0-9]{64}\.txt$/.test(name) ||
          ['inventory.json', 'NOTICES.md', 'ASSET_NOTICES.md'].includes(name))
      )
        existing.push(name);
      else throw new Error(`Unmanaged file in generated notices: ${name}`);
    }
  };
  walk();
  const differences = existing.filter((name) => !artifacts.has(name));
  for (const [name, bytes] of artifacts) {
    if (
      !/^(licenses\/[a-f0-9]{64}\.txt|inventory\.json|NOTICES\.md|ASSET_NOTICES\.md)$/.test(
        name,
      )
    )
      throw new Error(`Invalid generated path: ${name}`);
    const file = path.join(directory, name);
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(bytes))
      differences.push(name);
  }
  if (check && differences.length)
    throw new Error(
      `Stale third-party notices (${differences.length} files). Run npm run notices:generate.`,
    );
  if (!check) {
    fs.mkdirSync(path.join(directory, 'licenses'), { recursive: true });
    for (const [name, bytes] of artifacts)
      fs.writeFileSync(path.join(directory, name), bytes);
    for (const name of existing)
      if (!artifacts.has(name)) fs.unlinkSync(path.join(directory, name));
  }
}

function main() {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => !['--check', '--require-texts', '--stage'].includes(arg))
  )
    throw new Error('Unknown notices option');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const resolutions = TARGETS.map((target) => {
    const result = spawnSync(
      'cargo',
      [
        'metadata',
        '--locked',
        '--manifest-path',
        'src-tauri/Cargo.toml',
        '--format-version',
        '1',
        '--filter-platform',
        target,
      ],
      { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    if (result.error || result.status !== 0)
      throw new Error(result.error?.message ?? result.stderr);
    return { target, metadata: JSON.parse(result.stdout) };
  });
  const { artifacts, inventory } = buildNotices(root, resolutions);
  const directory = path.join(root, 'third-party/generated');
  syncArtifacts(
    directory,
    artifacts,
    args.includes('--check') || args.includes('--stage'),
  );
  if (args.includes('--require-texts') && inventory.unresolved.length)
    throw new Error(
      `License evidence still needs review: ${inventory.unresolved.join(', ')}`,
    );
  if (args.includes('--stage')) {
    const bundle = path.join(root, 'src-tauri/target/release/bundle');
    if (!fs.existsSync(bundle))
      throw new Error('Build the release bundle before staging notices');
    const staged = path.join(bundle, 'third-party');
    syncArtifacts(staged, artifacts, false);
  }
  process.stdout.write(
    `${inventory.packageCount} packages; ${inventory.uniqueLicenseFiles} distinct license texts; ${inventory.unresolved.length} unresolved license-evidence reviews.\n`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
