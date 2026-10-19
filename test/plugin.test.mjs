/**
 * Unit checks for the bundled skill provider and preset provisioning.
 * Run with `node --test test/plugin.test.mjs` from the package root.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import { apply, inject, name } from '../lib/index.js';

/** Minimal Cordis context: only the surfaces this plugin touches. */
function makeContext(logs = []) {
  const registered = [];
  const log = (level) => (message) => logs.push(`${level}: ${message}`);
  return {
    ctx: {
      skills: {
        registerProvider(create) {
          registered.push(create({ signal: new AbortController().signal, invalidate() {} }));
          return () => {};
        },
      },
      logger: { info: log('info'), warn: log('warn'), error: log('error') },
    },
    registered,
  };
}

const roots = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

test('exports the Cordis contract and requires the skills service', () => {
  assert.equal(name, 'visionx-factory');
  assert.deepEqual(inject, ['skills']);
});

test('registers a bundled provider whose body has no frontmatter', async () => {
  const home = mkdtempSync(join(tmpdir(), 'visionx-plugin-'));
  roots.push(home);
  const logs = [];
  const { ctx, registered } = makeContext(logs);
  apply(ctx, { dshHome: home, presetInstall: 'off' });

  assert.equal(registered.length, 1);
  const [candidate] = await registered[0].list();
  assert.equal(candidate.name, 'visionx-factory-simulation');
  assert.equal(candidate.provider, 'visionx-factory');
  assert.equal(candidate.source, 'bundled');
  assert.equal(candidate.rank, 600);
  assert.equal(candidate.resourceBase.kind, 'directory');
  assert.ok(candidate.description.length > 20);

  const loaded = await registered[0].get(candidate);
  assert.equal(loaded.name, candidate.name);
  assert.match(loaded.content, /# VisionX智能工厂设计顾问/);
  assert.ok(!loaded.content.startsWith('---'), 'frontmatter must be stripped from the model-facing body');
  assert.ok(logs.some((line) => line.includes('registered bundled skill')));
});

test('provisions the agent preset under the user preset root', () => {
  const home = mkdtempSync(join(tmpdir(), 'visionx-preset-'));
  roots.push(home);
  const { ctx } = makeContext();
  apply(ctx, { dshHome: home });

  const preset = join(home, '.agent-presets', 'visionx-factory-expert');
  assert.ok(existsSync(join(preset, 'agent.cordis.yml')));
  assert.ok(existsSync(join(preset, 'preset.yml')));
  assert.ok(existsSync(join(preset, '.visionx-factory-plugin.json')));

  const marker = JSON.parse(readFileSync(join(preset, '.visionx-factory-plugin.json'), 'utf8'));
  assert.equal(marker.plugin, 'dsh-plugin-visionx-factory');

  const composition = readFileSync(join(preset, 'agent.cordis.yml'), 'utf8');
  assert.match(composition, /id: persona/);
  assert.match(composition, /VisionX智能工厂设计顾问/);
  assert.match(composition, /id: tool-skill/);
});

test('does not overwrite a user-authored preset directory', () => {
  const home = mkdtempSync(join(tmpdir(), 'visionx-own-'));
  roots.push(home);
  const preset = join(home, '.agent-presets', 'visionx-factory-expert');
  mkdirSync(preset, { recursive: true });
  writeFileSync(join(preset, 'mine.txt'), 'keep me', 'utf8');

  const logs = [];
  const { ctx } = makeContext(logs);
  apply(ctx, { dshHome: home });

  assert.equal(readFileSync(join(preset, 'mine.txt'), 'utf8'), 'keep me');
  assert.ok(!existsSync(join(preset, '.visionx-factory-plugin.json')));
  assert.ok(logs.some((line) => line.includes('user-authored')));
});

test('presetInstall=missing keeps an existing plugin-owned preset', () => {
  const home = mkdtempSync(join(tmpdir(), 'visionx-missing-'));
  roots.push(home);
  const { ctx } = makeContext();
  apply(ctx, { dshHome: home });
  const preset = join(home, '.agent-presets', 'visionx-factory-expert');
  writeFileSync(join(preset, 'sentinel.txt'), 'v1', 'utf8');

  apply(ctx, { dshHome: home, presetInstall: 'missing' });
  assert.equal(readFileSync(join(preset, 'sentinel.txt'), 'utf8'), 'v1');
});
