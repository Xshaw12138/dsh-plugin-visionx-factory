# 发布说明

本包已经可以本地安装和运行；下面是把同一个包发布到 npm 或其它渠道的步骤。

## 1. 发布前检查清单

- [ ] `package.json` 的 `license` 已确定（当前 `UNLICENSED`，公开 npm 发布前通常改为
      `MIT` 或在仓库根目录放 `LICENSE` 并改成 `SEE LICENSE IN LICENSE`）。
- [ ] `version` 已递增（当前 `0.1.1`）。
- [ ] `node scripts/sync-upstream.mjs` 已运行，且 `skill/` 与 `presets/` 没有未提交的漂移。
- [ ] `node test/plugin.test.mjs` 全部通过。
- [ ] `npm pack --dry-run` 的文件列表符合预期：`lib/`、`cordis.patch.yml`、`skill/`、
      `presets/`、`README.md`、`PUBLISHING.md`；不应包含 `scripts/`、`test/`、`.tmp/`。
- [ ] 在干净的 DSH profile 里做一次安装 + `--dump-config` + 无界面启动验证。
- [ ] 在真实 GUI 里重启后确认：插件清单出现、技能可用 `/` 调用、preset 可选择。

## 2. 打包

```powershell
npm pack
# dsh-plugin-visionx-factory-<version>.tgz
```

tarball 可以直接交付给使用者：

```powershell
dsh plugin --profile desktop add <绝对路径>\dsh-plugin-visionx-factory-<version>.tgz
```

## 3. 发布到 npm

需要一个已登录、有权发布 `dsh-plugin-visionx-factory` 这个名字的 npm 账号：

```powershell
npm login
npm whoami
npm publish --access public
```

发布后安装方式：

```powershell
dsh plugin --profile desktop add dsh-plugin-visionx-factory
```

也可以发到 GitHub 后按仓库安装（pnpm 会走 prepare 构建，纯 JS 包无需构建）：

```powershell
dsh plugin --profile desktop add github:<user>/<repo>
```

## 4. 社区目录（可选）

DSH 生态有第三方目录站点（例如 dshbase 的插件目录）与 awesome 列表。提交前请确认
对方要求的字段与审核方式；本包不含遥测、联网或子进程行为，便于审查。

## 5. 安装后的验证矩阵

| 层级 | 命令 | 预期 |
|---|---|---|
| L1 安装 | `dsh plugin --profile <p> add <spec>` | 退出码 0，`package.json` 的 `dsh.profile.bundles` 出现包名 |
| L2 合成 | `dsh --profile <p> --dump-config` | 出现 `- id: visionx-factory` |
| L3 启动 | `dsh --profile <p> "只回复 ok"` | 正常退出；`$DSH_HOME/.agent-presets/visionx-factory-expert/` 已生成 |
| L4 技能 | `dsh --profile <p> "调用 skill 工具加载 visionx-factory-simulation"` | 返回技能正文标题 `# VisionX智能工厂设计顾问` |
| L5 GUI | 重启桌面端 | 设置里能看到插件行；preset 选择器出现「VisionX智能工厂设计顾问」 |

## 6. 版本策略

- 插件版本独立于上游：`package.json.version`。
- 技能版本保留在 `SKILL.md` frontmatter，并写入安装标记
  `.visionx-factory-plugin.json` 的 `upstreamSkillVersion`，方便排查漂移。
- Expert 文案变更只需重跑 `node scripts/sync-upstream.mjs` 并递增插件版本；
  `standard` preset 的工具行变化需要在 `presets/.../agent.cordis.yml` 里重新以
  新版 `standard` 为底生成（删除该文件后重跑同步脚本即可）。
