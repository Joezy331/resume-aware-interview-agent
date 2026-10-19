# 面试历史记录 · 数据结构与兼容策略

> 对应实现：`electron-app/index.html`「面试历史记录模块」（`HISTORY_KEY = 'acc_history_v1'`）
> 本文档描述桌面版（Electron）历史记录的真实存储结构，非设计构想。

---

## 1. 存储位置与持久化

| 项 | 说明 |
|---|---|
| 存储介质 | 渲染进程 `localStorage`（Electron 便携版随用户数据目录持久化） |
| 键 | `acc_history_v1`（JSON 数组，按时间倒序，最新在前） |
| 损坏隔离键 | `acc_history_v1_corrupt`（解析失败时转移原内容，便于排查） |
| 关闭应用后 | **数据仍在**（localStorage 持久化） |
| 多账号 / 云端同步 | **不支持**（单用户本机应用，未引入账号系统） |
| 容量上限 | 受浏览器存储配额限制；写入失败（QuotaExceededError）时**明确提示用户**，不静默丢失 |

---

## 2. 单条记录字段（version 1）

```json
{
  "id": "iv_1699999999999",
  "version": 1,
  "createdAt": 1699999999999,
  "job": "AI 产品经理",
  "jobType": "ai",
  "jobTypeName": "AI 工程师",
  "difficulty": 4,
  "difficultyLabel": "字节/腾讯/阿里/美团",
  "status": "completed",
  "totalScore": 76,
  "verdict": "谨慎推荐",
  "scores": { "comm": 80, "biz": 70, "tech": 85, "leader": 60, "strategy": 75, "culture": 72 },
  "interviewerScores": { "hr": [80, 78], "biz": [70, 72], "pro": [85, 88], "lead": [60, 58], "chief": [75] },
  "interviewerAvgs": { "hr": 79, "biz": 71, "pro": 87, "lead": 59, "chief": 75 },
  "conflict": { "has": true, "gap": 28 },
  "answers": [
    {
      "q": "面试问题原文",
      "a": "用户回答原文",
      "score": 80,
      "comment": "面试官评价",
      "dimension": "comm",
      "interviewer": "hr"
    }
  ],
  "questionCount": 6,
  "durationMs": 183000
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | `iv_` + 时间戳，唯一 |
| `version` | number | 结构版本，用于后续迁移 |
| `createdAt` | number | 面试完成时间（毫秒） |
| `job` / `jobType` / `jobTypeName` | string | 目标岗位 / 类型 ID / 类型名 |
| `difficulty` / `difficultyLabel` | number / string | 难度档位（1-5）与标签 |
| `status` | string | `completed`（未完成面试不保存） |
| `totalScore` | number | 加权总分（0-100） |
| `verdict` | string | `推荐` / `谨慎推荐` / `不推荐`（≥75 / ≥60 / 否则） |
| `scores` | object | 6 维得分（comm/biz/tech/leader/strategy/culture） |
| `interviewerScores` | object | 各面试官逐题打分明细 |
| `interviewerAvgs` | object | 各面试官均分 |
| `conflict` | object | `has`（分差>15）+ `gap`（分差） |
| `answers` | array | 每轮问题 / 回答 / 得分 / 评价 / 维度 / 面试官 |
| `questionCount` | number | 题目数（含追问轮次） |
| `durationMs` | number | 面试耗时（毫秒） |

---

## 3. 保存时机与规则

1. **保存时机**：`renderReportV3()` 生成报告后调用 `saveCurrentInterview()`（面试完成才保存）。
2. **防重复**：`interviewState.historySaved` 标记，同一场面试只保存一次。
3. **不覆盖**：新记录 `unshift` 到数组头部，旧记录原样保留。
4. **保存失败**：`persistHistory()` 捕获配额异常 → `alert` 明确提示，不静默丢失。

---

## 4. 兼容策略

| 场景 | 处理 |
|---|---|
| 旧版本无 `acc_history_v1` 键 | 列表显示空状态，引导开始面试 |
| 记录缺少新字段（如旧记录无 `conflict`） | 详情页用默认值 / `--` 兼容展示，不崩溃 |
| 记录 `answers` 为空 | 详情显示「该记录缺少问答明细（旧版本数据兼容展示）」 |
| JSON 解析失败（损坏） | 原内容转移至 `acc_history_v1_corrupt`，主键清空重新开始，console 警告 |
| 加载异常 | 列表区显示「加载失败 + 重试按钮」 |

---

## 5. 删除规则

- 删除前 `confirm()` 二次确认，展示岗位 / 时间 / 总分。
- 仅删除本机该条记录（`filter` 后重写整个数组）。
- 删除失败（如配额）明确提示。

---

## 6. 隐私边界

- 历史记录**仅存本机 localStorage，不上传**任何服务器。
- 记录内容来自用户真实面试过程，**不使用虚构记录冒充真实数据**。
- 评分与录用结论为模型启发式估计，详情页有明确标注。
