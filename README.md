# NEUMOOC 智能助手

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.4-brightgreen. svg)
![Language](https://img.shields.io/badge/language-JavaScript-yellow.svg)

一个为NEUMOOC平台设计的油猴（Tampermonkey）脚本。

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
2.  点击"添加新脚本"选项卡。
3.  将项目中的 `.js` 文件的**全部内容**复制并粘贴到编辑器中。
4.  按下 `Ctrl` + `S` 保存脚本。

### 3. API 配置教程

#### 3.1 配置步骤

1. **打开配置界面**
   - 访问 NEUMOOC 平台并登录
   - 在页面上找到脚本设置按钮（通常在页面右下角或顶部）
   - 点击打开配置面板

2. **填写 API 信息**
   
   根据您选择的 AI 服务商，填入对应的 API 配置：

   | 配置项 | 说明 | 示例 |
   |--------|------|------|
   | **API Key** | 您的 AI 服务 API 密钥 | `sk-xxxxxxxxxxxxxxxx` |
   | **API 地址** | API 接口地址（可选） | `https://api.openai.com/v1` |
   | **模型名称** | 使用的模型（可选） | `gpt-3.5-turbo` |

3. **保存配置**
   - 点击"保存"按钮
   - 刷新页面使配置生效

#### 3.2 推荐 API 服务商

##### 🎓 阿里云百炼大模型（推荐学生使用）

适合学生用户，性价比高：

- 🎁 **[领取阿里云高校学生通用权益 - 300元优惠券](https://university.aliyun.com/course/promotion19-activity?clubTaskBiz=subTask..12218312..10256.. &userCode=jgg8c9cg)**
- 提供免费额度和学生优惠
- 支持多种大模型（通义千问等）
- [阿里云百炼控制台](https://www.aliyun.com/product/bailian)

**配置示例：**
```javascript
API Key: sk-xxxxxxxxxxxxxxxxxx
API 地址: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
模型:  qwen-max
```

##### 🌐 其他服务商

- **OpenAI** - 官方服务，稳定可靠
- **通义千问** - 阿里云AI，中文友好
- **讯飞星火** - 科大讯飞，语义理解强
- **文心一言** - 百度AI，免费额度多

#### 3.3 配置验证

配置完成后，建议进行以下测试：

1. 打开任意 NEUMOOC 题目页面
2. 观察脚本是否正常加载
3. 测试答题辅助功能是否生效
4. 检查控制台是否有错误信息

#### 3.4 常见配置问题

**Q: API Key 在哪里获取？**
- 登录对应服务商的控制台
- 找到 API 密钥管理页面
- 创建新的 API Key 并复制

**Q: 配置后不生效？**
- 检查 API Key 格式是否正确
- 确认账户余额是否充足
- 清除浏览器缓存后重试
- 查看浏览器控制台错误信息

**Q: API 调用失败？**
- 验证网络连接是否正常
- 检查 API 地址是否正确
- 确认 API Key 权限是否足够

## ⚠️ 免责声明

> **在使用本项目前，请您务必仔细阅读并充分理解以下所有条款。**
> 
> **一旦您以任何方式（包括但不限于下载、安装、使用、修改、分发）使用本项目，即代表您已完全接受并同意本声明的全部内容。**

---

#### 1. 项目目的
本项目（以下简称"本软件"）的创建初衷是出于作者对编程技术的学习与探索，旨在验证特定场景下自动化流程的可行性。所有功能均基于公开的技术接口实现。

#### 2. "按原样"提供
本软件以"**按原样**" (AS IS) 的形式提供，不附带任何形式的保证，无论是明示的还是暗示的。作者不对以下内容做出任何承诺：
- 软件功能的`稳定性`、`可靠性`或`持续可用性`。
- 软件所提供数据或结果的`准确性`和`完整性`。
- 软件与目标网站的`永久兼容性`（目标网站的任何更新都可能导致本软件部分或全部功能失效）。

#### 3. 使用者责任
您将对使用本软件的所有行为**负全部责任**。这包括但不限于：
- **遵守法律法规**：您必须确保您的使用行为符合您所在国家或地区的所有适用法律法规。
- **遵守平台协议**：您必须遵守目标平台（如 NEU MOOC）的所有用户协议、行为规范及相关政策。
- **遵守学术诚信规范**：若您为在校学生，您必须严格遵守学校的**学术诚信**规定。使用本软件完成任何计分、考核相关的任务，都可能被认定为学术不端行为。

#### 4. 免责条款 (Limitation of Liability)
在任何情况下，无论基于何种法律理论（无论是合同、侵权（包括过失）还是其他方面），本软件的作者或版权持有人**均不对任何因使用或无法使用本软件而产生的损害承担责任**。

这包括但不限于：
* 任何直接、间接、偶然、特殊、惩戒性或后果性的损害。
* 因使用本软件导致的**账号封禁、限制登录、课程成绩无效、学术警告、留校察看、开除学籍**等一切学术或行政处分。
* 任何数据丢失、利润损失、业务中断等商业或个人损失。

#### 5. 风险自负
您的使用行为即代表您已充分理解并同意，您将**自行承担**使用本软件可能带来的一切风险，包括但不限于上述条款中提到的所有风险。您承诺，不会因使用本软件产生的任何后果向作者提出索赔或追责。

#### 6. 最终解释权
*本声明的最终解释权归项目作者所有。*

## 📄 开源协议

本项目采用 **MIT** 开源许可证。详情请见仓库中的 `LICENSE` 文件。
