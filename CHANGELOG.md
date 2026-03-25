# NEUMOOC 智能助手改版前后对照说明

## 1. 对比对象

- 改版前：`neumooc-script.user.js`（改版前版本）
- 改版后：`neumooc-script.user.js`（当前仓库版本）

## 2. 总体结论

本次改版的主要变化集中在 **AI 接口响应解析与异常处理**，其余绝大多数逻辑保持一致（包括 UI、题目提取、批量答题、自动答题流程、视频完成逻辑等）。

核心收益：

1. 新增统一的响应校验入口，避免直接假设响应结构正确。
2. 提供更详细的报错信息，便于排查 API/模型/网关问题。
3. 解析答案字母时统一转大写，提高容错。

---

## 3. 改动区域前后对照

## 改动点 A：新增 JSON 安全解析工具

### 改版前

无该工具函数，`onload` 回调中直接 `JSON.parse(res.responseText)`。

### 改版后

位置（改版后）：约第 388 行开始

```js
const safeParseJson = (text) => {
    const raw = String(text ?? "");
    if (!raw.trim()) {
        throw new Error("响应为空，无法解析 JSON");
    }
    try {
        return JSON.parse(raw);
    } catch (err) {
        throw new Error(
            "响应不是合法 JSON。\n原始响应前 500 字符：\n" + raw.slice(0, 500)
        );
    }
};
```

### 功能说明

- 在 JSON 解析前先判断空响应，避免出现不直观的异常。
- 解析失败时附带响应片段（前 500 字符），便于快速定位后端返回格式问题。

---

## 改动点 B：新增统一响应内容提取函数

### 改版前

各处请求回调各自处理响应，依赖如下假设：

- HTTP 状态码可用且成功。
- 响应一定是合法 JSON。
- 一定存在 `choices[0].message.content`。

### 改版后

位置（改版后）：约第 402 行开始

```js
const extractMessageContentFromResponse = (res) => {
    console.log("[AI] HTTP状态码:", res.status);
    console.log("[AI] 原始响应:", res.responseText);

    if (res.status < 200 || res.status >= 300) {
        throw new Error(
            `接口状态异常: ${res.status}\n响应前 500 字符:\n${String(res.responseText || "").slice(0, 500)}`
        );
    }

    const data = safeParseJson(res.responseText);

    if (data?.error) {
        throw new Error(
            "接口返回错误: " +
                (data.error.message || JSON.stringify(data.error))
        );
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error(
            "响应 JSON 结构异常，未找到 choices[0].message.content。\n响应前 500 字符:\n" +
                String(res.responseText || "").slice(0, 500)
        );
    }

    return content;
};
```

### 功能说明

- 统一处理 HTTP 状态异常、接口报错对象、字段缺失等问题。
- 日志中输出原始响应，方便在浏览器控制台定位实际返回。
- 减少重复代码，后续新增 AI 请求时可复用同一解析策略。

---

## 改动点 C：单题解答接口回调改造

### 改版前（位置：约第 519 行）

```js
onload: (res) => {
    try {
        const data = JSON.parse(res.responseText);
        const aiAnswerRaw = data.choices[0].message.content;
        log(`🤖 AI 返回: ${aiAnswerRaw}`);
        const letters = aiAnswerRaw
            .replace(/[^A-Z,]/g, "")
            .split(",")
            .filter(Boolean);
        const answersText = letters
            .map((l) => optionMap[l])
            .filter(Boolean);
        resolve(answersText);
    } catch (e) {
        reject("AI响应解析失败: " + e.message);
    }
}
```

### 改版后（位置：约第 562 行）

```js
onload: (res) => {
    try {
        const aiAnswerRaw = extractMessageContentFromResponse(res);
        log(`🤖 AI 返回: ${aiAnswerRaw}`);
        const letters = aiAnswerRaw
            .toUpperCase()
            .replace(/[^A-Z,]/g, "")
            .split(",")
            .filter(Boolean);
        const answersText = letters
            .map((l) => optionMap[l])
            .filter(Boolean);
        resolve(answersText);
    } catch (e) {
        reject("AI响应解析失败: " + e.message);
    }
}
```

### 功能说明

- 由“直接解析 JSON”改为“统一提取内容函数”，异常路径更完整。
- 新增 `toUpperCase()`，提升对小写答案（如 `a,b`）的兼容性。

---

## 改动点 D：批量答题接口回调改造

### 改版前（位置：约第 698 行）

```js
onload: (res) => {
    try {
        const data = JSON.parse(res.responseText);
        const aiAnswerRaw = data.choices?.[0]?.message?.content || "";
        const parsed = extractJsonFromResponse(aiAnswerRaw);
        if (!parsed) {
            return reject(new Error("无法解析 AI 返回的 JSON。"));
        }
        resolve(parsed);
    } catch (error) {
        reject(new Error("AI响应解析失败: " + error.message));
    }
}
```

### 改版后（位置：约第 741 行）

```js
onload: (res) => {
    try {
        const aiAnswerRaw = extractMessageContentFromResponse(res);
        const parsed = extractJsonFromResponse(aiAnswerRaw);
        if (!parsed) {
            return reject(
                new Error("无法解析 AI 返回的 JSON。\nAI 原始输出：\n" + aiAnswerRaw)
            );
        }
        resolve(parsed);
    } catch (error) {
        reject(new Error("AI响应解析失败: " + error.message));
    }
}
```

### 功能说明

- 统一使用公共响应提取函数，降低批量流程与单题流程行为差异。
- 当 JSON 提取失败时，错误信息带上 AI 原始输出，便于定位提示词或模型输出格式问题。

---

## 改动点 E：非功能性改动（格式）

还存在少量空行/缩进微调，不影响运行逻辑。

---

## 4. 影响评估

1. **稳定性提升**：在 API 出错、响应非 JSON、结构变化时，脚本不再静默失败，而是给出可诊断错误。
2. **可维护性提升**：响应解析逻辑集中，后续维护只需改一个入口。
3. **兼容性提升**：答案字母统一大写处理，减少大小写导致的匹配失败。
4. **潜在代价**：控制台日志会增加（输出原始响应）；若响应较大，调试信息会更长。

---

## 5. 建议（可选）

1. 可在设置中增加“调试日志开关”，避免生产环境输出过多 `console.log`。
2. 可将 `extractMessageContentFromResponse` 拓展为兼容不同模型返回格式（如非 `choices[0].message.content` 的场景）。
3. 可在 UI 日志区分“接口错误/解析错误/答案格式错误”三类状态，便于用户自助排查。
