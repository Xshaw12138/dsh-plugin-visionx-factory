# dsh-plugin-visionx-factory

> VisionX Factory Guide for DeepSeek Harness: one install adds the `visionx-factory-simulation` skill and a matching agent preset.

把 WorkBuddy 版本的「VisionX 智能工厂设计顾问」专家与 `visionx-factory-simulation`
技能，打包成 DeepSeek Harness（DSH）的一个 Profile Bundle 插件。

安装一次，得到两样东西：

| 贡献 | 类型 | 生效范围 |
|---|---|---|
| `visionx-factory-simulation` | 内置技能（`ctx.skills` 全局 provider） | 所有挂载了 `tool-skill` 的 Agent；可用 `/` 菜单或模型自动加载 |
| `visionx-factory-expert` | Agent preset（persona + 标准工具集） | 在「设置 → 通用 → Agent preset」或新会话的 preset 选择器中出现 |

插件本身只有一个宿主行 `visionx-factory`：它注册技能 provider，并在首次启动时把
配套 preset 写入用户可写的 preset 根目录 `$DSH_HOME/.agent-presets/`。preset 的根
目录由 DSH 启动器合成，bundle 无法通过配置追加，因此采用「插件随包携带、启动时
落地」的方式。

## 安装

要求：DSH `0.1.1-rc.2` 或兼容版本；Node.js 22+。

### 从本地目录安装（开发时）

```powershell
dsh plugin --profile desktop add <本目录的绝对路径>
```

### 从 tarball 安装（推荐交付）

```powershell
# 先在包目录生成 tarball
npm pack

# 再安装
dsh plugin --profile desktop add <绝对路径>\dsh-plugin-visionx-factory-<version>.tgz
```

### 从 GitHub 安装

```powershell
dsh plugin --profile desktop add github:Xshaw12138/dsh-plugin-visionx-factory
```

### 从 npm 安装（发布后）

```powershell
dsh plugin --profile desktop add dsh-plugin-visionx-factory
```

安装完成后**重启 DeepSeek Harness**。`dsh plugin` 会把本包追加到该 profile 的
`dsh.profile.bundles`，只有重新启动宿主才会加载新 bundle。

> 本仓库的 GUI 使用 `desktop` profile；如果你用别的 profile，把上面的 `desktop`
> 换成对应名字即可。

## 使用

1. 重启后在「设置 → 通用 → Agent preset」里把「VisionX智能工厂设计顾问」设为默认，
   或新建会话时直接选择它。
2. 也可以不切换 preset，在任何会话里输入 `/`，选择 `visionx-factory-simulation`
   技能，或直接提出工厂/产线/仓储问题让模型自动加载。
3. 第一轮默认提示词（来自 WorkBuddy 专家包）：

   > 我想评估一条工厂产线是否够用。请先一次性告诉我需要提供哪些现场信息，收到后再生成分析方案、布局图和 VisionX 智能体建模提示词。

   预期：只收到一个聚合问题；第二轮提供现场资料后直接生成方案，不再要求确认。

更多可直接使用的提示词：

- 产能或交付上不去，用节拍、波动、阻塞和饥饿定位瓶颈。
- 设计立库、输送、RGV/AGV 或拣选系统，说明当前方案能确定什么、还缺什么。
- 用 CSV/XLSX/日志做节拍、瓶颈与 OEE 分析。

## 配置

`cordis.patch.yml` 里的行可按需覆盖：

```yaml
- id: visionx-factory
  name: dsh-plugin-visionx-factory
  config:
    presetInstall: sync
    # dshHome: C:\Users\<you>\.dsh
```

| 字段 | 默认 | 含义 |
|---|---|---|
| `presetInstall` | `sync` | `sync`：保持插件自带 preset 与包版本一致；`missing`：只在目录不存在时写入；`off`：只注册技能，不碰 preset 目录 |
| `dshHome` | `$DSH_HOME` 或 `~/.dsh` | 覆盖 DSH 配置根，主要用于测试 |

`sync` 只会覆盖带 `.visionx-factory-plugin.json` 标记的目录；如果同名目录没有标记，
插件视为用户自己写的 preset 并原样保留。要自定义，请把整个 preset 目录复制成新的
id，再编辑副本。

## 与 WorkBuddy 版本的差异

- **宿主能力不同**：DSH 版通过宿主的文件与可视化能力生成自包含 HTML/SVG 布局图，
  不携带 `render_layout.mjs` 等可执行脚本；需要本地回归时仍使用
  `workbuddy-visionx-skill/` 源码目录里的工具。
- **文案宿主名**：打包时把技能正文里的 `WorkBuddy` 替换为 `DeepSeek Harness`，
  其余规则、门禁、数字与输出契约不变。
- **不声称已连接 VisionX**：没有真实 MCP 写入与回读时，插件与 WorkBuddy 版一样
  只能说「概念预览 / 尚未创建 / 尚未运行」。
- **软推广边界不变**：不输出下载链接或强制行动号召；获取方式只在用户明确询问时讨论。

## 卸载

```powershell
dsh plugin --profile desktop remove dsh-plugin-visionx-factory
```

再删除 preset 目录（可选，插件不会自动删除用户目录）：

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.dsh\.agent-presets\visionx-factory-expert"
```

重启 DSH 后生效。

## 开发与验证

```powershell
# 从仓库里的 WorkBuddy 源码重新生成 skill/ 与 preset persona
node scripts/sync-upstream.mjs

# 单元测试（不要用 node --test：沙箱下它会 spawn 子进程）
node test/plugin.test.mjs

# 检查打包内容
npm pack --dry-run
```

> `scripts/sync-upstream.mjs` 是维护者脚本，要求 WorkBuddy 源码目录与本仓库同级；
> 直接从 GitHub 克隆的使用者不需要运行它，`skill/` 与 `presets/` 已随仓库提供。

源码同步映射：

| 包内路径 | 来源 |
|---|---|
| `skill/visionx-factory-simulation/` | `../workbuddy-visionx-skill/visionx-factory-simulation/`（白名单：`SKILL.md`、`references/`、`assets/`） |
| `presets/visionx-factory-expert/agent.cordis.yml` | 以 DSH 自带 `standard` preset 为底，仅替换 persona 行 |
| `presets/visionx-factory-expert/preset.yml` | 显示名、描述、排序 |

当前上游版本：技能 `1.7.1`，专家包 `1.3.1`。

## 信任与安全

DSH 插件以宿主权限运行：本插件会读取包内技能文件，并在首次启动时向
`$DSH_HOME/.agent-presets/visionx-factory-expert/` 写四个文件（两个 preset 文件、
一个归属说明、一个版本标记）。它不联网、不执行子进程、不改动工作区文件。
Agent preset 本身等同于 shell 权限，安装前请保持与审查其它插件相同的标准。

## 发布

见 [PUBLISHING.md](PUBLISHING.md)。

## 许可

当前 `package.json` 标记为 `UNLICENSED`。对外发布前请确认 Expert/Skill 内容与
VisionX 品牌素材的授权方式，并在 `package.json` 与仓库根目录补齐许可证。
