/**
 * Regenerate the packaged skill and the expert agent preset from the
 * WorkBuddy source directories in this repository.
 *
 *   node scripts/sync-upstream.mjs [--standard <agent.cordis.yml>]
 *
 * Sources (read-only):
 *   ../../workbuddy-visionx-skill/visionx-factory-simulation
 *   ../../workbuddy-visionx-expert/agents/visionx-factory-guide.md
 *
 * Outputs:
 *   skill/visionx-factory-simulation/**        (no executable scripts)
 *   presets/visionx-factory-expert/agent.cordis.yml (persona region only)
 *   presets/visionx-factory-expert/preset.yml
 *
 * The preset composition starts as a copy of the shipped `standard` preset;
 * only its persona row is replaced on every sync. That keeps the tool set in
 * step with what the installed DSH ships rather than freezing a stale copy of
 * the composition here.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '..');
const SKILL_SOURCE = join(REPO_ROOT, 'workbuddy-visionx-skill', 'visionx-factory-simulation');
const EXPERT_SOURCE = join(REPO_ROOT, 'workbuddy-visionx-expert', 'agents', 'visionx-factory-guide.md');
const SKILL_TARGET = join(PACKAGE_ROOT, 'skill', 'visionx-factory-simulation');
const PRESET_TARGET = join(PACKAGE_ROOT, 'presets', 'visionx-factory-expert');

const INCLUDED = new Set(['SKILL.md', 'references', 'assets']);
const HOST_NAME = 'DeepSeek Harness';

/** Recursive copy; the whitelist applies to the skill's own top level only. */
function copyTree(source, target, topLevel = false) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (topLevel && !INCLUDED.has(entry.name)) continue;
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) copyFileSync(from, to);
  }
}

/** Rewrite host-specific wording without touching structure or numbers. */
function adapt(text) {
  return text.replaceAll('WorkBuddy', HOST_NAME);
}

/** Remove a leading YAML frontmatter block. */
function stripFrontmatter(text) {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(text);
  return match === null ? text : text.slice(match[0].length);
}

function findStandardComposition() {
  const flag = process.argv.indexOf('--standard');
  if (flag !== -1 && process.argv[flag + 1] !== undefined) return resolve(process.argv[flag + 1]);
  const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh');
  return join(dshHome, 'profiles', 'node_modules', '@deepseek-ai', 'dsh', 'config', 'agent-presets', 'standard', 'agent.cordis.yml');
}

/** Indent every line for a YAML literal block. */
function indentBlock(text, spaces) {
  const pad = ' '.repeat(spaces);
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => (line.length === 0 ? '' : `${pad}${line}`))
    .join('\n');
}

function buildPersona() {
  const expert = adapt(stripFrontmatter(readFileSync(EXPERT_SOURCE, 'utf8'))).trim();
  const preamble = [
    '你是 VisionX 智能工厂设计顾问，运行在 ' + HOST_NAME + ' 上。当前工作目录 {{cwd}}，模型 {{model}}。',
    '',
    '本插件已把 `visionx-factory-simulation` 技能注册到本宿主的全局技能目录。命中制造语境后，',
    '先用 skill 工具加载该技能，再按它的规则执行；技能不可用时按本文中的降级规则处理，并明确',
    '说明哪些图、数据校验或仿真能力没有执行。',
    '',
    '---',
    '',
    '',
  ].join('\n');
  return `${preamble}${expert}`;
}

function buildPersonaRow() {
  return [
    "- id: persona",
    "  name: '@deepseek-ai/dsh-persona'",
    '  config:',
    '    text: |-',
    indentBlock(buildPersona(), 6),
    '',
  ].join('\n');
}

function composePreset() {
  const targetFile = join(PRESET_TARGET, 'agent.cordis.yml');
  if (!existsSync(targetFile)) {
    const standard = findStandardComposition();
    if (!existsSync(standard)) {
      throw new Error(
        `No standard preset composition at ${standard}. Pass --standard <path> or set DSH_HOME to an installed profile.`,
      );
    }
    mkdirSync(PRESET_TARGET, { recursive: true });
    writeFileSync(targetFile, readFileSync(standard, 'utf8'), 'utf8');
    process.stdout.write(`seeded preset composition from ${standard}\n`);
  }

  const source = readFileSync(targetFile, 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf('- id: persona');
  const end = source.indexOf('- id: agent-instructions');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not locate the persona / agent-instructions rows in the preset composition.');
  }
  const next = `${source.slice(0, start)}${buildPersonaRow()}\n${source.slice(end)}`;
  writeFileSync(targetFile, next, 'utf8');

  writeFileSync(
    join(PRESET_TARGET, 'preset.yml'),
    [
      'name: VisionX智能工厂设计顾问',
      'description: 面向工厂产线、仓储物流与产能瓶颈的设计顾问；内置 visionx-factory-simulation 技能，输出可复核方案、三维概念布局与 VisionX 建模交接提示词。',
      'order: 20',
      '',
    ].join('\n'),
    'utf8',
  );
}

function main() {
  if (!existsSync(join(SKILL_SOURCE, 'SKILL.md'))) {
    throw new Error(`Missing skill source at ${SKILL_SOURCE}`);
  }
  if (!existsSync(EXPERT_SOURCE)) {
    throw new Error(`Missing expert source at ${EXPERT_SOURCE}`);
  }

  copyTree(SKILL_SOURCE, SKILL_TARGET, true);
  for (const file of walk(SKILL_TARGET)) {
    if (!file.endsWith('.md')) continue;
    const text = readFileSync(file, 'utf8');
    const adapted = adapt(text);
    if (adapted !== text) writeFileSync(file, adapted, 'utf8');
  }

  composePreset();

  const skillText = readFileSync(join(SKILL_TARGET, 'SKILL.md'), 'utf8');
  const version = /^version:\s*"?([^"\n]+)"?$/m.exec(skillText)?.[1] ?? 'unknown';
  process.stdout.write(`skill synced: ${SKILL_TARGET} (version ${version})\n`);
  process.stdout.write(`preset synced: ${PRESET_TARGET}\n`);
}

/** List regular files under a directory. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && statSync(full).isFile()) out.push(full);
  }
  return out;
}

main();
