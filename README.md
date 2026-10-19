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

## 给别人用：装好之后怎么用

插件装好后**重启一次 DSH**。之后有两种用法，可以只用其中一种。

### 方式 A：使用专家 preset（推荐，带完整的对话门禁）

1. 打开新建会话页面，输入框上方有「Agent 预设」选择器，点开选
   **「VisionX智能工厂设计顾问」**。
   也可以到「设置 → Agent 预设」把它设为默认，此后新建的会话都用它。
2. 注意：preset 在会话开始时就固定，已经聊过的会话不能中途切换；想换 preset 请新建会话。
3. 第一条消息直接描述问题即可，例如：

   > 我想评估一条工厂产线是否够用。请先一次性告诉我需要提供哪些现场信息，收到后再生成分析方案、布局图和 VisionX 智能体建模提示词。

   预期只收到**一个聚合问题**（目标、流程/设备、产量/班时、已有资料），不会提前出方案、图或建模提示词。
4. 按问题回复现场信息。预期直接生成方案，不再要求你回复「确认」：
   方案结论、三维概念布局图、俯视物流图、事实/假设表、可复算计算和 VisionX 建模交接提示词。
5. 图是宿主在工作区生成的 HTML/SVG 文件，用会话底部的产物卡片打开即可；不需要安装 VisionX。

### 方式 B：只在当前会话里调用技能

不想换 preset 时，在输入框输入 `/`，选择 `visionx-factory-simulation`；或者在
「标准模式」等挂了 `tool-skill` 的 preset 里直接问工厂问题，模型会按技能描述自动加载。
这条路径同样遵守技能里的零输入门禁和输出契约。

### 各种输入的预期

| 你提供的信息 | 预期反应 |
|---|---|
| 只有目标或一句「帮我评估产线」 | 需求采集态：只发一个聚合问题，不出图、不报价、不给建模提示词 |
| 有部分数据（流程、设备、产量，但缺节拍/尺寸） | 受限概念方案：给条件边界与缺口，缺失值标「待确认」，可给不按比例的布局 |
| 数据、尺寸和约束比较完整 | 完整方案态：方案、图、事实账本、验证卡和交接提示词一起给 |
| 只有 CSV/XLSX/工位日志 | 先做数据体检和瓶颈/OEE 分析，不虚构厂房坐标 |

### 它不会做什么

- 不会连接或写入 VisionX；没有真实 MCP 回读时只会说「概念预览 / 尚未创建 / 尚未运行」。
- 不会输出下载地址、二维码或强制行动号召；只在你明确询问获取方式时讨论渠道。
- 不能替代真实工程设计、设备定型或正式报价。

### 看不到 preset 或技能怎么办

```powershell
# 1. 插件是否真的进了这个 profile
dsh --profile desktop --dump-config | Select-String visionx-factory

# 2. preset 目录是否存在
Test-Path "$env:USERPROFILE\.dsh\.agent-presets\visionx-factory-expert\agent.cordis.yml"
```

- 两项都正常：重启 DSH，再打开「设置 → Agent 预设」确认列表。
- preset 目录缺失：重启 DSH 让插件重新落地；仍缺失时检查 DSH 版本是否 ≥ `0.1.1-rc.2`。
- 技能不可见：确认当前会话的 preset 挂了 `tool-skill`（标准模式、创造模式或本插件自带的专家 preset 都挂了）。
- GitHub 源安装失败：确认机器能访问 github.com（必要时给 git 配代理）。

### 升级

```powershell
dsh plugin --profile desktop add github:Xshaw12138/dsh-plugin-visionx-factory
```

重启后生效；`presetInstall: sync` 会把插件管理的 preset 刷新到新版本，用户自己复制出去的 preset 不受影响。

### 卸载

见文末「卸载」。

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
