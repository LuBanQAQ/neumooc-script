const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'neumooc-script.user.js'), 'utf8');
const helperStart = source.indexOf('    const isAnswerElementVisible');
const helperEnd = source.indexOf('    const buildBulkPrompt =', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'userscript helper section exists');

// These fixtures model the platform contract: a hidden input and a preview,
// a lazily shown editor, and separate editor/outer answer models. They do not
// load the full userscript, send AI requests, or claim server-save coverage.
function createHarness() {
    const logs = [];
    const root = { _vnode: { children: [] } };
    const questionBoxes = [];
    const decode = html => String(html)
        .replace(/<\/p>\s*<p>/g, '\n').replace(/<[^>]*>/g, '')
        .replace(/&quot;/g, '"').replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<').replace(/&amp;/g, '&');
    const document = {
        defaultView: { getComputedStyle: () => ({ visibility: 'visible' }) },
        querySelector: () => root,
        querySelectorAll: selector => selector === '.item-box' ? questionBoxes : [],
        createElement: () => ({
            html: '',
            set innerHTML(value) { this.html = value; },
            get textContent() { return decode(this.html); },
            querySelectorAll: () => [],
        }),
    };
    function element() {
        return {
            nodeType: 1, isConnected: true, ownerDocument: document,
            getClientRects: () => [{}], matches: () => false,
            querySelector: () => null, querySelectorAll: () => [], contains: () => false,
        };
    }
    function slot({ disabled = false, sync = true, exposeEditor = true } = {}) {
        const host = element();
        const editable = element();
        let opened = false, html = '', writes = 0, commits = 0;
        const wrapper = {
            props: { disabled, modelValue: '' },
            exposed: {
                showEditor() { opened = true; },
                updateEditorFocus() { commits++; if (sync) wrapper.props.modelValue = html; },
            },
            subTree: { el: host, children: [] },
        };
        const editor = {
            getEditableContainer: () => editable, getText: () => decode(html),
            isDisabled: () => false, getConfig: () => ({ readOnly: false }),
        };
        const component = {
            parent: wrapper, props: {},
            exposed: {
                ...(exposeEditor ? { getEditorRef: async () => editor } : {}),
                setTrueContent(value) { html = value; writes++; },
            },
            subTree: { el: editable },
        };
        wrapper.subTree.children.push({ component });
        root._vnode.children.push({ component: wrapper });
        host.contains = el => el === host || el === editable;
        host.querySelector = selector => {
            if (selector.includes('.wangEditor-extra-style,')) return {}; // preview/hidden input exists
            return selector.includes('data-slate-editor') && opened ? editable : null;
        };
        // Any accidental return to clipboard injection is a regression.
        editable.dispatchEvent = () => { throw new Error('clipboard path is blocked'); };
        return {
            host, wrapper, component, editor,
            get html() { return html; }, get writes() { return writes; },
            get commits() { return commits; }, get opened() { return opened; },
        };
    }
    function question(slots, { displayNumber = '1', text = 'Question', type = '填空题' } = {}) {
        const box = element();
        box.querySelectorAll = selector => selector === '.choices-html' ? slots.map(s => s.host) : [];
        box.querySelector = selector => {
            if (selector === '.stem') return { textContent: text, innerText: text };
            if (selector === '.question-type' || selector === '.question-type .el-tag__content') {
                return { textContent: type, innerText: type };
            }
            if (selector === '.item-num .num-box') return { innerText: displayNumber };
            return null;
        };
        questionBoxes.push(box);
        return box;
    }
    const context = {
        document, window: { document }, unsafeWindow: { document }, Date,
        log: message => logs.push(message), wait: async () => {},
        selectors: {
            questionBox: '.item-box', questionText: '.stem',
            blankInput: 'input', blankEditor: '[data-slate-editor][contenteditable="true"]',
            optionLabel: '.option', optionText: '.option-text',
        },
    };
    vm.createContext(context);
    vm.runInContext(source.slice(helperStart, helperEnd) + `
        this.api = { fillBlankInputs, getBlankCount, getPageComponents,
            getSlotWrapper, findSlotEditor, normalizeBlankAnswers, extractAllQuestions, resolveQuestionBox };
    `, context);
    return { api: context.api, slot, question, logs };
}

test('release metadata and panel both use v1.3.1', () => {
    assert.match(source, /\/\/ @version\s+1\.3\.1\s/);
    assert.match(source, /id="control-panel-version">v1\.3\.1<\/span>/);
    assert.match(source, /\/\/ @grant\s+unsafeWindow/);
    assert.match(source, /\/\/ @updateURL\s+https:\/\/raw\.githubusercontent\.com\/LuBanQAQ\/neumooc-script\/main\/neumooc-script\.user\.js/);
});

test('inactive preview is counted and activated without a paste event', async () => {
    const h = createHarness(), field = h.slot(), box = h.question([field]);
    assert.equal(field.opened, false);
    assert.equal(h.api.getBlankCount(box), 1);
    assert.equal(await h.api.fillBlankInputs(box, ['AOP']), true);
    assert.equal(field.opened, true);
    assert.equal(field.editor.getText(), 'AOP');
    assert.equal(field.wrapper.props.modelValue, '<p>AOP</p>');
    assert.equal(field.commits, 1);
});

test('multiple blanks are mapped to their own component and escape literal text', async () => {
    const h = createHarness(), unrelated = h.slot(), first = h.slot(), second = h.slot();
    const box = h.question([first, second]);
    assert.equal(h.api.getSlotWrapper(second.host), second.wrapper);
    assert.equal((await h.api.findSlotEditor(second.host, second.wrapper)).editor, second.editor);
    assert.equal(await h.api.fillBlankInputs(box, ['0', '<T> & 1/2']), true);
    assert.equal(first.editor.getText(), '0');
    assert.equal(second.html, '<p>&lt;T&gt; &amp; 1/2</p>');
    assert.equal(unrelated.writes, 0);
});

test('fractions, commas and zero survive answer normalization', () => {
    const { api } = createHarness();
    assert.deepEqual(Array.from(api.normalizeBlankAnswers('["1/2","0"]', 2)), ['1/2', '0']);
    assert.deepEqual(Array.from(api.normalizeBlankAnswers('a,b;c/d', 1)), ['a,b;c/d']);
    assert.deepEqual(Array.from(api.normalizeBlankAnswers(0, 1)), ['0']);
    assert.deepEqual(Array.from(api.normalizeBlankAnswers('甲\n乙', 2)), ['甲', '乙']);
});

test('mismatched answers and cancellation leave controls untouched', async () => {
    const h = createHarness(), first = h.slot(), second = h.slot(), box = h.question([first, second]);
    assert.equal(await h.api.fillBlankInputs(box, ['one']), false);
    assert.equal(await h.api.fillBlankInputs(box, ['a', 'b'], () => false), false);
    assert.equal(first.writes + second.writes, 0);
    assert.equal(first.opened, false);
});

test('disabled controls and unavailable editor APIs fail without writing', async () => {
    for (const settings of [{ disabled: true }, { exposeEditor: false }]) {
        const h = createHarness(), field = h.slot(settings), box = h.question([field]);
        assert.equal(await h.api.fillBlankInputs(box, ['AOP']), false);
        assert.equal(field.writes, 0);
    }
});

test('an editor change is not reported successful when the outer answer stays stale', async () => {
    const h = createHarness(), field = h.slot({ sync: false }), box = h.question([field]);
    assert.equal(await h.api.fillBlankInputs(box, ['AOP']), false);
    assert.equal(field.editor.getText(), 'AOP');
    assert.equal(field.wrapper.props.modelValue, '');
    assert.ok(h.logs.some(message => message.includes('外层答案数据未同步')));
});

test('duplicate section numbers retain unique batch answer keys', () => {
    const h = createHarness();
    const first = h.question([h.slot()], { displayNumber: '1', text: 'First section' });
    const second = h.question([h.slot()], { displayNumber: '1', text: 'Second section' });
    const meta = h.api.extractAllQuestions();
    assert.deepEqual(Array.from(meta, question => question.index), ['1', '2']);
    assert.deepEqual(Array.from(meta, question => question.displayIndex), ['1', '1']);
    assert.equal(h.api.resolveQuestionBox(meta[0]), first);
    assert.equal(h.api.resolveQuestionBox(meta[1]), second);
});
