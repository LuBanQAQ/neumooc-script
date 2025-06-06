// ==UserScript==
// @name         NEU MOOC 智能答题助手 (GitHub Release)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  功能集大成版。包含AI答题、多选等待、可靠的自动停止机制、SweetAlert2美化弹窗、可拖动/悬浮球最小化面板，并已配置GitHub自动更新。
// @author       LuBanQAQ
// @license      MIT
// @match        https://neustudydl.neumooc.com/*
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

    let isAutoAnswering = false;

    // --- GUI 样式 ---
    GM_addStyle(`
        #control-panel { position: fixed; top: 150px; right: 20px; width: 320px; background-color: #f1f1f1; border: 1px solid #d3d3d3; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); z-index: 100000; font-family: Arial, sans-serif; color: #333; }
        #control-panel-header { padding: 10px; cursor: move; background-color: #245FE6; color: white; border-top-left-radius: 8px; border-top-right-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
        #control-panel-body { padding: 15px; display: block; max-height: 70vh; overflow-y: auto; }
        #control-panel-body.minimized { display: none; }
        #control-panel button { display: block; width: 100%; padding: 8px 12px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 4px; background-color: #fff; cursor: pointer; text-align: left; font-size: 13px; }
        #control-panel button:hover { background-color: #e9e9e9; }
        #control-panel .btn-primary { background-color: #245FE6; color: white; border-color: #245FE6; }
        #control-panel .btn-danger { background-color: #dc3545; color: white; border-color: #dc3545; }
        #control-panel .btn-info { background-color: #17a2b8; color: white; border-color: #17a2b8; }
        #control-panel input[type="text"] { width: 100%; padding: 6px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        #log-area { margin-top: 10px; padding: 8px; height: 120px; overflow-y: auto; background-color: #fff; border: 1px solid #ddd; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
        #minimize-btn { cursor: pointer; font-weight: bold; font-size: 18px; }
        .collapsible-header { cursor: pointer; font-weight: bold; margin-top: 10px; padding-bottom: 5px; border-bottom: 1px solid #ccc; }
        .collapsible-content { display: none; padding-top: 10px; }
        .collapsible-content.visible { display: block; }
    `);

    // --- 创建 GUI ---
    const panel = document.createElement("div");
    panel.id = "control-panel";
    panel.innerHTML = `
        <div id="control-panel-header">
            <span>🎓 智能答题助手 v0.9.1 (最终版)</span>
            <span id="minimize-btn">—</span>
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
            </div>

            <div class="collapsible-header">🛠️ 辅助工具 (点击展开)</div>
            <div class="collapsible-content">
                <button id="copy-question-btn" class="btn-info">📋 复制当前题目和选项</button>
                <button id="test-prev-btn">◀️ 测试“上一题”</button>
                <button id="test-next-btn">▶️ 测试“下一题”</button>
            </div>

            <p><b>核心功能:</b></p>
            <button id="ai-single-solve-btn">🤖 AI 解答当前题目</button>
            <button id="full-auto-btn" class="btn-primary">⚡️ 开始全自动 AI 答题</button>
            <div id="log-area">等待操作...</div>
        </div>
    `;
    document.body.appendChild(panel);
    document.getElementById("api-key-input").value = GM_getValue("apiKey", "");
    document.getElementById("api-endpoint-input").value = GM_getValue(
        "apiEndpoint",
        "https://api.openai.com/v1/chat/completions"
    );
    document.getElementById("model-input").value = GM_getValue(
        "model",
        "gpt-3.5-turbo"
    );

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

    let isDragging = false,
        offsetX,
        offsetY;
    const panelHeader = document.getElementById("control-panel-header");
    panelHeader.addEventListener("mousedown", (e) => {
        isDragging = true;
        offsetX = e.clientX - panel.offsetLeft;
        offsetY = e.clientY - panel.offsetTop;
        document.body.style.userSelect = "none";
    });
    document.addEventListener("mousemove", (e) => {
        if (isDragging) {
            panel.style.left = `${e.clientX - offsetX}px`;
            panel.style.top = `${e.clientY - offsetY}px`;
        }
    });
    document.addEventListener("mouseup", () => {
        isDragging = false;
        document.body.style.userSelect = "auto";
    });
    document.getElementById("minimize-btn").addEventListener("click", (e) => {
        e.target.parentElement.nextElementSibling.classList.toggle("minimized");
        e.target.textContent = e.target.textContent === "—" ? "❏" : "—";
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
