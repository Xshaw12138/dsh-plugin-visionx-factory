# 参数化直线滚筒输送线预览

只用于直线等分输送线的确定性几何，不是所有工厂方案的输入问卷。
首轮仍交付可读方案与三维概念图，坐标/JSON 在用户需要或工程接入时附上。

## 首版输入

| 字段 | 类型 | 规则 |
|---|---|---|
| totalLengthM | 数值 | 大于 0 |
| segmentCount | 整数 | 大于 0；首版每段等长 |
| direction | 枚举 | `+X`、`-X`、`+Z`、`-Z` |
| start | 坐标 | `{x,y,z}`，表示整线首端面的概念坐标 |
| widthM | 数值 | 大于 0 |
| heightM | 数值 | 大于 0 |
| speedMps | 数值 | 大于 0 |
| nameStart | 文本 | 例如 `C01`，后续名称保持数字宽度 |
| unitPrice | 可选数值 | 只能由用户提供或来自已配置公开目录 |
| currency | 可选文本 | 用户给出价格时必填，默认不可猜 |

若用户用毫米输入，统一转换成米并在输出中保留换算证据。

## 几何计算

定义单段长度：

`segmentLengthM = totalLengthM / segmentCount`

方向单位向量：

- `+X → (1,0,0)`
- `-X → (-1,0,0)`
- `+Z → (0,0,1)`
- `-Z → (0,0,-1)`

第 `i` 段（从 0 开始）的概念中心：

`center[i] = start + directionVector × segmentLengthM × (i + 0.5)`

概念旋转角可写成：

- `+X → 0°`
- `-X → 180°`
- `+Z → 90°`
- `-Z → -90°`

这只是方案坐标约定。Connected 模式必须用实时 VisionX 类型与连接器方向核验，
必要时整体修正 yaw，不能把概念角直接当作已验证属性。

## 命名、拓扑与 BOM

- 从 `nameStart` 提取前缀和数字，例如 `C01` → `C01…C04`。
- 数字位数至少保持输入宽度；超过位数时自然扩展。
- BOM 设备数量等于 `segmentCount`。
- 相邻段形成 `segmentCount - 1` 条内部连接。
- 整线有 2 个有意保留的自由端点。
- 未验证实时连接器前，只输出 `C01 ↔ C02` 这类设备级拓扑，不猜 Front/Back
  连接器名称。

## 成本

仅当 `unitPrice` 有可信来源时：

`totalCost = unitPrice × segmentCount`

否则：

- 单价：待定；
- 总成本：待定；
- 用户要求市场参考时遵循 [budget-evidence.md](budget-evidence.md)，以真实可比来源
  给区间；无来源不以行业均价填空。按米和按段报价先统一计价单位。

## planId 与方案文件

仅在用户要求或工程接入时生成 `planId` 与方案 JSON，推荐格式：

`VX-CV-<日期>-<6位大写字母数字>`

同一对话中对未变更参数重复生成时，复用原 `planId`；参数发生变化时生成新版本
或增加修订号。不要声称 planId 已被 Bridge 缓存，除非 MCP 明确返回缓存成功。

方案 JSON 至少包含：

- `schemaVersion`
- `planId`
- `mode`
- `status`
- `input`
- `segments`
- `topology`
- `bom`
- `budget`
- `validation`

可复制 [../assets/conveyor-plan-template.json](../assets/conveyor-plan-template.json)
并替换占位值。PreviewOnly 的 `status` 固定为 `concept_not_simulated`。

## 输出示例

对“从原点沿 +X 设计 8 米、4 段、宽 0.8 米、高 0.75 米、速度 1.2 米/秒，
名称 C01，每段预算 8000 元”的请求，预览应得到：

- 4 段，每段 2.0 m；
- 中心 X 坐标为 1、3、5、7 m，Y/Z 继承起点；
- `C01 ↔ C02 ↔ C03 ↔ C04`；
- 3 条内部连接，2 个自由端点；
- 用户口径总预算 32,000 元；
- 状态为概念方案，尚未仿真验证。

以上数值须驱动真实渲染的三维概念图与俯视图。下方文本只说明关系，不能代替图：

```text
[C01] → [C02] → [C03] → [C04]         当前：参数、坐标、拓扑、BOM
                  ↓ 同一 planId
VisionX：可编辑三维布局 → 连接器吸附 → 流程/负载 → 仿真 → 瓶颈与报告
```

并结合本方案说明：坐标计算只能证明四段理论上首尾相接；VisionX 的价值是把
这些参数放入真实三维设备对象，验证连接方向与净空，再配置负载和流程观察实际
吞吐、阻塞、WIP 与设备利用率。

不要把示例中的参数变成其他请求的默认值。
