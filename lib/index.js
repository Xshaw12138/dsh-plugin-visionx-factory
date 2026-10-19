/**
 * dsh-plugin-visionx-factory
 *
 * A DeepSeek Harness profile bundle with two contributions:
 *
 * 1. A bundled skill provider for `visionx-factory-simulation`, registered on
 *    the host `ctx.skills` layer so every agent of a preset that mounts
 *    `tool-skill` can discover and load it.
 * 2. A one-time provisioning step that installs the matching
 *    `visionx-factory-expert` agent preset into the user-owned preset root
 *    (`$DSH_HOME/.agent-presets`), because the preset roster's roots are an
 *    assembly fact of the launcher rather than a bundle-configurable list.
 *
 * The provider follows the same shape as `@deepseek-ai/dsh-skill-badge`:
 * metadata is computed once at load, while the body is re-read on every get()
 * so editing SKILL.md on disk is reflected on the next skill load.
 *
 * @module dsh-plugin-visionx-factory
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Cordis plugin name. */
export const name = 'visionx-factory';

/** The host skill registry must exist before this row activates. */
export const inject = ['skills'];

const PACKAGE_URL = new URL('../package.json', import.meta.url);
const SKILL_DIR = fileURLToPath(new URL('../skill/visionx-factory-simulation/', import.meta.url));
const SKILL_FILE = join(SKILL_DIR, 'SKILL.md');
const PRESET_ID = 'visionx-factory-expert';
const PRESET_SOURCE = fileURLToPath(new URL('../presets/visionx-factory-expert/', import.meta.url));
const PROVIDER_NAME = 'visionx-factory';
const MARKER_FILE = '.visionx-factory-plugin.json';

/** `BUNDLED_SKILL_RANK` from @deepseek-ai/dsh-skill: packaged providers outrank user roots. */
const BUNDLED_SKILL_RANK = 600;

const FALLBACK_DESCRIPTION =
  'Use when planning a factory, production line or warehouse layout, or assessing manufacturing capacity, material flow and bottlenecks. 适用于工厂仿真、产线规划、仓储物流、立库/RGV/AGV/输送线设计，或产能节拍、瓶颈与 OEE 分析。';

const PACKAGE = JSON.parse(readFileSync(PACKAGE_URL, 'utf8'));

/**
 * Split a Markdown file with optional YAML frontmatter.
 * Only the simple single-line keys this plugin needs are read; the body is
 * returned verbatim so skill assets and relative links keep working.
 * @param {string} raw - file contents.
 * @returns {{ meta: Record<string, string>, body: string }} parsed pieces.
 */
function parseSkillMarkdown(raw) {
  const meta = {};
  let body = raw;
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (match !== null) {
    for (const line of match[1].split(/\r?\n/)) {
      const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      if (pair === null) continue;
      let value = pair[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      meta[pair[1]] = value;
    }
    body = raw.slice(match[0].length);
  }
  return { meta, body };
}

const SKILL_TEXT = readFileSync(SKILL_FILE, 'utf8');
const SKILL_META = parseSkillMarkdown(SKILL_TEXT).meta;

/** Stable candidate metadata; the body is loaded lazily by `get()`. */
const CANDIDATE = {
  name: SKILL_META.name ?? 'visionx-factory-simulation',
  description: SKILL_META.description ?? FALLBACK_DESCRIPTION,
  ...(SKILL_META.whenToUse === undefined ? {} : { whenToUse: SKILL_META.whenToUse }),
  invocation: { modelInvocable: true, userInvocable: true },
  provider: PROVIDER_NAME,
  source: 'bundled',
  resourceBase: { kind: 'directory', path: SKILL_DIR },
  rank: BUNDLED_SKILL_RANK,
  locator: SKILL_FILE,
  path: SKILL_FILE,
  ...(Object.keys(SKILL_META).length === 0 ? {} : { metadata: SKILL_META }),
};

/** One immutable bundled provider; fiber disposal unregisters it. */
const provider = {
  name: PROVIDER_NAME,
  list: () => Promise.resolve([CANDIDATE]),
  async get() {
    const { meta, body } = parseSkillMarkdown(readFileSync(SKILL_FILE, 'utf8'));
    return {
      name: CANDIDATE.name,
      description: meta.description ?? CANDIDATE.description,
      ...(meta.whenToUse === undefined ? {} : { whenToUse: meta.whenToUse }),
      invocation: CANDIDATE.invocation,
      provider: CANDIDATE.provider,
      source: CANDIDATE.source,
      resourceBase: CANDIDATE.resourceBase,
      content: body,
      path: SKILL_FILE,
      metadata: meta,
    };
  },
};

/**
 * Copy a preset directory without depending on `fs.cpSync`'s
 * destination-exists semantics. Only regular files one level deep are
 * expected; the recursive branch keeps the helper honest for assets.
 * @param {string} source - directory to read.
 * @param {string} target - directory to create or fill.
 */
function copyDirectory(source, target) {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isDirectory()) copyDirectory(from, to);
    else if (entry.isFile()) copyFileSync(from, to);
  }
}

/**
 * Provision the agent preset under the user-owned preset root.
 *
 * The DSH launcher composes `agent-presets.roots` itself (the shipped root is
 * an assembly fact), so a bundle cannot add a preset root through config. The
 * user root `$DSH_HOME/.agent-presets` is scanned by default, which is where
 * this function writes.
 *
 * Modes:
 * - `sync` (default): refresh a plugin-owned copy and leave a user-authored
 *   directory (no marker) untouched.
 * - `missing`: write only when the directory does not exist yet.
 * - `off`: do nothing.
 *
 * @param {object} ctx - Cordis context (logger used for diagnostics).
 * @param {Record<string, unknown>} config - plugin config.
 */
function installPreset(ctx, config) {
  const requested = config.presetInstall;
  const mode = requested === undefined ? 'sync' : requested;
  if (mode !== 'sync' && mode !== 'missing' && mode !== 'off') {
    ctx.logger?.warn?.(`visionx-factory: unknown presetInstall ${JSON.stringify(mode)}; expected sync, missing, or off. Using sync.`);
    return installPreset(ctx, { ...config, presetInstall: 'sync' });
  }
  if (mode === 'off') {
    ctx.logger?.info?.('visionx-factory: presetInstall=off; skill only, preset root untouched.');
    return;
  }

  const dshHome = typeof config.dshHome === 'string' && config.dshHome.length > 0
    ? config.dshHome
    : process.env.DSH_HOME ?? join(homedir(), '.dsh');
  const target = join(dshHome, '.agent-presets', PRESET_ID);
  const markerPath = join(target, MARKER_FILE);
  const exists = existsSync(target);

  if (exists && mode === 'missing') {
    ctx.logger?.info?.(`visionx-factory: preset already present at ${target}; presetInstall=missing leaves it alone.`);
    return;
  }
  if (exists && !existsSync(markerPath)) {
    ctx.logger?.warn?.(`visionx-factory: ${target} exists without a plugin marker; treating it as user-authored and leaving it untouched. Delete it to let the plugin provision its bundled copy.`);
    return;
  }

  copyDirectory(PRESET_SOURCE, target);
  writeFileSync(
    markerPath,
    `${JSON.stringify(
      {
        plugin: PACKAGE.name,
        version: PACKAGE.version,
        upstreamSkillVersion: SKILL_META.version ?? null,
        installedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  writeFileSync(
    join(target, 'PLUGIN-OWNED.md'),
    `# 此 preset 由 ${PACKAGE.name} 管理\n\n` +
      '本目录会在下次启动时被插件的打包版本覆盖。要保留自己的修改，请复制整个目录为新的 preset id，\n' +
      '再在副本里编辑；不要把改动直接写在这里。\n\n' +
      '卸载插件后如需一并删除：删除本目录即可。\n',
    'utf8',
  );
  ctx.logger?.info?.(`visionx-factory: installed agent preset ${PRESET_ID} at ${target}.`);
}

/**
 * Register the bundled skill and provision the matching preset.
 * @param {object} ctx - Cordis host context.
 * @param {Record<string, unknown>} [config] - row config from cordis.patch.yml.
 */
export function apply(ctx, config = {}) {
  ctx.skills.registerProvider(() => provider);
  ctx.logger?.info?.(`visionx-factory: registered bundled skill ${CANDIDATE.name} (${SKILL_META.version ?? 'unversioned'}).`);
  try {
    installPreset(ctx, config);
  } catch (error) {
    ctx.logger?.warn?.(`visionx-factory: could not provision the ${PRESET_ID} preset: ${error instanceof Error ? error.message : String(error)}`);
  }
}
