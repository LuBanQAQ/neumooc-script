# NEUMOOC 智能答题助手

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.5.1-brightgreen.svg)
![Language](https://img.shields.io/badge/language-JavaScript-yellow.svg)

一个为 NEU MOOC 平台设计的油猴（Tampermonkey）脚本，旨在通过 AI 技术辅助用户进行课程测验，实现自动化答题流程，并提供便捷的交互界面。


## ✨ 主要功能

- **AI 单题解答**：在任意题目页面，一键调用 AI 进行解答。
- **全自动循环答题**：开启后，脚本将自动完成当前测验的所有题目，直至最后一题。
- **可靠的自动停止机制**：通过检查“下一题”按钮状态和答题卡题号双重判断，确保在最后一题后可靠地停止，避免不必要的提交。
- **人性化的交互界面**：
  - **可拖动面板**：按住面板标题栏可随意拖动。
  - **悬浮球最小化**：点击最小化按钮，面板会收缩为一个可爱的“🤖”悬浮球，节省屏幕空间；点击悬浮球即可恢复。
  - **美观的提示**：使用 [SweetAlert2](https://sweetalert2.github.io/) 替代原生弹窗，提供更友好的操作反馈。
- **高度可配置**：支持自定义 AI 的 API Key、Endpoint 和模型。
- **辅助工具**：
  - 一键复制当前题目的题干和所有选项，方便在其他地方搜索。
  - 支持多选题的延迟选择，模拟人工操作，提高稳定性。

## 🚀 安装与设置

### 1. 安装油猴插件

首先，您的浏览器需要安装一个用户脚本管理器。推荐使用 **Tampermonkey**。

- [Chrome 应用商店](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox 附加组件](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- [Edge 附加组件](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### 2. 安装本脚本

**方式一：从 Greasy Fork 安装 (推荐)**
*（当您将项目发布到 Greasy Fork 后，可以将此链接替换成您的发布地址）*

[点击此处从 Greasy Fork 安装](https://greasyfork.org/zh-CN/)

**方式二：手动安装**
1.  打开 Tampermonkey 管理面板。
2.  点击“添加新脚本”选项卡。
3.  将项目中的 `.js` 文件（例如 `NEU_MOOC_Helper.js`）的**全部内容**复制并粘贴到编辑器中。
4.  按下 `Ctrl` + `S` 保存脚本。

### 3. 配置 AI 参数

脚本需要一个遵循 OpenAI API 格式的接口才能工作。

1.  打开任意 NEU MOOC 测验页面，脚本的控制面板会出现在页面右侧。
2.  在 **AI 配置**区域，填入您的：
    - `API Key`
    - `API Endpoint` (可选, 默认为 OpenAI 官方地址)
    - `Model` (可选, 默认为 `gpt-3.5-turbo`)
3.  点击 **保存配置** 按钮。配置成功后会有提示。

## 📖 使用方法

- **AI 解答当前题目**：在任意题目页面，点击此按钮，脚本会获取当前题目并请求 AI 作答。
- **开始全自动 AI 答题**：在测验的第一题或任意题目页面，点击此按钮，脚本会开始自动答题、翻页，直到最后一题后自动停止。再次点击可中途停止。

## ⚠️ 免责声明

- 本项目仅供个人学习和前端技术研究使用，旨在探索浏览器脚本与 AI API 的交互可能性。
- **请严格遵守您所在学校的学术诚信规定。**
- 任何通过滥用此脚本进行作弊、牟利等行为，或导致的任何学术诚信问题、账号风险，**均由使用者本人承担**，与本项目开发者无关。
- 请在合理、合规的前提下使用本脚本。

## 📄 开源协议

本项目采用 **MIT** 开源许可证。详情请见仓库中的 `LICENSE` 文件。
