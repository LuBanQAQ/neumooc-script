// ==UserScript==
// @name         NEUMOOC 智能助手
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @description  NEUMOOC 智能助手 包含各种功能
// @author       LuBanQAQ
// @license      MIT
// @match        https://*.neumooc.com/*
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
题目 JSON 中包含 selectionType 字段（single/multiple/judge），请结合该字段决定答案格式。
1. 仅返回 JSON 对象，键为题目序号（index 字段），值为正确选项的大写字母。
2. 当 selectionType 为 single 时，值写单个字母，例如 "A"。
3. 当 selectionType 为 multiple 时，值写数组或用逗号分隔的多个大写字母，例如 ["A","C"] 或 "A,C"。
4. 当 selectionType 为 judge 时，使用 A 表示“正确”、B 表示“错误”。
5. 不要添加解释、Markdown、自然语言描述。

题目数据：
{{questions}}`;
    let bulkPromptTemplate = GM_getValue("bulkPromptTemplate", defaultBulkPrompt);

    let isAutoAnswering = false;
    let isBulkJsonAnswering = false;

    // --- GUI 样式 ---
    GM_addStyle(`
        #control-panel { position: fixed; top: 150px; right: 20px; width: 320px; background-color: #f1f1f1; border: 1px solid #d3d3d3; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); z-index: 100000; font-family: Arial, sans-serif; color: #333; }
        #control-panel-header { padding: 10px; cursor: move; background-color: #245FE6; color: white; border-top-left-radius: 8px; border-top-right-radius: 8px; display: flex; justify-content: flex-start; align-items: center; gap: 10px; }
        #control-panel-body { padding: 15px; display: block; max-height: 70vh; overflow-y: auto; }
        #control-panel-body.minimized { display: none; }
        #control-panel button { display: block; width: 100%; padding: 8px 12px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 4px; background-color: #fff; cursor: pointer; text-align: left; font-size: 13px; }
        #control-panel button:hover { background-color: #e9e9e9; }
        #control-panel .btn-primary { background-color: #245FE6; color: white; border-color: #245FE6; }
        #control-panel .btn-danger { background-color: #dc3545; color: white; border-color: #dc3545; }
    #control-panel .btn-info { background-color: #17a2b8; color: white; border-color: #17a2b8; }
    #control-panel input[type="text"] { width: 100%; padding: 6px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
    #control-panel textarea { width: 100%; padding: 6px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-family: inherit; font-size: 12px; resize: vertical; min-height: 120px; }
        #log-area { margin-top: 10px; padding: 8px; height: 120px; overflow-y: auto; background-color: #fff; border: 1px solid #ddd; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
        #minimize-btn { cursor: pointer; font-weight: bold; font-size: 18px; padding: 2px 6px; border-radius: 3px; background-color: transparent; transition: background-color 0.2s; }
        #minimize-btn:hover { background-color: rgba(255,255,255,0.2); }
        .collapsible-header { cursor: pointer; font-weight: bold; margin-top: 10px; padding-bottom: 5px; border-bottom: 1px solid #ccc; }
        .collapsible-content { display: none; padding-top: 10px; }
        .collapsible-content.visible { display: block; }

    /* 悬浮球样式 */
    #floating-ball { position: fixed; width: 48px; height: 48px; border-radius: 50%; background-color: #245FE6; color: #fff; display: none; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.2); z-index: 100001; cursor: move; user-select: none; }
    #floating-ball span { pointer-events: none; font-size: 18px; }
    `);

    // --- 创建 GUI ---
    const panel = document.createElement("div");
    panel.id = "control-panel";
    panel.innerHTML = `
        <div id="control-panel-header">
            <span id="minimize-btn">—</span>
            <span>🎓 智能助手 v1.0.2 </span>
        </div>
        <div id="control-panel-body">
            <div class="collapsible-header">⚙️ AI 配置 (点击展开)</div>
            <div class="collapsible-content">
                <label>API Key:</label>
                <input type="text" id="api-key-input" placeholder="输入你的 API Key">
                <label>API Endpoint:</label>
                <input type="text" id="api-endpoint-input">
                <label>Model:</label>
                <input type="text" id="model-input">
                <button id="save-config-btn">保存配置</button>
                <label>批量答题提示词（包含 {{questions}} 占位符）:</label>
                <textarea id="bulk-prompt-input" placeholder="自定义批量问答提示词，使用 {{questions}} 插入题目 JSON"></textarea>
                <button id="save-bulk-prompt-btn">保存提示词</button>
            </div>

            <div class="collapsible-header">🛠️ 辅助工具 (点击展开)</div>
            <div class="collapsible-content">
                <button id="copy-question-btn" class="btn-info">📋 复制当前题目和选项</button>
                <button id="test-prev-btn">◀️ “上一题”</button>
                <button id="test-next-btn">▶️ “下一题”</button>
                <button id="finish-video-btn">🎬 完成当前视频</button>
            </div>

            <p><b>核心功能:</b></p>
            <button id="ai-single-solve-btn">🤖 AI 解答当前题目</button>
            <button id="answer-all-btn" class="btn-info">🧠 一键提取并答完所有题目</button>
            <button id="full-auto-btn" class="btn-primary">⚡️ 开始全自动 AI 答题</button>
            <div id="log-area">等待操作...</div>
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

            // 再补一次 UI 层按钮的兼容（若存在“重新播放”按钮，说明已到末尾）
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
            const options = Array.from(
                questionBox.querySelectorAll(selectors.optionLabel)
            );
            const isMultiple =
                questionBox.querySelector(".el-checkbox-group") !== null;
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
        if (text.includes("多选") || box.querySelector(".el-checkbox-group")) {
            return "multiple";
        }
        if (text.includes("判断")) {
            return "judge";
        }
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
                if (!questionText || options.length === 0) {
                    return null;
                }
                return {
                    index,
                    type: typeText || "",
                    selectionType,
                    question: questionText,
                    options,
                };
            })
            .filter(Boolean);
    };

    const buildBulkPrompt = (questions) => {
        const serialized = JSON.stringify(questions, null, 2);
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
        const indexToBox = new Map();
        boxes.forEach((box, idx) => {
            const index = getQuestionIndex(box, `${idx + 1}`);
            if (!indexToBox.has(index)) {
                indexToBox.set(index, box);
            }
            const trimmed = index.replace(/\.$/, "");
            if (trimmed && !indexToBox.has(trimmed)) {
                indexToBox.set(trimmed, box);
            }
        });

        for (const question of questionsMeta) {
            const targetBox =
                indexToBox.get(question.index) ||
                indexToBox.get(question.index.replace(/\.$/, ""));
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
                const answers = await getAiAnswer(questionBox);
                if (answers && answers.length > 0) {
                    await selectOptionByText(questionBox, answers);
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
            answerAllBtn.innerText = "⏳ 正在批量答题...";
            answerAllBtn.disabled = true;
            answerAllBtn.classList.remove("btn-info");
            answerAllBtn.classList.add("btn-danger");
        } else {
            answerAllBtn.innerText = "🧠 一键提取并答完所有题目";
            answerAllBtn.disabled = false;
            answerAllBtn.classList.remove("btn-danger");
            answerAllBtn.classList.add("btn-info");
        }
    };

    answerAllBtn?.addEventListener("click", async () => {
        if (isBulkJsonAnswering) {
            log("⏳ 已在执行批量答题，请稍候...");
            return;
        }
        try {
            isBulkJsonAnswering = true;
            setBulkBtnState(true);
            const questions = extractAllQuestions();
            if (questions.length === 0) {
                log("❌ 未检测到可解析的题目。");
                return;
            }
            log(`🧠 已提取 ${questions.length} 道题，正在请求 AI...`);
            const prompt = buildBulkPrompt(questions);
            const answerMap = await requestBulkAnswers(prompt);
            if (!answerMap || Object.keys(answerMap).length === 0) {
                log("⚠️ AI 未返回任何可用答案。");
                return;
            }
            await applyBulkAnswers(answerMap, questions);
            log("🎉 批量答题完成，请检查后提交。");
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
            const answers = await getAiAnswer(questionBox);
            if (!isAutoAnswering) return;
            if (answers && answers.length > 0) {
                await selectOptionByText(questionBox, answers);
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
