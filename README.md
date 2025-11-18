# NEUMOOC 智能助手

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-2.0.0-brightgreen.svg)
![Language](https://img.shields.io/badge/language-JavaScript-yellow.svg)

适用于 NEUMOOC 平台的 Tampermonkey 脚本，用于导出题目信息与批量填充答案。

## ✨ 核心功能
- 一键复制当前页面全部题目，附带标准化 AI prompt + JSON 数据。
- 支持根据 AI 返回的答案 JSON 自动勾选选项，兼容单选、多选题。
- 面板支持缩放、拖动与最小化，操作日志实时反馈。

## 🚀 快速开始
1. **安装 Tampermonkey**：
	 - [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
	 - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
	 - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
2. **获取脚本**：直接在 Tampermonkey 中粘贴 `neumooc-script.user.js` 的源代码，或使用项目仓库提供的 `@downloadURL` 与 `@updateURL`。
3. 打开 NEUMOOC 目标页面，确认右侧浮动面板已加载。

## 📝 导出题目 JSON
1. 点击面板中的「复制题目 JSON」。
2. 脚本会生成包含 prompt + 题目数据的文本并复制到剪贴板。
3. 若浏览器权限限制导致复制失败，JSON 会自动写入输入框，可手动复制。

### Prompt 模板
复制内容的开头会附带如下提示词，方便直接粘贴给 AI：

```
你是严谨的答题助手。
请阅读N题目的 JSON 数据，并返回一个 JSON 数组，每一项包含题目标识及答案。
输出示例:
[
	{
		"index": 1,
		"choices": ["A"]
	}
]
若为多选题，请在 choices 中返回多个选项字母。
不要输出其他解释，仅返回 JSON。
```

## 🤖 填充答案
1. 将 AI 返回的答案 JSON 粘贴到输入框。
2. 点击「根据 JSON 填充答案」。
3. 日志会显示每道题的匹配情况及勾选结果。

### 支持的答案格式

最简格式：

```json
[
	{
		"index": 1,
		"choices": ["A"]
	},
	{
		"index": 2,
		"choices": ["B", "D"]
	}
]
```

字段说明：
- `index` / `questionIndex` / `order`：题目序号（从 1 开始）。
- `number` / `label`：自定义题号文本。
- `id`：题目唯一标识（若页面提供）。
- `choices`：答案选项，可使用字母、原始选项值或部分文本。

脚本会按 `id → index → number → 文本` 顺序匹配题目，并支持多选题多次点击。

## ⚠️ 免责声明

> **在使用本项目前，请务必充分理解以下条款。**
>
> **一旦以任何方式（包括下载、安装、使用、修改、分发）使用本项目，即视为已接受本声明。**

---

1. **项目目的**：本脚本用于技术研究与个人学习，禁止商业或违规用途。
2. **按原样提供**：作者不保证功能的稳定性、准确性或与目标网站的持续兼容性。
3. **使用者责任**：使用者需自行确保符合当地法律、平台协议及学术诚信，因使用导致的后果由使用者承担。
4. **免责条款**：作者不对任何直接或间接损失负责，包括账号封禁、成绩无效、数据丢失等。
5. **风险自负**：使用者应理解并接受使用本软件所带来的一切风险。
6. **最终解释权**：本声明的最终解释权归作者所有。

## 📄 开源协议

本项目采用 **MIT License**，详见仓库中的 `LICENSE` 文件。
