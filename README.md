# NEUMOOC 智能答题助手

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)
![Language](https://img.shields.io/badge/language-JavaScript-yellow.svg)

一个为东软NEUMOOC平台设计的油猴（Tampermonkey）脚本。

## 🚀 安装与设置

### 1. 安装油猴插件

首先，您的浏览器需要安装一个用户脚本管理器。推荐使用 **Tampermonkey**。

- [Chrome 应用商店](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox 附加组件](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- [Edge 附加组件](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### 2. 安装本脚本

**方式一：从 Greasy Fork 安装 (推荐)**

[点击此处从 Greasy Fork 安装](https://greasyfork.org/zh-CN/scripts/538664-neu-mooc-%E6%99%BA%E8%83%BD%E7%AD%94%E9%A2%98%E5%8A%A9%E6%89%8B-github-release)

**方式二：手动安装**
1.  打开 Tampermonkey 管理面板。
2.  点击“添加新脚本”选项卡。
3.  将项目中的 `.js` 文件的**全部内容**复制并粘贴到编辑器中。
4.  按下 `Ctrl` + `S` 保存脚本。

### 3. 配置 AI 参数

脚本需要一个遵循 OpenAI API 格式的接口才能工作。

1.  打开任意 NEU MOOC 测验页面，脚本的控制面板会出现在页面右侧。
2.  在 **AI 配置**区域，填入您的：
    - `API Key`
    - `API Endpoint` (可选, 默认为 OpenAI 官方地址)
    - `Model` (可选, 默认为 `gpt-3.5-turbo`)
3.  点击 **保存配置** 按钮。配置成功后会有提示。

推荐[阿里云百炼大模型](https://dashi.aliyun.com/activity/mobi?userCode=jgg8c9cg) 新用户注册免费领取Deepseek-R1 额度
[API参考](https://help.aliyun.com/zh/model-studio/use-qwen-by-calling-api?spm=a2c4g.11186623.help-menu-2400256.d_2_1_0.21ce7297Q8XdZJ&scm=20140722.H_2712576._.OR_help-T_cn~zh-V_1)

## 📖 使用方法



## ⚠️ 免责声明

> **在使用本项目前，请您务必仔细阅读并充分理解以下所有条款。**
> 
> **一旦您以任何方式（包括但不限于下载、安装、使用、修改、分发）使用本项目，即代表您已完全接受并同意本声明的全部内容。**

---

#### 1. 项目目的
本项目（以下简称“本软件”）的创建初衷是出于作者对编程技术的学习与探索，旨在验证特定场景下自动化流程的可行性。所有功能均基于公开的技术实现，仅供个人学习和技术交流使用，**严禁用于任何商业或非法用途**。

#### 2. “按原样”提供
本软件以“**按原样**” (AS IS) 的形式提供，不附带任何形式的保证，无论是明示的还是暗示的。作者不对以下内容做出任何承诺：
- 软件功能的`稳定性`、`可靠性`或`持续可用性`。
- 软件所提供数据或结果的`准确性`和`完整性`。
- 软件与目标网站的`永久兼容性`（目标网站的任何更新都可能导致本软件部分或全部功能失效）。

#### 3. 使用者责任
您将对使用本软件的所有行为**负全部责任**。这包括但不限于：
- **遵守法律法规**：您必须确保您的使用行为符合您所在国家或地区的所有适用法律法规。
- **遵守平台协议**：您必须遵守目标平台（如 NEU MOOC）的所有用户协议、行为规范及相关政策。
- **遵守学术诚信规范**：若您为在校学生，您必须严格遵守学校的**学术诚信**规定。使用本软件完成任何计分、考核相关的任务，都可能被认定为学术不端行为。

#### 4. 免责条款 (Limitation of Liability)
在任何情况下，无论基于何种法律理论（无论是合同、侵权（包括过失）还是其他方面），本软件的作者或版权持有人**均不对任何因使用或无法使用本软件而导致的任何形式的损害承担责任**。

这包括但不限于：
* 任何直接、间接、偶然、特殊、惩戒性或后果性的损害。
* 因使用本软件导致的**账号封禁、限制登录、课程成绩无效、学术警告、留校察看、开除学籍**等一切学术或行政处分。
* 任何数据丢失、利润损失、业务中断等商业或个人损失。

#### 5. 风险自负
您的使用行为即代表您已充分理解并同意，您将**自行承担**使用本软件可能带来的一切风险，包括但不限于上述条款中提到的所有风险。您承诺，不会因使用本软件而对项目作者追究任何形式的法律或经济责任。

#### 6. 最终解释权
*本声明的最终解释权归宇宙基本法及项目作者所有。*

## 📄 开源协议

本项目采用 **MIT** 开源许可证。详情请见仓库中的 `LICENSE` 文件。
