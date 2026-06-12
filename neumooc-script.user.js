// ==UserScript==
// @name         NEUMOOC 智能助手
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  NEUMOOC 智能助手 - 支持单选/多选/判断/填空一键答题
// @author       LuBanQAQ
// @license      MIT
// @match        https://*.neumooc.com/*
// @match        https://study.neusoft.edu.cn/*
// @downloadURL  https://raw.githubusercontent.com/LuBanQAQ/neumooc-script/main/neumooc-script.user.js
// @updateURL    https://raw.githubusercontent.com/LuBanQAQ/neumooc-script/main/neumooc-script.user.js
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_getResourceText
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
// @resource     sweetalert2_css https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css
// @connect      *
// ==/UserScript==


(function () {
    "use strict";

    installStudyProgressProbe();

    // --- 配置区 ---
    const selectors = {
        questionBox: ".item-box",
        questionText: ".qusetion-info > .info-item > .value",
        optionLabel: ".choices > label.el-radio, .choices > label.el-checkbox",
        optionText:
            ".el-radio__label .choices-html, .el-checkbox__label .choices-html",
        prevButton: ".left-bottom button:first-of-type",
        nextButton: ".left-bottom button:last-of-type",
        submitButton: ".infoCellRight .el-button--primary",
        examContainer: ".respondPaperContainer",
        answerCardNumbers: ".right-box .q-num-box",
        activeAnswerCardNumber: ".right-box .q-num-box.is-q-active",
        blankInput: "input[type='text']:not([readonly]), textarea:not([readonly]), .el-input__inner:not([readonly])",
    };

    // --- AI 配置 ---
    let aiConfig = {
        apiKey: GM_getValue("apiKey", ""),
        apiEndpoint: GM_getValue(
            "apiEndpoint",
            "https://api.openai.com/v1/chat/completions"
        ),
        model: GM_getValue("model", "gpt-3.5-turbo"),
    };

    const defaultBulkPrompt = `你是一个严谨的考试答题助手。下面提供一组题目的结构化 JSON 数据，请基于题目内容和选项推理正确答案，并严格遵循以下要求：
题目 JSON 中包含 selectionType 字段（single/multiple/judge/blank），请结合该字段决定答案格式。
1. 仅返回 JSON 对象，键为题目序号（index 字段），值为正确选项的大写字母或填空题答案文本。
2. 当 selectionType 为 single 时，值写单个字母，例如 "A"。
3. 当 selectionType 为 multiple 时，值写数组或用逗号分隔的多个大写字母，例如 ["A","C"] 或 "A,C"。
4. 当 selectionType 为 judge 时，使用 A 表示"正确"、B 表示"错误"。
5. 当 selectionType 为 blank 时，值写字符串答案。如有多个空，写数组，例如 ["北京","上海"]。
6. 不要添加解释、Markdown、自然语言描述。

题目数据：
{{questions}}`;
    let bulkPromptTemplate = GM_getValue("bulkPromptTemplate", defaultBulkPrompt);

    let isAutoAnswering = false;
    let isBulkJsonAnswering = false;

    // --- GUI 样式 ---
    GM_addStyle(`
        #control-panel { position: fixed; top: 128px; right: 20px; width: 348px; background: #f7f8fb; border: 1px solid rgba(37, 99, 235, 0.14); border-radius: 8px; box-shadow: 0 18px 42px rgba(15,23,42,0.16), 0 2px 8px rgba(15,23,42,0.08); z-index: 100000; font-family: Arial, "Microsoft YaHei", sans-serif; color: #162033; overflow: hidden; }
        #control-panel-header { padding: 11px 12px; cursor: move; background: #ffffff; color: #162033; border-bottom: 1px solid #e7ebf2; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        #control-panel-title { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; letter-spacing: 0; }
        #control-panel-title::before { content: ""; width: 8px; height: 18px; border-radius: 4px; background: #2563eb; display: inline-block; }
        #control-panel-version { padding: 2px 6px; border-radius: 999px; background: #eef2ff; color: #4f46e5; font-weight: 700; font-size: 11px; }
        #control-panel-body { padding: 10px; display: block; max-height: 74vh; overflow-y: auto; scrollbar-width: thin; }
        #control-panel-body.minimized { display: none; }
        #control-panel button { display: flex; width: 100%; min-height: 36px; align-items: center; justify-content: flex-start; padding: 8px 10px; border: 1px solid #dfe5ee; border-radius: 6px; background: #fff; color: #1f2937; cursor: pointer; text-align: left; font-size: 13px; line-height: 1.25; box-sizing: border-box; box-shadow: 0 1px 0 rgba(15,23,42,0.03); transition: background-color 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.08s; }
        #control-panel button:hover { background-color: #f8fbff; border-color: #b7c7e6; box-shadow: 0 2px 8px rgba(37,99,235,0.08); }
        #control-panel button:active { transform: translateY(1px); }
        #control-panel button:disabled { cursor: not-allowed; opacity: 0.65; transform: none; }
        #control-panel .btn-primary { background: #2563eb; color: white; border-color: #2563eb; box-shadow: 0 6px 14px rgba(37,99,235,0.18); }
        #control-panel .btn-primary:hover { background-color: #1d4ed8; border-color: #1d4ed8; box-shadow: 0 8px 18px rgba(37,99,235,0.24); }
        #control-panel .btn-danger { background-color: #dc3545; color: white; border-color: #dc3545; }
        #control-panel .btn-danger:hover { background-color: #bd2635; border-color: #bd2635; }
        #control-panel .btn-info { background-color: #0f766e; color: white; border-color: #0f766e; box-shadow: 0 6px 14px rgba(15,118,110,0.14); }
        #control-panel .btn-info:hover { background-color: #0b645d; border-color: #0b645d; }
        #control-panel label { display: block; margin: 8px 0 5px; color: #64748b; font-size: 12px; font-weight: 700; }
        #control-panel input[type="text"] { width: 100%; padding: 8px 9px; border: 1px solid #dfe5ee; border-radius: 6px; box-sizing: border-box; background: #fbfdff; color: #172033; outline: none; }
        #control-panel textarea { width: 100%; padding: 8px 9px; border: 1px solid #dfe5ee; border-radius: 6px; box-sizing: border-box; background: #fbfdff; color: #172033; font-family: inherit; font-size: 12px; resize: vertical; min-height: 96px; outline: none; }
        #control-panel input[type="text"]:focus, #control-panel textarea:focus { border-color: #93b4ee; box-shadow: 0 0 0 3px rgba(37,99,235,0.10); background: #fff; }
        #log-area { padding: 8px 9px; height: 132px; overflow-y: auto; background: #fbfdff; border: 1px solid #dfe5ee; border-radius: 6px; color: #334155; font-size: 12px; line-height: 1.55; white-space: pre-wrap; word-wrap: break-word; }
        #log-area div { padding: 3px 0; border-bottom: 1px solid #edf1f7; }
        #log-area div:last-child { border-bottom: 0; }
        #minimize-btn { cursor: pointer; font-weight: bold; font-size: 18px; line-height: 1; padding: 2px 8px; border-radius: 6px; color: #64748b; background-color: #f1f5f9; transition: background-color 0.2s, color 0.2s; }
        #minimize-btn:hover { background-color: #e2e8f0; color: #1e293b; }
        .panel-section { margin-bottom: 9px; padding: 10px; background: rgba(255,255,255,0.86); border: 1px solid #e6ebf2; border-radius: 8px; }
        .panel-section:last-child { margin-bottom: 0; }
        .panel-section-title { margin-bottom: 8px; color: #475569; font-weight: 800; font-size: 12px; letter-spacing: 0.02em; }
        .panel-section-title::after { content: ""; display: block; width: 22px; height: 2px; margin-top: 5px; border-radius: 2px; background: #94a3b8; }
        .panel-actions { display: grid; gap: 7px; }
        .panel-actions.two-cols { grid-template-columns: 1fr 1fr; }
        .collapsible-header { cursor: pointer; display: flex; align-items: center; justify-content: space-between; margin-bottom: 0; padding: 10px; background: rgba(255,255,255,0.86); border: 1px solid #e6ebf2; border-radius: 8px; color: #475569; font-weight: 800; font-size: 12px; letter-spacing: 0.02em; }
        .collapsible-header::after { content: "展开"; color: #64748b; font-weight: 700; font-size: 11px; }
        .collapsible-header:has(+ .collapsible-content.visible)::after { content: "收起"; }
        .collapsible-content { display: none; margin: -1px 0 9px; padding: 0 10px 10px; background: rgba(255,255,255,0.86); border: 1px solid #e6ebf2; border-top: 0; border-radius: 0 0 8px 8px; }
        .collapsible-content.visible { display: block; }

    /* 悬浮球样式 */
    #floating-ball { position: fixed; width: 48px; height: 48px; border-radius: 50%; background-color: #2563eb; color: #fff; display: none; align-items: center; justify-content: center; box-shadow: 0 8px 18px rgba(37,99,235,0.24); z-index: 100001; cursor: move; user-select: none; }
    #floating-ball span { pointer-events: none; font-size: 18px; }
    `);

    // --- 创建 GUI ---
    const panel = document.createElement("div");
    panel.id = "control-panel";
    panel.innerHTML = `
        <div id="control-panel-header">
            <span id="control-panel-title">🎓 智能助手 <span id="control-panel-version">v1.2.0</span></span>
            <span id="minimize-btn">-</span>
        </div>
        <div id="control-panel-body">
            <div class="panel-section">
                <div class="panel-section-title">核心操作</div>
                <div class="panel-actions">
                    <button id="ai-single-solve-btn">🤖 AI 解答当前题目</button>
                    <button id="answer-all-btn" class="btn-info">🧠 一键提取并答完所有题目</button>
                    <button id="full-auto-btn" class="btn-primary">⚡️ 开始全自动 AI 答题</button>
                </div>
            </div>

            <div class="panel-section">
                <div class="panel-section-title">学习资料</div>
                <div class="panel-actions">
                    <button id="direct-finish-video-btn" class="btn-primary">⚡ 学习资料直传完成</button>
                    <button id="finish-video-btn">🎬 完成当前视频</button>
                </div>
            </div>

            <div class="collapsible-header">🛠️ 辅助工具</div>
            <div class="collapsible-content">
                <div class="panel-actions">
                    <button id="copy-question-btn" class="btn-info">📋 复制当前题目和选项</button>
                    <div class="panel-actions two-cols">
                        <button id="test-prev-btn">◀️ 上一题</button>
                        <button id="test-next-btn">▶️ 下一题</button>
                    </div>
                </div>
            </div>

            <div class="collapsible-header">⚙️ AI 配置</div>
            <div class="collapsible-content">
                <label>API Key</label>
                <input type="text" id="api-key-input" placeholder="输入你的 API Key">
                <label>API Endpoint</label>
                <input type="text" id="api-endpoint-input">
                <label>Model</label>
                <input type="text" id="model-input">
                <div class="panel-actions">
                    <button id="save-config-btn">保存配置</button>
                </div>
                <label>批量答题提示词（包含 {{questions}} 占位符）</label>
                <textarea id="bulk-prompt-input" placeholder="自定义批量问答提示词，使用 {{questions}} 插入题目 JSON"></textarea>
                <div class="panel-actions">
                    <button id="save-bulk-prompt-btn">保存提示词</button>
                </div>
            </div>

            <div class="panel-section">
                <div class="panel-section-title">运行日志</div>
                <div id="log-area">等待操作...</div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    // 创建悬浮球
    const floatingBall = document.createElement('div');
    floatingBall.id = 'floating-ball';
    floatingBall.innerHTML = '<span>❏</span>';
    document.body.appendChild(floatingBall);
    document.getElementById("api-key-input").value = GM_getValue("apiKey", "");
    document.getElementById("api-endpoint-input").value = GM_getValue(
        "apiEndpoint",
        "https://api.openai.com/v1/chat/completions"
    );
    document.getElementById("model-input").value = GM_getValue(
        "model",
        "gpt-3.5-turbo"
    );
    document.getElementById("bulk-prompt-input").value = bulkPromptTemplate;

    const log = (message) => {
        const logArea = document.getElementById("log-area");
        if (logArea) {
            logArea.innerHTML += `<div>${new Date().toLocaleTimeString()}: ${message}</div>`;
            logArea.scrollTop = logArea.scrollHeight;
        }
    };

    // --- GUI 事件绑定 ---
    document.querySelectorAll(".collapsible-header").forEach((header) => {
        header.addEventListener("click", () =>
            header.nextElementSibling.classList.toggle("visible")
        );
    });

    document.getElementById("save-config-btn").addEventListener("click", () => {
        aiConfig.apiKey = document.getElementById("api-key-input").value.trim();
        aiConfig.apiEndpoint = document
            .getElementById("api-endpoint-input")
            .value.trim();
        aiConfig.model = document.getElementById("model-input").value.trim();
        GM_setValue("apiKey", aiConfig.apiKey);
        GM_setValue("apiEndpoint", aiConfig.apiEndpoint);
        GM_setValue("model", aiConfig.model);
        log("✅ AI配置已保存。");
    });

    document
        .getElementById("save-bulk-prompt-btn")
        .addEventListener("click", () => {
            bulkPromptTemplate = document
                .getElementById("bulk-prompt-input")
                .value.trim();
            if (!bulkPromptTemplate) {
                bulkPromptTemplate = defaultBulkPrompt;
                document.getElementById("bulk-prompt-input").value = bulkPromptTemplate;
            }
            GM_setValue("bulkPromptTemplate", bulkPromptTemplate);
            log("✅ 批量提示词已保存。");
        });

    let isDragging = false,
        dragStartTime = 0,
        hasMoved = false,
        offsetX,
        offsetY;
    const panelHeader = document.getElementById("control-panel-header");
    panelHeader.addEventListener("mousedown", (e) => {
        isDragging = true;
        hasMoved = false;
        dragStartTime = Date.now();
        offsetX = e.clientX - panel.offsetLeft;
        offsetY = e.clientY - panel.offsetTop;
        document.body.style.userSelect = "none";
    });
    document.addEventListener("mousemove", (e) => {
        if (isDragging) {
            // 记录拖动状态，用于防止松手时触发点击事件
            hasMoved = true;
            // 使用 requestAnimationFrame 减少页面抖动
            requestAnimationFrame(() => {
                panel.style.left = `${e.clientX - offsetX}px`;
                panel.style.top = `${e.clientY - offsetY}px`;
            });
        }
    });
    document.addEventListener("mouseup", (e) => {
        // 检查是否真的进行了拖动且不是简单点击
        const wasDragging = isDragging && hasMoved;
        // 检查拖动时间，过滤掉快速点击
        const dragTime = Date.now() - dragStartTime;

        isDragging = false;
        document.body.style.userSelect = "auto";

        // 防止拖动结束时误触发最小化按钮的点击事件
        if (wasDragging && e.target.id === "minimize-btn") {
            e.preventDefault();
            e.stopPropagation();
        }
    });
    // 为最小化按钮添加单独的点击处理
    document.getElementById("minimize-btn").addEventListener("click", (e) => {
            // 点击最小化 => 隐藏面板，显示悬浮球
            const rect = panel.getBoundingClientRect();
            panel.style.display = 'none';

            // 将悬浮球放在当前面板的位置附近，确保在可视区域内
            const ballTop = Math.max(10, Math.min(rect.top, window.innerHeight - 58));
            const ballLeft = Math.max(10, Math.min(rect.left, window.innerWidth - 58));

            floatingBall.style.top = `${ballTop}px`;
            floatingBall.style.left = `${ballLeft}px`;
            floatingBall.style.right = 'auto';
            floatingBall.style.display = 'flex';
        });

        // 悬浮球拖拽 & 点击恢复
        let ballDragging = false, ballStartX = 0, ballStartY = 0, ballOffsetX = 0, ballOffsetY = 0, ballMoved = false, ballDownTime = 0;
        floatingBall.addEventListener('mousedown', (e) => {
            ballDragging = true;
            ballMoved = false;
            ballDownTime = Date.now();
            const rect = floatingBall.getBoundingClientRect();
            ballOffsetX = e.clientX - rect.left;
            ballOffsetY = e.clientY - rect.top;
            document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', (e) => {
            if (!ballDragging) return;
            ballMoved = true;
            requestAnimationFrame(() => {
                let x = e.clientX - ballOffsetX;
                let y = e.clientY - ballOffsetY;
                // 边界限制，避免抖动
                const maxX = window.innerWidth - floatingBall.offsetWidth - 4;
                const maxY = window.innerHeight - floatingBall.offsetHeight - 4;
                x = Math.min(Math.max(4, x), maxX);
                y = Math.min(Math.max(4, y), maxY);
                floatingBall.style.left = `${x}px`;
                floatingBall.style.top = `${y}px`;
                floatingBall.style.right = 'auto';
            });
        });
        document.addEventListener('mouseup', (e) => {
            if (!ballDragging) return;
            const wasDrag = ballDragging && ballMoved;
            ballDragging = false;
            document.body.style.userSelect = 'auto';
            // 如果是拖拽，不触发打开
            if (wasDrag) {
                e.preventDefault();
                e.stopPropagation();
            } else {
                // 视为点击：恢复面板
                const rect = floatingBall.getBoundingClientRect();
                floatingBall.style.display = 'none';
                panel.style.display = 'block';

                // 将面板移动到悬浮球位置附近，确保面板完全在可视区域内
                const panelWidth = 320; // 面板宽度
                const panelHeight = Math.min(panel.offsetHeight || 400, window.innerHeight * 0.8); // 面板高度，最大不超过屏幕80%

                // 计算面板位置，确保不超出屏幕边界
                let panelLeft = rect.left;
                let panelTop = rect.top;

                // 右边界检查
                if (panelLeft + panelWidth > window.innerWidth - 20) {
                    panelLeft = window.innerWidth - panelWidth - 20;
                }
                // 左边界检查
                if (panelLeft < 20) {
                    panelLeft = 20;
                }
                // 下边界检查
                if (panelTop + panelHeight > window.innerHeight - 20) {
                    panelTop = window.innerHeight - panelHeight - 20;
                }
                // 上边界检查
                if (panelTop < 20) {
                    panelTop = 20;
                }

                panel.style.left = `${panelLeft}px`;
                panel.style.top = `${panelTop}px`;
                panel.style.right = 'auto'; // 确保不使用right定位
            }
        });


    // =================================================================
    // 核心修改部分：修正 clickButton 函数
    // =================================================================
    const clickButton = (selector, logMsg, errorMsg) => {
        const button = document.querySelector(selector);
        // 增加检查：按钮必须存在、未被禁用，并且样式上是可见的
        if (
            button &&
            !button.disabled &&
            window.getComputedStyle(button).display !== "none"
        ) {
            button.click();
            log(logMsg);
            return true;
        }
        log(errorMsg);
        return false;
    };

    document
        .getElementById("test-prev-btn")
        .addEventListener("click", () =>
            clickButton(
                selectors.prevButton,
                "点击了“上一题”。",
                "未找到“上一题”按钮。"
            )
        );
    document
        .getElementById("test-next-btn")
        .addEventListener("click", () =>
            clickButton(
                selectors.nextButton,
                "点击了“下一题”。",
                "未找到“下一题”按钮。"
            )
        );

    document.getElementById("copy-question-btn").addEventListener("click", () => {
        const questionBox = document.querySelector(
            `${selectors.questionBox}:not([style*="display: none"])`
        );
        if (!questionBox) {
            log("❌ 未找到题目。");
            return;
        }
        const questionTitleElement = questionBox.querySelector(
            selectors.questionText
        );
        if (!questionTitleElement) {
            log("❌ 未找到题目正文。");
            return;
        }
        const questionText = questionTitleElement.innerText.trim();
        const options = Array.from(
            questionBox.querySelectorAll(selectors.optionLabel)
        );
        let formattedString = `【题目】\n${questionText}\n\n【选项】\n`;
        options.forEach((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            const text = opt.querySelector(selectors.optionText)?.innerText.trim();
            formattedString += `${letter}. ${text}\n`;
        });
        navigator.clipboard.writeText(formattedString).then(
            () => log("✅ 当前题目已复制到剪贴板！"),
            (err) => log("❌ 复制失败: " + err)
        );
    });

    // --- 完成当前视频 ---
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
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

    function installStudyProgressProbe() {
        const source = `(() => {
            if (window.__neumoocStudyProgressProbeInstalled) return;
            window.__neumoocStudyProgressProbeInstalled = true;
            const key = "__neumooc_study_progress_requests__";
            const idsFrom = (text) => Array.from(String(text || "").matchAll(/\\d{12,}/g)).map((m) => m[0]);
            const save = (item) => {
                try {
                    const url = String(item.url || "");
                    const body = typeof item.body === "string" ? item.body : "";
                    const haystack = (url + "\\n" + body).toLowerCase();
                    if (!/(learn|study|course|resource|video|progress|record|play|finish|complete|duration|time)/.test(haystack)) return;
                    if (!/(neumooc|neusoft|neuedu|studentlearncourse|courseStudy)/i.test(url + location.href)) return;
                    item.ts = Date.now();
                    item.pageUrl = location.href;
                    item.pageIds = idsFrom(location.href);
                    const list = JSON.parse(localStorage.getItem(key) || "[]");
                    const identity = [item.type, item.method, item.url, item.body].join("\\n");
                    const next = list.filter((old) => [old.type, old.method, old.url, old.body].join("\\n") !== identity);
                    next.unshift(item);
                    localStorage.setItem(key, JSON.stringify(next.slice(0, 120)));
                } catch (err) {}
            };
            const normalizeBody = (body) => {
                if (body == null) return "";
                if (typeof body === "string") return body;
                if (body instanceof URLSearchParams) return body.toString();
                if (body instanceof FormData) {
                    const params = new URLSearchParams();
                    body.forEach((value, name) => {
                        if (typeof value === "string") params.append(name, value);
                    });
                    return params.toString();
                }
                try { return JSON.stringify(body); } catch (err) { return ""; }
            };
            const normalizeHeaders = (headers) => {
                const out = {};
                try {
                    if (!headers) return out;
                    new Headers(headers).forEach((value, name) => {
                        out[name] = value;
                    });
                } catch (err) {}
                return out;
            };
            const originalFetch = window.fetch;
            if (typeof originalFetch === "function") {
                window.fetch = function(input, init) {
                    try {
                        const url = typeof input === "string" ? input : input && input.url;
                        const method = (init && init.method) || (input && input.method) || "GET";
                        const body = init && "body" in init ? normalizeBody(init.body) : "";
                        const headers = normalizeHeaders((init && init.headers) || (input && input.headers));
                        const item = { type: "fetch", url, method, body, headers };
                        const result = originalFetch.apply(this, arguments);
                        result.then((res) => {
                            try {
                                item.status = res.status;
                                res.clone().text().then((text) => {
                                    item.responseText = String(text || "").slice(0, 5000);
                                    save(item);
                                }).catch(() => save(item));
                            } catch (err) {
                                save(item);
                            }
                        }).catch(() => save(item));
                        return result;
                    } catch (err) {}
                    return originalFetch.apply(this, arguments);
                };
            }
            const originalOpen = XMLHttpRequest.prototype.open;
            const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
            const originalSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.open = function(method, url) {
                this.__neumoocProbe = { type: "xhr", method, url, headers: {} };
                return originalOpen.apply(this, arguments);
            };
            XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
                try {
                    if (this.__neumoocProbe) this.__neumoocProbe.headers[String(name).toLowerCase()] = String(value);
                } catch (err) {}
                return originalSetRequestHeader.apply(this, arguments);
            };
            XMLHttpRequest.prototype.send = function(body) {
                try {
                    const item = this.__neumoocProbe || {};
                    item.body = normalizeBody(body);
                    this.addEventListener("loadend", () => {
                        try {
                            item.status = this.status;
                            item.responseText = String(this.responseText || "").slice(0, 5000);
                        } catch (err) {}
                        save(item);
                    }, { once: true });
                } catch (err) {}
                return originalSend.apply(this, arguments);
            };
            const originalBeacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
            if (originalBeacon) {
                navigator.sendBeacon = function(url, data) {
                    try { save({ type: "beacon", method: "POST", url, body: normalizeBody(data) }); } catch (err) {}
                    return originalBeacon(url, data);
                };
            }
        })();`;
        try {
            const script = document.createElement("script");
            script.textContent = source;
            (document.documentElement || document.head || document.body).appendChild(script);
            script.remove();
        } catch (err) {}
        try {
            const run = new Function(source);
            run();
        } catch (err) {}
    }

    const progressCaptureKey = "__neumooc_study_progress_requests__";
    const completionFieldPattern = /(progress|process|percent|rate|current|position|play|watch|study|learn|view|duration|time|finish|complete|end|status)/i;

    function getPageIds(url = location.href) {
        return Array.from(String(url || "").matchAll(/\d{12,}/g)).map((m) => m[0]);
    }

    function rebaseCapturedText(text, sourceIds, targetIds) {
        let next = String(text || "");
        sourceIds.forEach((id, index) => {
            if (targetIds[index] && targetIds[index] !== id) {
                next = next.split(id).join(targetIds[index]);
            }
        });
        return next;
    }

    function completionValueForKey(key, oldValue, duration) {
        const name = String(key || "").toLowerCase();
        if (/(isfinish|isfinished|finished|complete|completed|iscomplete|iscompleted|endflag|finishflag)/.test(name)) {
            if (typeof oldValue === "boolean") return true;
            if (typeof oldValue === "string") return "1";
            return 1;
        }
        if (/(status|state)/.test(name)) {
            if (typeof oldValue === "string") return /finish|complete|done|1/i.test(oldValue) ? oldValue : "completed";
            return oldValue === 0 ? 1 : oldValue;
        }
        if (/(progress|process|percent)/.test(name)) return 100;
        if (/(rate)/.test(name)) return 1;
        if (/(duration|totaltime|videotime|alltime)/.test(name)) return duration;
        if (/(current|position|play|watch|study|learn|view|time|end)/.test(name)) return duration;
        return oldValue;
    }

    function markJsonCompleted(value, duration) {
        if (Array.isArray(value)) {
            return value.map((item) => markJsonCompleted(item, duration));
        }
        if (value && typeof value === "object") {
            const out = {};
            Object.entries(value).forEach(([key, child]) => {
                out[key] = completionFieldPattern.test(key)
                    ? completionValueForKey(key, child, duration)
                    : markJsonCompleted(child, duration);
            });
            return out;
        }
        return value;
    }

    function completeUrlEncodedBody(body, duration) {
        const params = new URLSearchParams(body);
        let changed = false;
        Array.from(params.keys()).forEach((key) => {
            if (completionFieldPattern.test(key)) {
                params.set(key, String(completionValueForKey(key, params.get(key), duration)));
                changed = true;
            }
        });
        return changed ? params.toString() : body;
    }

    function completeRequestBody(body, duration) {
        const raw = String(body || "");
        if (!raw) return raw;
        try {
            const json = JSON.parse(raw);
            return JSON.stringify(markJsonCompleted(json, duration));
        } catch (err) {}
        if (raw.includes("=")) return completeUrlEncodedBody(raw, duration);
        return raw;
    }

    function completeRequestUrl(url, duration) {
        try {
            const next = new URL(url, location.href);
            let changed = false;
            next.searchParams.forEach((value, key) => {
                if (completionFieldPattern.test(key)) {
                    next.searchParams.set(key, String(completionValueForKey(key, value, duration)));
                    changed = true;
                }
            });
            return changed ? next.toString() : String(url);
        } catch (err) {
            return String(url || "");
        }
    }

    function buildReplayHeaders(item, body) {
        const headers = {};
        Object.entries(item.headers || {}).forEach(([name, value]) => {
            const lower = String(name).toLowerCase();
            if (!/^(accept-encoding|connection|content-length|cookie|host|origin|referer|user-agent)$/i.test(lower)) {
                headers[lower] = value;
            }
        });
        if (body && !headers["content-type"]) {
            headers["content-type"] = body.trim().startsWith("{")
                ? "application/json;charset=UTF-8"
                : "application/x-www-form-urlencoded;charset=UTF-8";
        }
        return Object.keys(headers).length ? headers : undefined;
    }

    function getCapturedProgressRequests() {
        try {
            const list = JSON.parse(localStorage.getItem(progressCaptureKey) || "[]");
            return Array.isArray(list) ? list : [];
        } catch (err) {
            return [];
        }
    }

    function isReadOnlyCourseEndpoint(item) {
        const url = String(item.url || "").toLowerCase();
        const method = String(item.method || "GET").toUpperCase();
        if (method === "GET") return true;
        if (/(\/list(resource|tree)?\b|listresource|listtree|get-folder-route|\/stats\b|\/test\/stats\b|\/page\b|\/query\b|\/detail\b)/i.test(url)) {
            return true;
        }
        return false;
    }

    function requestLooksMutable(item) {
        const method = String(item.method || "GET").toUpperCase();
        const text = `${item.url || ""}\n${item.body || ""}`.toLowerCase();
        if (!/^(POST|PUT|PATCH)$/i.test(method)) return false;
        if (isReadOnlyCourseEndpoint(item)) return false;
        return /(save|update|submit|record|progress|process|finish|complete|duration|play|watch|study|learn|current|position|heartbeat|point|time)/.test(text);
    }

    function makeCompletionReplay(item, targetIds, duration) {
        const sourceIds = Array.isArray(item.pageIds) ? item.pageIds : getPageIds(item.pageUrl);
        const rawUrl = rebaseCapturedText(item.url, sourceIds, targetIds);
        const rawBody = rebaseCapturedText(item.body, sourceIds, targetIds);
        const method = String(item.method || (rawBody ? "POST" : "GET")).toUpperCase();
        const url = completeRequestUrl(rawUrl, duration);
        const body = method === "GET" ? undefined : completeRequestBody(rawBody, duration);
        const changed = url !== rawUrl || body !== rawBody;
        return { method, url, body, changed };
    }

    function scoreProgressRequest(item) {
        const text = `${item.url || ""}\n${item.body || ""}`.toLowerCase();
        let score = 0;
        if (!requestLooksMutable(item)) return -100;
        if (/progress|process|percent/.test(text)) score += 5;
        if (/finish|complete|completed|ended|status/.test(text)) score += 4;
        if (/duration|current|play|watch|study|learn|time/.test(text)) score += 3;
        if (/video|resource|course|lesson|chapter/.test(text)) score += 2;
        if (/api|gateway|service/.test(text)) score += 1;
        return score;
    }

    function extractCourseStudyIds(url = location.href) {
        const match = String(url || "").match(/studentLearnCourse\/([^/?#]+)\/([^/?#]+)\/([^/?#]+)\/([^/?#]+)\/([^/?#]+)/);
        if (!match) return null;
        return {
            teachCourseId: match[1],
            teachArrangementId: match[3],
            currentClassId: match[4],
        };
    }

    async function neumoocPost(path, data) {
        const headers = await buildStudyApiHeaders(path);
        const res = await fetch(`/web-api${path}`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify(data),
        });
        const text = await res.text();
        let json;
        try {
            json = JSON.parse(text);
        } catch (err) {
            throw new Error(`${path} 返回非 JSON: ${text.slice(0, 200)}`);
        }
        if (!res.ok || json.code !== 0) {
            throw new Error(`${path} 失败: HTTP ${res.status}, ${json.msg || text.slice(0, 200)}`);
        }
        return json.data;
    }

    function readStorageValue(key) {
        try {
            return localStorage.getItem(key) || sessionStorage.getItem(key) || "";
        } catch (err) {
            return "";
        }
    }

    function findStorageToken() {
        const extractToken = (value) => {
            const raw = String(value || "").trim();
            if (!raw) return "";
            if (/^Bearer\s+\S+/i.test(raw)) return raw;
            if (/^[a-f0-9]{24,}|[A-Za-z0-9._-]{24,}$/.test(raw)) return raw;
            try {
                const json = JSON.parse(raw);
                const stack = [json];
                while (stack.length) {
                    const item = stack.shift();
                    if (!item || typeof item !== "object") continue;
                    for (const [key, child] of Object.entries(item)) {
                        if (/token|authorization|access/i.test(key) && typeof child === "string" && child.length > 12) {
                            return child;
                        }
                        if (child && typeof child === "object") stack.push(child);
                    }
                }
            } catch (err) {}
            const match = raw.match(/(?:Bearer\s+)?([A-Za-z0-9._-]{24,})/);
            return match ? match[0] : "";
        };
        const preferredKeys = [
            "Authorization",
            "authorization",
            "accessToken",
            "access_token",
            "token",
            "Token",
            "satoken",
            "sa-token",
            "Admin-Token",
        ];
        for (const key of preferredKeys) {
            const value = extractToken(readStorageValue(key));
            if (value) return value;
        }

        try {
            const stores = [localStorage, sessionStorage];
            for (const store of stores) {
                for (let i = 0; i < store.length; i += 1) {
                    const key = store.key(i);
                    const raw = store.getItem(key);
                    if (!/token|authorization|auth|user|store|pinia/i.test(key || "") && !/token|authorization/i.test(raw || "")) continue;
                    const value = extractToken(raw);
                    if (value) return value;
                }
            }
        } catch (err) {}
        return "";
    }

    function normalizeBearerToken(value) {
        const token = String(value || "").trim().replace(/^"|"$/g, "");
        if (!token) return "";
        return /^bearer\s+/i.test(token) ? token : `Bearer ${token}`;
    }

    function findCapturedStudyHeaders(path) {
        const target = String(path || "").toLowerCase();
        const captures = getCapturedProgressRequests();
        return captures.find((item) => {
            const url = String(item.url || "").toLowerCase();
            return url.includes("/web-api/teachmanager/") && (!target || url.includes(target));
        })?.headers || captures.find((item) => {
            const url = String(item.url || "").toLowerCase();
            return url.includes("/web-api/teachmanager/");
        })?.headers || {};
    }

    function findTenantId(capturedHeaders) {
        const captured = capturedHeaders["tenant-id"] || capturedHeaders["tenantid"];
        if (captured) return captured;
        const stored = readStorageValue("tenant-id") || readStorageValue("tenantId") || readStorageValue("tenant_id");
        if (stored) return stored.replace(/^"|"$/g, "");
        const match = document.documentElement.innerHTML.match(/tenantId["':\s]+(\d{10,})/i);
        return match ? match[1] : "";
    }

    function findCurrentUserId() {
        const fromCapturedUrl = getCapturedProgressRequests()
            .map((item) => String(item.url || ""))
            .map((url) => {
                try {
                    const parsed = new URL(url, location.href);
                    return parsed.searchParams.get("userId") || parsed.pathname.match(/resourcesLearning\/index\/[^/]+\/[^/]+\/[^/]+\/(\d{12,})/)?.[1] || "";
                } catch (err) {
                    return "";
                }
            })
            .find(Boolean);
        if (fromCapturedUrl) return fromCapturedUrl;

        const inspectValue = (value) => {
            const raw = String(value || "");
            if (!raw) return "";
            try {
                const json = JSON.parse(raw);
                const stack = [json];
                while (stack.length) {
                    const item = stack.shift();
                    if (!item || typeof item !== "object") continue;
                    if (typeof item.id === "string" && /^\d{12,}$/.test(item.id)) return item.id;
                    if (typeof item.userId === "string" && /^\d{12,}$/.test(item.userId)) return item.userId;
                    for (const child of Object.values(item)) {
                        if (child && typeof child === "object") stack.push(child);
                    }
                }
            } catch (err) {}
            return raw.match(/"?(?:id|userId)"?\s*[:=]\s*"?(\d{12,})"?/)?.[1] || "";
        };

        try {
            for (const store of [localStorage, sessionStorage]) {
                for (let i = 0; i < store.length; i += 1) {
                    const key = store.key(i);
                    const raw = store.getItem(key);
                    if (!/user|pinia|store|info|profile/i.test(key || "") && !/"userId"|"id"/.test(raw || "")) continue;
                    const found = inspectValue(raw);
                    if (found) return found;
                }
            }
        } catch (err) {}

        return document.documentElement.innerHTML.match(/userId["':\s]+(\d{12,})/i)?.[1] || "";
    }

    function uuidForIdCode() {
        const webCrypto = globalThis.crypto;
        if (webCrypto?.randomUUID) return webCrypto.randomUUID();
        return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
            (Number(c) ^ (webCrypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16)
        );
    }

    async function aesCbcZeroPaddingBase64(text) {
        const webCrypto = globalThis.crypto;
        if (!webCrypto?.subtle) return "";
        const encoder = new TextEncoder();
        const keyBytes = encoder.encode("neuedu_nse_12345");
        const input = encoder.encode(text);
        const blockSize = 16;
        const paddedLength = Math.ceil(input.length / blockSize) * blockSize || blockSize;
        const padded = new Uint8Array(paddedLength);
        padded.set(input);
        const key = await webCrypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["encrypt"]);
        const encrypted = await webCrypto.subtle.encrypt({ name: "AES-CBC", iv: keyBytes }, key, padded);
        let binary = "";
        new Uint8Array(encrypted).forEach((byte) => {
            binary += String.fromCharCode(byte);
        });
        return btoa(binary);
    }

    async function buildIdCode(path, capturedHeaders) {
        const userId = findCurrentUserId();
        if (!userId) return capturedHeaders["id-code"] || capturedHeaders["Id-Code"] || "";
        try {
            return await aesCbcZeroPaddingBase64(`${userId}_${uuidForIdCode()}_${path}`);
        } catch (err) {
            return capturedHeaders["id-code"] || capturedHeaders["Id-Code"] || "";
        }
    }

    async function buildStudyApiHeaders(path) {
        const capturedHeaders = findCapturedStudyHeaders(path);
        const headers = {
            "content-type": "application/json",
            "accept": "application/json, text/plain, */*",
        };
        const authorization = capturedHeaders.authorization || capturedHeaders.Authorization || findStorageToken();
        const tenantId = findTenantId(capturedHeaders);
        const idCode = await buildIdCode(path, capturedHeaders);

        if (authorization) headers.Authorization = normalizeBearerToken(authorization);
        if (tenantId) headers["tenant-id"] = tenantId;
        if (idCode) headers["Id-Code"] = idCode;
        return headers;
    }

    function isCompletableStudyResource(item) {
        const ext = String(item.resExt || "").toLowerCase();
        const name = String(item.name || "").toLowerCase();
        const resType = Number(item.resType);
        if ([1, 2, 3, 4, 5, 7].includes(resType)) return true;
        return /\.(mp4|m3u8|mp3|wav|ppt|pptx|pdf|doc|docx|md|png|jpe?g)$/i.test(ext || name);
    }

    function isDocumentLikeResource(item, info) {
        const resType = Number(info?.resType ?? item.resType);
        const ext = String(info?.resExt || item.resExt || item.name || "").toLowerCase();
        return [3, 4, 5, 7].includes(resType) || /\.(ppt|pptx|pdf|doc|docx|md|png|jpe?g)$/i.test(ext);
    }

    async function listStudyResourcesByApi(ids, parentId = 0, out = []) {
        const data = await neumoocPost("/teachmanager/teach-course-res-stu/listResource", {
            teachCourseId: ids.teachCourseId,
            currentClassId: ids.currentClassId,
            name: "",
            resType: "",
            studyStatus: "",
            sortType: 1,
            isAssess: "",
            parentId,
        });
        const resList = Array.isArray(data?.resList) ? data.resList : [];
        const folderList = Array.isArray(data?.folderList) ? data.folderList : [];
        out.push(...resList);
        for (const folder of folderList) {
            if (folder?.id != null && String(folder.id) !== String(parentId)) {
                await listStudyResourcesByApi(ids, folder.id, out);
            }
        }
        return out;
    }

    function flattenDirectoryResources(nodes, out = []) {
        if (!Array.isArray(nodes)) return out;
        nodes.forEach((node) => {
            if (!node) return;
            if (node.dirType === "file" || node.resType != null) out.push(node);
            if (Array.isArray(node.children)) flattenDirectoryResources(node.children, out);
        });
        return out;
    }

    async function listDirectoryResourcesByApi(ids) {
        const data = await neumoocPost("/teachmanager/teach-course-directory-stu/listTree", {
            currentClassId: ids.currentClassId,
            teachCourseId: ids.teachCourseId,
            sourceType: "",
            isAssess: "",
            isReview: "",
        });
        return flattenDirectoryResources(data?.treeList || []);
    }

    async function listAllStudyResourcesByApi(ids) {
        const byId = new Map();
        const add = (item) => {
            if (item?.id && !byId.has(item.id)) byId.set(item.id, item);
        };

        try {
            (await listStudyResourcesByApi(ids)).forEach(add);
        } catch (err) {
            log("⚠️ 学习资料列表读取失败，继续读取课程目录: " + (err && err.message ? err.message : err));
        }

        try {
            (await listDirectoryResourcesByApi(ids)).forEach(add);
        } catch (err) {
            log("⚠️ 课程目录读取失败: " + (err && err.message ? err.message : err));
        }

        return Array.from(byId.values());
    }

    async function completeStudyResourceByApi(ids, item) {
        const payload = {
            teachCourseId: ids.teachCourseId,
            currentClassId: ids.currentClassId,
            resId: item.id,
        };
        await neumoocPost("/teachmanager/teach-course-res-stu-record/validateStuResInfo", payload);
        const info = await neumoocPost("/teachmanager/teach-course-res-stu-record/getRecordInfo", payload)
            .catch(() => item);
        const resType = Number(info?.resType ?? item.resType);

        if (resType === 1 || resType === 2) {
            await neumoocPost("/teachmanager/teach-course-res-stu-record/startStudy", payload).catch(() => {});
            const watchProgress = Math.max(Number(info?.playProgress) || 0, 99999);
            await neumoocPost("/teachmanager/teach-course-res-stu-record/studyForAudioOrVideo", {
                ...payload,
                playStatus: 1,
                watchProgress: 0,
            }).catch(() => {});
            await neumoocPost("/teachmanager/teach-course-res-stu-record/studyForAudioOrVideo", {
                ...payload,
                playStatus: 2,
                watchProgress,
            }).catch(() => {});
            await neumoocPost("/teachmanager/teach-course-res-stu-record/studyForAudioOrVideo", {
                ...payload,
                playStatus: 3,
                watchProgress,
            });
            return;
        }

        if (isDocumentLikeResource(item, info)) {
            await neumoocPost("/teachmanager/teach-course-res-stu-record/startStudy", payload).catch(() => {});
            await neumoocPost("/teachmanager/teach-course-res-stu-record/startStudyForDocPicMd", payload).catch(() => {});
            await wait(700);
            await neumoocPost("/teachmanager/teach-course-res-stu-record/endStudyForDocPicMd", payload);
            await wait(500);
            let after = await neumoocPost("/teachmanager/teach-course-res-stu-record/getRecordInfo", payload).catch(() => null);
            if (Number(after?.studyStatus) !== 2) {
                await neumoocPost("/teachmanager/teach-course-res-stu-record/endStudyForDocPicMd", payload);
                await wait(500);
                after = await neumoocPost("/teachmanager/teach-course-res-stu-record/getRecordInfo", payload).catch(() => after);
            }
            if (Number(after?.studyStatus) !== 2) {
                throw new Error(`文档接口已调用，但状态仍为 ${after?.studyStatus ?? "未知"}`);
            }
        }
    }

    async function directCompleteStudyResourcesByApi() {
        const ids = extractCourseStudyIds();
        if (!ids) return false;

        log("⏳ 正在通过学习资料接口读取资源列表...");
        const resources = (await listAllStudyResourcesByApi(ids))
            .filter((item) => item?.id && isCompletableStudyResource(item));
        const pending = resources.filter((item) => Number(item.studyStatus) !== 2);
        if (!resources.length) {
            log("⚠️ 当前课程没有找到可直传的视频/PPT/文档资源。");
            return true;
        }
        if (!pending.length) {
            log(`✅ 找到 ${resources.length} 个学习资料，状态均已完成。`);
            return true;
        }

        log(`⏳ 找到 ${pending.length}/${resources.length} 个未完成学习资料，开始直传完成...`);
        let okCount = 0;
        for (const item of pending) {
            try {
                await completeStudyResourceByApi(ids, item);
                okCount += 1;
                log(`✅ 已直传：${item.name || item.id}`);
            } catch (err) {
                log(`⚠️ 直传失败：${item.name || item.id} - ${err && err.message ? err.message : err}`);
            }
            await wait(350);
        }
        log(`✅ 学习资料直传完成：成功 ${okCount}/${pending.length} 个。请刷新页面确认完成状态。`);
        return true;
    }

    async function directCompleteCurrentVideo() {
        try {
            if (await directCompleteStudyResourcesByApi()) return;

            const targetIds = getPageIds();
            const video = document.querySelector("#dPlayerVideoMain") || document.querySelector("video");
            const duration = Number.isFinite(video?.duration) && video.duration > 1 ? Math.ceil(video.duration) : 99999;
            const captures = getCapturedProgressRequests()
                .map((item) => ({ ...item, score: scoreProgressRequest(item) }))
                .filter((item) => item.score >= 4)
                .map((item) => ({ ...item, replay: makeCompletionReplay(item, targetIds, duration) }))
                .filter((item) => item.replay.changed)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);
            if (!captures.length) {
                const total = getCapturedProgressRequests().length;
                log(`⚠️ 没有可直传的完成上报接口。已捕获 ${total} 个请求，但都是列表/查询或没有可改的进度字段。`);
                log("建议：先打开一次该平台任意视频并等待出现播放进度，再回到目标页点直传按钮。");
                return;
            }
            log(`⏳ 正在尝试直传完成状态，候选接口 ${captures.length} 个...`);

            let okCount = 0;
            for (const item of captures) {
                const { method, url, body } = item.replay;

                try {
                    const res = await fetch(url, {
                        method,
                        credentials: "include",
                        headers: buildReplayHeaders(item, body),
                        body,
                    });
                    log(`${res.ok ? "✅" : "⚠️"} ${method} ${new URL(url, location.href).pathname} -> ${res.status}`);
                    if (res.ok) okCount += 1;
                    await wait(250);
                } catch (err) {
                    log("⚠️ 直传接口失败: " + (err && err.message ? err.message : err));
                }
            }

            if (okCount > 0) {
                log("✅ 已尝试直传完成状态，请刷新课程列表确认是否变为已完成。");
            } else {
                log("❌ 没有接口返回成功，可能需要先打开一次该课程视频以捕获精确上报接口。");
            }
        } catch (err) {
            log("❌ 直传完成失败: " + (err && err.toString ? err.toString() : err));
        }
    }

    const waitForMetadata = (video, timeout = 5000) => {
        return new Promise((resolve, reject) => {
            if (!video) return reject("未找到视频元素");
            if (video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 1) return resolve();
            const onLoaded = () => {
                cleanup();
                resolve();
            };
            const onTimeout = setTimeout(() => {
                cleanup();
                reject("等待视频元数据超时");
            }, timeout);
            const cleanup = () => {
                clearTimeout(onTimeout);
                video.removeEventListener('loadedmetadata', onLoaded);
            };
            video.addEventListener('loadedmetadata', onLoaded, { once: true });
        });
    };

    async function finishCurrentVideo() {
        try {
            // 优先按页面结构查找
            const video = document.querySelector('#dPlayerVideoMain') || document.querySelector('video');
            if (!video) {
                log('❌ 未找到视频元素。');
                return;
            }
            log('⏳ 正在尝试完成当前视频...');
            await waitForMetadata(video).catch(() => {});

            // 若仍无有效时长，尝试触发一次播放以加载元数据（静音以避免打扰）
            if (!(Number.isFinite(video.duration) && video.duration > 1)) {
                try {
                    video.muted = true;
                    await video.play().catch(() => {});
                    await waitForMetadata(video).catch(() => {});
                } catch {}
            }

            if (!(Number.isFinite(video.duration) && video.duration > 1)) {
                log('⚠️ 无法读取视频时长，可能为受限的流媒体。尝试强制触发结束事件。');
            }

            // 尝试将进度跳到末尾附近
            const target = Number.isFinite(video.duration) && video.duration > 1 ? Math.max(0, video.duration - 0.2) : video.currentTime + 1;
            try {
                video.currentTime = target;
            } catch {}

            // 触发一组与进度相关的事件，便于平台上报
            const fire = (type) => {
                try { video.dispatchEvent(new Event(type)); } catch {}
            };
            fire('seeking');
            fire('timeupdate');
            fire('seeked');

            // 部分平台依赖播放状态才会上报，短暂播放后立即结束
            try {
                await video.play().catch(() => {});
                await wait(120);
            } catch {}

            // 主动触发结束
            try {
                video.pause();
            } catch {}
            fire('timeupdate');
            fire('ended');

            // 再补一次 UI 层按钮的兼容（若存在"重新播放"按钮，说明已到末尾）
            const replayBtn = Array.from(document.querySelectorAll('.d-loading span'))
                .find((el) => /重新播放/.test(el.textContent || ''));
            if (replayBtn) {
                log('✅ 已到达视频末尾。');
            } else {
                log('✅ 已触发完成当前视频。');
            }
        } catch (err) {
            log('❌ 完成视频失败：' + (err && err.toString ? err.toString() : err));
        }
    }

    document.getElementById('finish-video-btn').addEventListener('click', finishCurrentVideo);
    document.getElementById('direct-finish-video-btn').addEventListener('click', directCompleteCurrentVideo);

    // --- AI 相关核心功能 ---
    const getAiAnswer = (questionBox) => {
        return new Promise((resolve, reject) => {
            aiConfig.apiKey = GM_getValue("apiKey", "");
            if (!aiConfig.apiKey) {
                log("❌ 错误：请先配置API Key。");
                return reject("API Key not set");
            }
            const questionTitleElement = questionBox.querySelector(
                selectors.questionText
            );
            if (!questionTitleElement) return reject("无法解析题目正文。");
            const questionText = questionTitleElement.innerText.trim();
            const typeText = questionBox
                .querySelector(".question-type .el-tag__content")
                ?.innerText?.trim();
            const selectionType = detectQuestionType(questionBox, typeText);

            /* ---- 填空题 ---- */
            if (selectionType === "blank") {
                const blankInputs = questionBox.querySelectorAll(selectors.blankInput);
                // 图片题干检测：DeepSeek 纯文本模型无法理解图片
                const hasImage = !!questionBox.querySelector("img");
                if (!questionText && hasImage) {
                    log("🖼️ 题干为图片，DeepSeek 不支持视觉，请手动填写。");
                    return reject("图片题干的填空题暂不支持自动解答，请手动填写。");
                }
                let blankPrompt = `你是一个严谨的答题助手。请根据以下填空题给出正确答案。\n\n题目：${questionText}\n\n`;
                if (blankInputs.length > 1) {
                    blankPrompt += `注意：这是有 ${blankInputs.length} 个空的填空题。请只返回答案文本，多个答案用 " | " 分隔（例如: 北京 | 上海）。不要加解释。`;
                } else {
                    blankPrompt += `注意：这是一个填空题。请只返回答案文本，不要加任何解释。`;
                }
                log(`💬 正在为填空题 "${questionText.slice(0, 20)}..." 请求AI...`);
                GM_xmlhttpRequest({
                    method: "POST",
                    url: aiConfig.apiEndpoint,
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${aiConfig.apiKey}`,
                    },
                    data: JSON.stringify({
                        model: aiConfig.model,
                        messages: [{ role: "user", content: blankPrompt }],
                        temperature: 0,
                    }),
                    onload: (res) => {
                        try {
                            const raw = extractMessageContentFromResponse(res);
                            log(`🤖 AI 返回: ${raw}`);
                            const cleaned = raw
                                .replace(/^(答案|填空|答|answer)[：:\s]+/gi, "")
                                .replace(/[。！!]/g, "")
                                .replace(/\n/g, " ");
                            const answers = cleaned.split(/[/|｜\n,，;；、]/).map(s => s.trim()).filter(Boolean);
                            resolve({ type: "blank", answers });
                        } catch (e) {
                            reject("AI响应解析失败: " + e.message);
                        }
                    },
                    onerror: (res) => reject("AI请求失败: " + res.statusText),
                });
                return;
            }
            /* ---- 选择/判断 ---- */
            const options = Array.from(
                questionBox.querySelectorAll(selectors.optionLabel)
            );
            const isMultiple =
                questionBox.querySelector(".el-checkbox-group") !== null ||
                questionBox.querySelector("label.el-checkbox") !== null;
            if (options.length === 0) return reject("无法解析选项。");
            let prompt = `你是一个严谨的答题助手。请根据以下题目和选项，找出最准确的答案。\n\n题目：${questionText}\n\n选项：\n`;
            const optionMap = {};
            options.forEach((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                const text = opt.querySelector(selectors.optionText)?.innerText.trim();
                prompt += `${letter}. ${text}\n`;
                optionMap[letter] = text;
            });
            if (isMultiple) {
                prompt += `\n注意：这是一个多选题，可能有一个或多个正确答案。请给出所有正确答案的字母，仅用逗号分隔（例如: A,B）。请只返回字母和逗号。`;
            } else {
                prompt += `\n注意：这是一个单选题。请只返回唯一正确答案的字母（例如: A）。`;
            }
            log(`💬 正在为题目 "${questionText.slice(0, 15)}..." 请求AI...`);
            GM_xmlhttpRequest({
                method: "POST",
                url: aiConfig.apiEndpoint,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${aiConfig.apiKey}`,
                },
                data: JSON.stringify({
                    model: aiConfig.model,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0,
                }),
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
                        resolve({ type: "option", answers: answersText });
                    } catch (e) {
                        reject("AI响应解析失败: " + e.message);
                    }
                },
                onerror: (res) => reject("AI请求失败: " + res.statusText),
            });
        });
    };

    async function selectOptionByText(questionBox, answer) {
        const options = questionBox.querySelectorAll(selectors.optionLabel);
        let found = false;
        const answersToClick = Array.isArray(answer) ? answer : [answer];
        const isMultipleWithDelay = answersToClick.length > 1;
        for (const optionLabel of options) {
            const optionTextElement = optionLabel.querySelector(selectors.optionText);
            if (optionTextElement) {
                const currentOptionText = optionTextElement.innerText.trim();
                if (answersToClick.some((ans) => currentOptionText.includes(ans))) {
                    if (!optionLabel.classList.contains("is-checked")) {
                        optionLabel.click();
                        log(`  - 已选择: ${currentOptionText}`);
                        found = true;
                        if (isMultipleWithDelay) {
                            log("多选题，等待1秒...");
                            await new Promise((resolve) => setTimeout(resolve, 1000));
                        }
                    }
                }
            }
        }
        return found;
    }

    const fillBlankInputs = (questionBox, answers) => {
        const inputs = Array.from(questionBox.querySelectorAll(selectors.blankInput));
        if (inputs.length === 0) {
            log("  ⚠️ 未找到填空输入框。");
            return false;
        }
        const answerList = Array.isArray(answers) ? answers : [String(answers || "")];
        let filled = 0;
        inputs.forEach((el, idx) => {
            if (idx >= answerList.length) return;
            const nativeInput =
                el.tagName === "INPUT" || el.tagName === "TEXTAREA"
                    ? el
                    : el.querySelector("input, textarea");
            if (!nativeInput) return;
            const value = String(answerList[idx] || "");
            try {
                const NativeSetter = Object.getOwnPropertyDescriptor(
                    nativeInput.tagName === "TEXTAREA"
                        ? window.HTMLTextAreaElement.prototype
                        : window.HTMLInputElement.prototype,
                    "value"
                )?.set;
                if (NativeSetter) {
                    NativeSetter.call(nativeInput, value);
                } else {
                    nativeInput.value = value;
                }
            } catch (_) {
                nativeInput.value = value;
            }
            nativeInput.dispatchEvent(new Event("input", { bubbles: true }));
            nativeInput.dispatchEvent(new Event("change", { bubbles: true }));
            nativeInput.dispatchEvent(new Event("blur", { bubbles: true }));
            filled++;
            log(`  📝 已填入第 ${idx + 1} 空: ${value}`);
        });
        return filled > 0;
    };

    const sanitizeLetter = (value = "") =>
        String(value)
            .toUpperCase()
            .replace(/[^A-Z]/g, "");

    const normalizeAnswerLetters = (value) => {
        if (Array.isArray(value)) {
            return value.map(sanitizeLetter).filter(Boolean);
        }
        if (typeof value === "object" && value !== null) {
            if (value.answer !== undefined) {
                return normalizeAnswerLetters(value.answer);
            }
            if (value.option !== undefined) {
                return normalizeAnswerLetters(value.option);
            }
            return [];
        }
        if (value === undefined || value === null) return [];
        return String(value)
            .toUpperCase()
            .split(/[^A-Z]+/)
            .map((part) => part.trim())
            .map(sanitizeLetter)
            .filter(Boolean);
    };

    const getQuestionIndex = (questionBox, fallback) => {
        const numText = questionBox
            ?.querySelector(".item-num .num-box")
            ?.innerText?.trim();
        if (!numText) return fallback;
        const normalized = numText.replace(/[^0-9]/g, "");
        return normalized || fallback;
    };

    const detectQuestionType = (box, typeText = "") => {
        const text = typeText || "";
        if (text.includes("多选")) return "multiple";
        if (text.includes("判断")) return "judge";
        if (text.includes("填空") || box.querySelector(selectors.blankInput)) return "blank";
        // 用实际选项标签判断：checkbox → 多选, radio → 单选
        if (box.querySelector("label.el-checkbox")) return "multiple";
        if (box.querySelector("label.el-radio")) return "single";
        // 兜底：检查选项容器
        if (box.querySelector(".el-checkbox-group")) return "multiple";
        return "single";
    };

    const extractAllQuestions = () => {
        const boxes = Array.from(document.querySelectorAll(selectors.questionBox));
        return boxes
            .map((box, idx) => {
                const index = getQuestionIndex(box, `${idx + 1}`);
                const questionText = box.querySelector(selectors.questionText)?.innerText.trim();
                const typeText = box
                    .querySelector(".question-type .el-tag__content")
                    ?.innerText?.trim();
                const selectionType = detectQuestionType(box, typeText);
                const options = Array.from(box.querySelectorAll(selectors.optionLabel)).map(
                    (label, optionIdx) => {
                        const letterText = label
                            .querySelector(".choices-label")
                            ?.innerText?.trim();
                        const letter =
                            sanitizeLetter(letterText) || String.fromCharCode(65 + optionIdx);
                        const text =
                            label.querySelector(selectors.optionText)?.innerText.trim() || "";
                        return { letter, text };
                    }
                );
                const hasImage = !!box.querySelector("img");
                if (selectionType === "blank") {
                    // 填空题：允许空文本（可能图片题干），但必须有输入框
                    if (box.querySelectorAll(selectors.blankInput).length === 0) return null;
                } else {
                    if (!questionText || options.length === 0) return null;
                }
                const result = {
                    index,
                    boxIndex: idx,
                    type: typeText || "",
                    selectionType,
                    question: questionText || (hasImage ? "[图片题干]" : ""),
                    options,
                    isImage: hasImage,
                };
                if (selectionType === "blank") {
                    result.blankCount = box.querySelectorAll(selectors.blankInput).length;
                }
                return result;
            })
            .filter(Boolean);
    };

    const buildBulkPrompt = (questions) => {
        // 过滤图片题干：DeepSeek 不支持视觉，跳过
        const imageQuestions = questions.filter((q) => q.isImage);
        const textQuestions = questions.filter((q) => !q.isImage);
        if (imageQuestions.length > 0) {
            log(`🖼️ 跳过 ${imageQuestions.length} 道图片题干题目（第 ${imageQuestions.map((q) => q.index).join("、")} 题），请手动填写。`);
        }
        if (textQuestions.length === 0) return null;
        const serialized = JSON.stringify(textQuestions, null, 2);
        if (bulkPromptTemplate.includes("{{questions}}")) {
            return bulkPromptTemplate.replace("{{questions}}", serialized);
        }
        return `${bulkPromptTemplate}\n\n题目数据：\n${serialized}`;
    };

    const extractJsonFromResponse = (text) => {
        if (!text) return null;
        let cleaned = text.trim();
        cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
        try {
            return JSON.parse(cleaned);
        } catch (e) {
            // 尝试截取第一个 {...}
            const first = cleaned.indexOf("{");
            const last = cleaned.lastIndexOf("}");
            if (first !== -1 && last !== -1 && last > first) {
                const snippet = cleaned.slice(first, last + 1);
                try {
                    return JSON.parse(snippet);
                } catch (err) {
                    console.warn("无法解析 AI JSON", err);
                }
            }
        }
        return null;
    };

    const requestBulkAnswers = (prompt) => {
        return new Promise((resolve, reject) => {
            aiConfig.apiKey = GM_getValue("apiKey", "");
            if (!aiConfig.apiKey) {
                log("❌ 错误：请先配置API Key。");
                return reject(new Error("API Key not set"));
            }
            GM_xmlhttpRequest({
                method: "POST",
                url: aiConfig.apiEndpoint,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${aiConfig.apiKey}`,
                },
                data: JSON.stringify({
                    model: aiConfig.model,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0,
                }),
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
               },
                onerror: (err) => reject(new Error("AI请求失败: " + err.statusText)),
            });
        });
    };

    async function selectOptionByLetter(questionBox, letters, selectionType = "single") {
        if (!letters || letters.length === 0) return false;
        const options = Array.from(questionBox.querySelectorAll(selectors.optionLabel));
        if (options.length === 0) return false;
        const letterMap = new Map();
        options.forEach((label, idx) => {
            const letterText = label.querySelector(".choices-label")?.innerText?.trim();
            const letter = sanitizeLetter(letterText) || String.fromCharCode(65 + idx);
            letterMap.set(letter, label);
        });
        let selected = false;
        const targetLetters = selectionType === "multiple" ? letters : [letters[0]];
        for (const letter of targetLetters) {
            const optionLabel = letterMap.get(letter);
            if (!optionLabel) continue;
            if (!optionLabel.classList.contains("is-checked")) {
                optionLabel.click();
                await wait(150);
            }
            selected = true;
        }
        return selected;
    }

    const applyBulkAnswers = async (answerMap, questionsMeta) => {
        const boxes = Array.from(document.querySelectorAll(selectors.questionBox));
        const boxByIndex = new Map();
        boxes.forEach((box, idx) => {
            boxByIndex.set(idx, box);
        });

        for (const question of questionsMeta) {
            const targetBox = boxByIndex.get(question.boxIndex);
            if (!targetBox) {
                log(`⚠️ 未找到题号 ${question.index} 对应的题目。`);
                continue;
            }
            const rawAnswer =
                answerMap?.[question.index] ??
                answerMap?.[question.index.replace(/\.$/, "")] ??
                answerMap?.[String(parseInt(question.index, 10))];
            if (rawAnswer === undefined || rawAnswer === null) {
                log(`⚠️ AI 未返回题号 ${question.index} 的答案。`);
                continue;
            }

            /* ---- 填空题 ---- */
            if (question.selectionType === "blank") {
                const blankAnswers = Array.isArray(rawAnswer)
                    ? rawAnswer
                    : [String(rawAnswer)];
                const ok = fillBlankInputs(targetBox, blankAnswers);
                if (ok) {
                    log(`✅ 题号 ${question.index} 已填入答案: ${blankAnswers.join("、")}`);
                } else {
                    log(`⚠️ 题号 ${question.index} 填空填入失败。`);
                }
                continue;
            }

            const letters = normalizeAnswerLetters(rawAnswer);
            if (letters.length === 0) {
                log(
                    `⚠️ 无法解析题号 ${question.index} 的答案：${JSON.stringify(rawAnswer)}`
                );
                continue;
            }
            if (question.selectionType !== "multiple" && letters.length > 1) {
                log(
                    `⚠️ 题号 ${question.index} 为${question.selectionType}题，但 AI 返回多个选项，将只取第一个。`
                );
            }
            const success = await selectOptionByLetter(
                targetBox,
                letters,
                question.selectionType
            );
            if (success) {
                log(`✅ 题号 ${question.index} 已填入选项 ${letters.join(",")}`);
            } else {
                log(`⚠️ 题号 ${question.index} 的选项 ${letters.join(",")} 未匹配。`);
            }
        }
    };

    document
        .getElementById("ai-single-solve-btn")
        .addEventListener("click", async () => {
            const questionBox = document.querySelector(
                `${selectors.questionBox}:not([style*="display: none"])`
            );
            if (!questionBox) {
                log("❌ 未找到当前题目。");
                return;
            }
            try {
                log("正在请求AI解答本题...");
                const result = await getAiAnswer(questionBox);
                if (result && result.answers && result.answers.length > 0) {
                    if (result.type === "blank") {
                        fillBlankInputs(questionBox, result.answers);
                    } else {
                        await selectOptionByText(questionBox, result.answers);
                    }
                } else {
                    log("⚠️ AI未能提供有效答案。");
                }
            } catch (error) {
                log(`❌ AI搜题出错: ${error}`);
            }
        });

    const answerAllBtn = document.getElementById("answer-all-btn");
    const setBulkBtnState = (running) => {
        if (!answerAllBtn) return;
        if (running) {
            answerAllBtn.innerText = "🛑 取消批量答题";
            answerAllBtn.disabled = false;
            answerAllBtn.classList.remove("btn-info");
            answerAllBtn.classList.add("btn-danger");
        } else {
            answerAllBtn.innerText = "🧠 一键提取并答完所有题目";
            answerAllBtn.disabled = false;
            answerAllBtn.classList.remove("btn-danger");
            answerAllBtn.classList.add("btn-info");
        }
    };

    const TYPE_NAMES = { single: "单选题", multiple: "多选题", judge: "判断题", blank: "填空题" };
    const TYPE_ORDER = ["single", "multiple", "judge", "blank"];

    answerAllBtn?.addEventListener("click", async () => {
        if (isBulkJsonAnswering) {
            isBulkJsonAnswering = false;
            setBulkBtnState(false);
            log("🛑 已取消批量答题。");
            return;
        }
        try {
            isBulkJsonAnswering = true;
            setBulkBtnState(true);
            const allQuestions = extractAllQuestions();
            if (allQuestions.length === 0) {
                log("❌ 未检测到可解析的题目。");
                return;
            }
            log(`🧠 已提取 ${allQuestions.length} 道题，按题型分组答题中...`);
            // 按题型分组
            const typeGroups = {};
            for (const q of allQuestions) {
                if (!typeGroups[q.selectionType]) typeGroups[q.selectionType] = [];
                typeGroups[q.selectionType].push(q);
            }
            let totalAnswered = 0;
            for (const selType of TYPE_ORDER) {
                const group = typeGroups[selType];
                if (!group || group.length === 0) continue;
                if (!isBulkJsonAnswering) break;
                const typeName = TYPE_NAMES[selType] || selType;
                log(`📋 ${typeName}（${group.length} 题），正在请求 AI...`);
                const prompt = buildBulkPrompt(group);
                if (!prompt) continue;
                const answerMap = await requestBulkAnswers(prompt);
                if (!isBulkJsonAnswering) { log("🛑 批量答题已取消。"); break; }
                if (!answerMap || Object.keys(answerMap).length === 0) {
                    log(`⚠️ AI 未返回${typeName}的任何答案。`);
                    continue;
                }
                await applyBulkAnswers(answerMap, group);
                totalAnswered += group.length;
            }
            if (!isBulkJsonAnswering) return;
            log(`🎉 批量答题完成（共 ${totalAnswered} 题已填入），请检查后提交。`);
        } catch (error) {
            log(`❌ 一键答题失败：${error && error.message ? error.message : error}`);
        } finally {
            isBulkJsonAnswering = false;
            setBulkBtnState(false);
        }
    });

    // --- 全自动答题逻辑 ---
    function isLastQuestion() {
        const allNumbers = document.querySelectorAll(selectors.answerCardNumbers);
        if (allNumbers.length === 0) return false;
        const activeNumberEl = document.querySelector(
            selectors.activeAnswerCardNumber
        );
        if (!activeNumberEl) return false;
        const lastNumberEl = allNumbers[allNumbers.length - 1];
        if (activeNumberEl.innerText.trim() === lastNumberEl.innerText.trim()) {
            return true;
        }
        return false;
    }

    const fullAutoBtn = document.getElementById("full-auto-btn");
    const stopAutoAnswering = () => {
        isAutoAnswering = false;
        fullAutoBtn.innerText = "⚡️ 开始全自动 AI 答题";
        fullAutoBtn.classList.remove("btn-danger");
        fullAutoBtn.classList.add("btn-primary");
        log("🔴 全自动答题已停止。");
    };

    const runAutoAnswerStep = async () => {
        if (!isAutoAnswering) return;
        const questionBox = document.querySelector(
            `${selectors.questionBox}:not([style*="display: none"])`
        );
        if (!questionBox) {
            log("🏁 未找到题目，流程结束。");
            stopAutoAnswering();
            return;
        }

        try {
            const result = await getAiAnswer(questionBox);
            if (!isAutoAnswering) return;
            if (result && result.answers && result.answers.length > 0) {
                if (result.type === "blank") {
                    fillBlankInputs(questionBox, result.answers);
                } else {
                    await selectOptionByText(questionBox, result.answers);
                }
            } else {
                log("⚠️ AI未能提供答案，跳过本题。");
            }
        } catch (error) {
            log(`❌ AI搜题出错: ${error}`);
            stopAutoAnswering();
            return;
        }

        if (isLastQuestion()) {
            log("🏁 已到达最后一题（答题卡判断），自动循环停止。");
            stopAutoAnswering();
            return;
        }

        const delay = 2500 + Math.random() * 1000;
        log(`...等待 ${delay / 1000} 秒后进入下一题...`);

        setTimeout(() => {
            if (!isAutoAnswering) return;
            const clickedNext = clickButton(
                selectors.nextButton,
                "自动点击“下一题”。",
                "⚠️ 未找到或隐藏了“下一题”按钮。"
            );

            if (!clickedNext) {
                log("🏁 已到达最后一题（按钮判断），自动循环停止。");
                stopAutoAnswering();
            } else {
                setTimeout(runAutoAnswerStep, 1500);
            }
        }, delay);
    };

    fullAutoBtn.addEventListener("click", () => {
        if (isAutoAnswering) {
            stopAutoAnswering();
        } else {
            isAutoAnswering = true;
            fullAutoBtn.innerText = "🛑 停止全自动答题";
            fullAutoBtn.classList.remove("btn-primary");
            fullAutoBtn.classList.add("btn-danger");
            log("🟢 全自动答题已启动...");
            runAutoAnswerStep();
        }
    });
})();
