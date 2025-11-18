// ==UserScript==
// @name         NEUMOOC 智能助手
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  NEUMOOC 智能助手：导出题目JSON并根据答案JSON自动填充
// @author       LuBanQAQ
// @license      MIT
// @match        https://neustudydl.neumooc.com/*
// @downloadURL  https://github.com/renyancheng/neumooc-script/raw/refs/heads/main/neumooc-script.user.js
// @updateURL    https://github.com/renyancheng/neumooc-script/raw/refs/heads/main/neumooc-script.user.js
// @grant        GM_addStyle
// ==/UserScript==

(function () {
	"use strict";

	const selectors = {
		questionBox: ".item-box",
		questionText: ".qusetion-info > .info-item > .value",
		optionLabel: ".choices > label.el-radio, .choices > label.el-checkbox",
		optionText:
			".el-radio__label .choices-html, .el-checkbox__label .choices-html",
		optionInput: "input[type='radio'], input[type='checkbox']",
	};

	GM_addStyle(`
        #neumooc-helper-panel { position: fixed; top: 120px; right: 24px; width: 320px; background: #f7f8fa; border: 1px solid #c9d2f0; border-radius: 10px; box-shadow: 0 8px 20px rgba(36, 95, 230, 0.18); font-family: Arial, sans-serif; color: #1f2a44; z-index: 100000; }
    #neumooc-helper-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: linear-gradient(135deg, #245fe6, #5d8bf7); color: #fff; border-top-left-radius: 10px; border-top-right-radius: 10px; font-size: 14px; font-weight: 600; cursor: move; }
        #neumooc-helper-toggle { border: none; background: rgba(255,255,255,0.22); color: #fff; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-size: 14px; line-height: 20px; text-align: center; }
        #neumooc-helper-toggle:hover { background: rgba(255,255,255,0.35); }
        #neumooc-helper-body { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        #neumooc-helper-panel.minimized #neumooc-helper-body { display: none; }
    #neumooc-helper-panel.minimized { width: 48px; height: 48px; border-radius: 50%; padding: 0; }
    #neumooc-helper-panel.minimized #neumooc-helper-header { padding: 0; height: 100%; width: 100%; border-radius: 50%; justify-content: center; }
    #neumooc-helper-panel.minimized #neumooc-helper-title { display: none; }
	#neumooc-helper-panel.minimized #neumooc-helper-toggle { width: 100%; height: 100%; border-radius: 50%; background: #245fe6; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; line-height: 1; padding: 0; }
        #neumooc-helper-panel button.action-btn { padding: 10px; border: none; border-radius: 6px; background: #245fe6; color: #fff; cursor: pointer; font-size: 13px; font-weight: 500; text-align: center; }
        #neumooc-helper-panel button.action-btn:hover { background: #1c4cd1; }
        #answer-json-input { min-height: 100px; resize: vertical; border: 1px solid #bac7f4; border-radius: 6px; padding: 8px; font-size: 12px; font-family: Consolas, "Courier New", monospace; }
        #neumooc-helper-log { max-height: 140px; overflow-y: auto; background: #fff; border: 1px solid #e0e6fb; border-radius: 6px; padding: 8px; font-size: 12px; line-height: 1.4; }
        #neumooc-helper-log div { margin-bottom: 4px; }
    `);

	const panel = document.createElement("div");
	panel.id = "neumooc-helper-panel";
	panel.innerHTML = `
        <div id="neumooc-helper-header">
            <span id="neumooc-helper-title">📘 题目助手 v2.0.0</span>
			<button id="neumooc-helper-toggle" type="button">–</button>
        </div>
        <div id="neumooc-helper-body">
            <button id="copy-questions-btn" class="action-btn" type="button">复制题目 JSON</button>
            <textarea id="answer-json-input" placeholder="在此粘贴 AI 返回的答案 JSON" spellcheck="false"></textarea>
            <button id="fill-answers-btn" class="action-btn" type="button">根据 JSON 填充答案</button>
            <div id="neumooc-helper-log"><div>${timestamp()}: 等待操作...</div></div>
        </div>
    `;
	document.body.appendChild(panel);

	const toggleBtn = document.getElementById("neumooc-helper-toggle");
	const header = document.getElementById("neumooc-helper-header");

	let isDragging = false;
	let dragDidMove = false;
	let dragOffsetX = 0;
	let dragOffsetY = 0;

	const beginDrag = (event) => {
		if (event.button !== 0) return;
		event.preventDefault();
		isDragging = true;
		dragDidMove = false;
		const rect = panel.getBoundingClientRect();
		dragOffsetX = event.clientX - rect.left;
		dragOffsetY = event.clientY - rect.top;
		panel.style.left = `${rect.left}px`;
		panel.style.top = `${rect.top}px`;
		panel.style.right = "auto";
		panel.style.bottom = "auto";
		document.body.style.userSelect = "none";
	};

	header.addEventListener("mousedown", (event) => {
		beginDrag(event);
	});

	document.addEventListener("mousemove", (event) => {
		if (!isDragging) return;
		dragDidMove = true;
		const panelWidth = panel.offsetWidth;
		const panelHeight = panel.offsetHeight;
		const maxLeft = window.innerWidth - panelWidth - 8;
		const maxTop = window.innerHeight - panelHeight - 8;
		const nextLeft = Math.max(
			8,
			Math.min(event.clientX - dragOffsetX, maxLeft)
		);
		const nextTop = Math.max(
			8,
			Math.min(event.clientY - dragOffsetY, maxTop)
		);
		panel.style.left = `${nextLeft}px`;
		panel.style.top = `${nextTop}px`;
	});

	document.addEventListener("mouseup", () => {
		if (!isDragging) return;
		isDragging = false;
		document.body.style.userSelect = "";
		const moved = dragDidMove;
		dragDidMove = false;
		if (moved) {
			toggleBtn.dataset.skipClick = "1";
		}
	});

	toggleBtn.addEventListener("click", (event) => {
		if (toggleBtn.dataset.skipClick === "1") {
			event.preventDefault();
			event.stopPropagation();
			delete toggleBtn.dataset.skipClick;
			return;
		}
		panel.classList.toggle("minimized");
		toggleBtn.textContent = panel.classList.contains("minimized")
			? "☰"
			: "–";
	});

	const log = (message) => {
		const logArea = document.getElementById("neumooc-helper-log");
		if (!logArea) return;
		const entry = document.createElement("div");
		entry.textContent = `${timestamp()}: ${message}`;
		logArea.appendChild(entry);
		while (logArea.children.length > 80) {
			logArea.removeChild(logArea.firstChild);
		}
		logArea.scrollTop = logArea.scrollHeight;
	};

	document
		.getElementById("copy-questions-btn")
		.addEventListener("click", () => {
			const snapshot = collectQuestions({ includeDom: false });
			if (snapshot.length === 0) {
				log("未找到任何题目，请确保题目已经加载。");
				return;
			}
			const exportPayload = {
				generatedAt: new Date().toISOString(),
				questionCount: snapshot.length,
				questions: snapshot,
			};
			const prettyJson = JSON.stringify(exportPayload, null, 2);
			const prompt = buildAiPrompt(snapshot.length);
			const combined = `${prompt}\n\n${prettyJson}`;
			copyToClipboard(combined)
				.then(() =>
					log(
						`已复制 ${snapshot.length} 道题目及 AI prompt 到剪贴板。`
					)
				)
				.catch((err) => {
					console.error(err);
					log("复制失败，请手动复制面板中的 prompt+JSON。");
					showTextInTextarea(combined);
				});
		});

	document
		.getElementById("fill-answers-btn")
		.addEventListener("click", () => {
			const textarea = document.getElementById("answer-json-input");
			const raw = textarea.value.trim();
			if (!raw) {
				log("请先粘贴答案 JSON。");
				return;
			}
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch (error) {
				log("JSON 解析失败: " + error.message);
				return;
			}

			const preparedEntries = normalizeAnswerPayload(parsed);
			if (preparedEntries.length === 0) {
				log("未找到有效答案条目，请检查 JSON 格式。");
				return;
			}

			const questionSnapshot = collectQuestions({ includeDom: true });
			if (questionSnapshot.length === 0) {
				log("题目列表为空，无法填充答案。");
				return;
			}

			let matchedQuestions = 0;
			let totalSelections = 0;

			for (const entry of preparedEntries) {
				const prepared = prepareAnswerEntry(entry);
				if (!prepared) {
					log("跳过无法解析的答案项: " + safeStringify(entry));
					continue;
				}
				if (prepared.choices.length === 0) {
					log("答案项缺少 choices: " + safeStringify(entry));
					continue;
				}

				const targetQuestion = findMatchingQuestion(
					prepared,
					questionSnapshot
				);
				if (!targetQuestion) {
					log(`未匹配到题目: ${describeAnswerTarget(prepared)}。`);
					continue;
				}

				const matches = selectOptionsForQuestion(
					targetQuestion,
					prepared.choices
				);
				matchedQuestions += matches > 0 ? 1 : 0;
				totalSelections += matches;

				log(
					`题目 ${
						targetQuestion.numberLabel || targetQuestion.index
					} 选中 ${matches}/${prepared.choices.length} 个选项。`
				);
			}

			if (totalSelections === 0) {
				log("未成功填充任何选项，请确认题目匹配和选项标识是否一致。");
			} else {
				log(
					`填充完成，共匹配 ${matchedQuestions} 道题，选择 ${totalSelections} 个选项。`
				);
			}
		});

	function collectQuestions(options = {}) {
		const { includeDom = false } = options;
		const boxes = Array.from(
			document.querySelectorAll(selectors.questionBox)
		);
		const questions = [];

		boxes.forEach((box, index) => {
			const questionIndex = index + 1;
			const questionTextElement = findQuestionTextElement(box);
			const questionText = cleanText(
				questionTextElement
					? questionTextElement.textContent
					: box.textContent || ""
			);
			if (!questionText) return;

			const optionLabels = Array.from(
				box.querySelectorAll(selectors.optionLabel)
			);
			const optionsList = optionLabels.map((label, optionIndex) => {
				const input = label.querySelector(selectors.optionInput);
				const optionTextElement =
					label.querySelector(selectors.optionText) ||
					label.querySelector(".choices-html") ||
					label.querySelector(".el-radio__label") ||
					label;
				const text = cleanText(
					optionTextElement
						? optionTextElement.textContent
						: label.textContent || ""
				);
				const key = String.fromCharCode(65 + optionIndex);
				const valueAttr = input
					? input.value || input.getAttribute("value")
					: label.getAttribute("data-value");
				const optionInfo = {
					key,
					text,
				};
				if (valueAttr) {
					optionInfo.value = valueAttr;
				}
				if (includeDom) {
					optionInfo._label = label;
				}
				return optionInfo;
			});

			if (optionsList.length === 0) return;

			const info = {
				index: questionIndex,
				id: getQuestionId(box),
				numberLabel: getQuestionNumberLabel(box, questionIndex),
				type: getQuestionType(box),
				isMultiple: detectMultiple(box),
				text: questionText,
				options: optionsList,
			};

			if (includeDom) {
				info._element = box;
			}

			questions.push(info);
		});

		return questions;
	}

	function findQuestionTextElement(box) {
		const candidates = [
			selectors.questionText,
			".question-title .value",
			".question-title",
			".title .value",
			".title",
			".stem",
			".question-stem",
			".info-item .value",
		];
		for (const selector of candidates) {
			const el = selector ? box.querySelector(selector) : null;
			if (el && cleanText(el.textContent)) {
				return el;
			}
		}
		return null;
	}

	function detectMultiple(box) {
		return !!box.querySelector('input[type="checkbox"]');
	}

	function getQuestionId(box) {
		return (
			box.getAttribute("data-question-id") ||
			box.getAttribute("data-id") ||
			box.id ||
			null
		);
	}

	function getQuestionNumberLabel(box, fallbackIndex) {
		const attrCandidates = [
			box.getAttribute("data-order"),
			box.getAttribute("data-index"),
			box.getAttribute("data-number"),
		];
		for (const attr of attrCandidates) {
			if (attr && attr.trim()) return attr.trim();
		}

		const selectorsToCheck = [
			".question-index",
			".q-index",
			".order-num",
			".num",
			".question-num",
			"[class*='question-index']",
			"[class*='ques-index']",
		];
		for (const selector of selectorsToCheck) {
			const el = box.querySelector(selector);
			const text = cleanText(el ? el.textContent : "");
			if (text) return text;
		}

		const infoItems = box.querySelectorAll(".info-item");
		for (const item of infoItems) {
			const label = cleanText(
				item.querySelector(".label")?.textContent || ""
			);
			const value = cleanText(
				item.querySelector(".value")?.textContent || ""
			);
			if (label && /题号|编号/.test(label) && value) {
				return value;
			}
		}

		return String(fallbackIndex);
	}

	function getQuestionType(box) {
		const attrCandidates = [
			box.getAttribute("data-question-type"),
			box.getAttribute("data-type"),
		];
		for (const attr of attrCandidates) {
			if (attr && attr.trim()) return attr.trim();
		}

		const selectorsToCheck = [
			".question-type",
			".q-type",
			".ques-type",
			".type-name",
			".question-title .type",
			".info-item .value .type",
			".info-item .type",
			".question-head .type",
		];
		for (const selector of selectorsToCheck) {
			const el = box.querySelector(selector);
			const text = cleanText(el ? el.textContent : "");
			if (text) return text;
		}

		const infoItems = box.querySelectorAll(".info-item");
		for (const item of infoItems) {
			const label = cleanText(
				item.querySelector(".label")?.textContent || ""
			);
			const value = cleanText(
				item.querySelector(".value")?.textContent || ""
			);
			if (label && /题型|类型/.test(label) && value) {
				return value;
			}
		}

		return "unknown";
	}

	function normalizeAnswerPayload(payload) {
		if (Array.isArray(payload)) {
			return payload;
		}
		if (payload && typeof payload === "object") {
			if (Array.isArray(payload.answers)) {
				return payload.answers;
			}
			if (Array.isArray(payload.questions)) {
				return payload.questions;
			}
			const entries = [];
			for (const key of Object.keys(payload)) {
				entries.push({ key, value: payload[key] });
			}
			return entries;
		}
		return [];
	}

	function prepareAnswerEntry(entry) {
		if (!entry || typeof entry !== "object") {
			return null;
		}

		const prepared = {
			raw: entry,
			choices: extractChoices(entry),
		};

		const id = entry.id || entry.questionId || entry.qid;
		if (id) {
			prepared.id = String(id).trim();
		}

		const indexCandidates = [
			entry.index,
			entry.idx,
			entry.questionIndex,
			entry.order,
		];
		for (const candidate of indexCandidates) {
			if (candidate !== undefined && candidate !== null) {
				const numericIndex = Number.parseInt(candidate, 10);
				if (Number.isFinite(numericIndex)) {
					prepared.index = numericIndex;
					break;
				}
			}
		}

		const numberCandidates = [
			entry.number,
			entry.questionNumber,
			entry.no,
			entry.label,
			entry.key,
		];
		for (const candidate of numberCandidates) {
			if (!candidate) continue;
			const text = String(candidate).trim();
			if (!text) continue;
			prepared.number = text;
			if (prepared.index === undefined) {
				const parsed = parseIndexFromString(text);
				if (parsed !== null) {
					prepared.index = parsed;
				}
			}
			break;
		}

		if (prepared.index === undefined && entry.key) {
			const parsed = parseIndexFromString(String(entry.key));
			if (parsed !== null) {
				prepared.index = parsed;
			}
		}

		return prepared;
	}

	function extractChoices(entry) {
		if (!entry) return [];
		const primary =
			entry.choices ??
			entry.choice ??
			entry.answers ??
			entry.answer ??
			entry.value;
		return toChoiceArray(primary);
	}

	function toChoiceArray(value) {
		if (Array.isArray(value)) {
			return value.flatMap((item) => toChoiceArray(item));
		}
		if (value === undefined || value === null) {
			return [];
		}
		if (typeof value === "string") {
			const trimmed = value.trim();
			if (!trimmed) return [];
			if (/^[A-Za-z]+$/.test(trimmed) && trimmed.length > 1) {
				return trimmed.split("");
			}
			const parts = trimmed
				.split(/[,，;；]+/)
				.map((part) => part.trim())
				.filter(Boolean);
			return parts.length > 0 ? parts : [trimmed];
		}
		if (typeof value === "number") {
			return [value];
		}
		if (typeof value === "object") {
			return [value];
		}
		return [];
	}

	function parseIndexFromString(value) {
		if (value === undefined || value === null) return null;
		const match = String(value).match(/\d+/);
		return match ? Number.parseInt(match[0], 10) : null;
	}

	function findMatchingQuestion(entry, questions) {
		if (entry.id) {
			const foundById = questions.find(
				(q) =>
					q.id &&
					String(q.id).toLowerCase() === entry.id.toLowerCase()
			);
			if (foundById) return foundById;
		}
		if (entry.index !== undefined) {
			const foundByIndex = questions.find(
				(q) => Number(q.index) === Number(entry.index)
			);
			if (foundByIndex) return foundByIndex;
		}
		if (entry.number) {
			const normalizedTarget = normalizeText(entry.number);
			const foundByNumber = questions.find(
				(q) =>
					normalizeText(String(q.numberLabel || q.index)) ===
					normalizedTarget
			);
			if (foundByNumber) return foundByNumber;
		}
		if (entry.number) {
			const parsed = parseIndexFromString(entry.number);
			if (parsed !== null) {
				const foundByParsed = questions.find(
					(q) => Number(q.index) === parsed
				);
				if (foundByParsed) return foundByParsed;
			}
		}
		if (entry.text) {
			const textNorm = normalizeText(entry.text);
			const foundByText = questions.find((q) =>
				normalizeText(q.text).includes(textNorm)
			);
			if (foundByText) return foundByText;
		}
		return null;
	}

	function selectOptionsForQuestion(question, choices) {
		if (!question || !Array.isArray(question.options)) return 0;
		const tokens = choices
			.map((choice) => normalizeChoiceToken(choice))
			.filter(Boolean);
		if (tokens.length === 0) return 0;

		let matched = 0;
		const usedOptions = new Set();

		for (const token of tokens) {
			const option = findOptionByToken(
				question.options,
				token,
				usedOptions
			);
			if (!option) {
				log(
					`题目 ${
						question.numberLabel || question.index
					} 未匹配选项: ${token.original}`
				);
				continue;
			}
			const triggered = triggerOption(option);
			if (triggered) {
				matched += 1;
				usedOptions.add(option);
			}
		}

		return matched;
	}

	function normalizeChoiceToken(raw) {
		if (raw === undefined || raw === null) return null;
		if (typeof raw === "object" && !Array.isArray(raw)) {
			if (raw.key || raw.letter) {
				const letter = String(raw.key || raw.letter)
					.trim()
					.toUpperCase();
				if (/^[A-Z]$/.test(letter)) {
					return { kind: "letter", value: letter, original: letter };
				}
			}
			if (raw.value) {
				const valueText = String(raw.value).trim();
				if (valueText)
					return {
						kind: "value",
						value: valueText,
						original: valueText,
					};
			}
			if (raw.text || raw.option) {
				const optionText = String(raw.text || raw.option).trim();
				if (optionText)
					return {
						kind: "text",
						value: optionText,
						original: optionText,
					};
			}
			if (Array.isArray(raw)) {
				return normalizeChoiceToken(raw[0]);
			}
			return null;
		}

		if (typeof raw === "number") {
			if (raw >= 1 && raw <= 26) {
				const letter = String.fromCharCode(64 + raw);
				return { kind: "letter", value: letter, original: String(raw) };
			}
			return { kind: "text", value: String(raw), original: String(raw) };
		}

		const text = String(raw).trim();
		if (!text) return null;
		if (/^[A-Z]$/i.test(text)) {
			return {
				kind: "letter",
				value: text.toUpperCase(),
				original: text,
			};
		}
		return { kind: "text", value: text, original: text };
	}

	function findOptionByToken(options, token, used) {
		const isUnused = (option) => !used.has(option);

		if (token.kind === "letter") {
			const match = options.find(
				(option) =>
					isUnused(option) &&
					option.key &&
					option.key.toUpperCase() === token.value
			);
			if (match) return match;
		}

		if (token.kind === "value") {
			const normalized = token.value.toLowerCase();
			const match = options.find((option) => {
				if (!isUnused(option)) return false;
				if (!option.value) return false;
				return String(option.value).toLowerCase() === normalized;
			});
			if (match) return match;
		}

		if (token.kind === "text") {
			const normalized = normalizeText(token.value);
			let match = options.find((option) => {
				if (!isUnused(option)) return false;
				return normalizeText(option.text) === normalized;
			});
			if (match) return match;

			match = options.find((option) => {
				if (!isUnused(option)) return false;
				return normalizeText(option.text).includes(normalized);
			});
			if (match) return match;
		}

		return null;
	}

	function triggerOption(option) {
		if (!option || !option._label) return false;
		const label = option._label;
		const input = label.querySelector(selectors.optionInput);
		if (input) {
			const isRadio = input.type === "radio";
			if (!input.checked || !isRadio) {
				label.click();
				return true;
			}
			return input.checked;
		}
		label.click();
		return true;
	}

	function describeAnswerTarget(entry) {
		if (entry.id) return `id=${entry.id}`;
		if (entry.index !== undefined) return `index=${entry.index}`;
		if (entry.number) return `number=${entry.number}`;
		return safeStringify(entry.raw || entry);
	}

	function copyToClipboard(text) {
		if (navigator.clipboard && navigator.clipboard.writeText) {
			return navigator.clipboard.writeText(text);
		}
		return new Promise((resolve, reject) => {
			try {
				const textarea = document.createElement("textarea");
				textarea.style.position = "fixed";
				textarea.style.top = "-2000px";
				textarea.value = text;
				document.body.appendChild(textarea);
				textarea.focus();
				textarea.select();
				const succeeded = document.execCommand("copy");
				document.body.removeChild(textarea);
				succeeded ? resolve() : reject(new Error("execCommand 失败"));
			} catch (error) {
				reject(error);
			}
		});
	}

	function showTextInTextarea(text) {
		const textarea = document.getElementById("answer-json-input");
		if (!textarea) return;
		textarea.value = text;
		textarea.focus();
		textarea.select();
	}

	function cleanText(text) {
		if (!text) return "";
		return String(text).replace(/\s+/g, " ").trim();
	}

	function normalizeText(text) {
		return cleanText(text).toLowerCase();
	}

	function safeStringify(value) {
		try {
			return JSON.stringify(value);
		} catch (error) {
			return String(value);
		}
	}

	function timestamp() {
		const now = new Date();
		return now.toLocaleTimeString();
	}

	function buildAiPrompt(questionCount) {
		const countText =
			Number.isFinite(questionCount) && questionCount > 0
				? `${questionCount} 道`
				: "以下";
		return [
			"你是严谨的答题助手。",
			`请阅读${countText}题目的 JSON 数据，并返回一个 JSON 数组，每一项包含题目标识及答案。`,
			"输出示例:",
			"[",
			"  {",
			'    "index": 1,',
			'    "choices": ["A"]',
			"  }",
			"]",
			"若为多选题，请在 choices 中返回多个选项字母。",
			"不要输出其他解释，仅返回 JSON。",
		].join("\n");
	}
})();
