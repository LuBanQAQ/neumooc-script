const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'neumooc-script.user.js'), 'utf8');
const regionStart = source.indexOf('/* #region anti-check');
const regionEnd = source.indexOf('/* #endregion anti-check */', regionStart);
assert.ok(regionStart >= 0 && regionEnd > regionStart, 'anti-check module region exists');

const moduleSource = source.slice(regionStart, regionEnd);

// The module is loaded on its own: it must not depend on the assistant GUI or
// any platform DOM, and every hook is inert until its switch is enabled.
// Timers are queued so state progression can be asserted deterministically.
function createContext() {
    const sandbox = {
        __timers: [],
        setTimeout(fn) {
            sandbox.__timers.push(fn);
            return sandbox.__timers.length;
        },
        clearTimeout() {},
        console: { log() {}, warn() {}, error() {} },
    };
    vm.createContext(sandbox);
    vm.runInContext(moduleSource, sandbox, { filename: 'anti-check.js' });
    return sandbox;
}

function flushTimers(ctx, limit = 32) {
    let count = 0;
    while (ctx.__timers.length > 0 && count < limit) {
        const next = ctx.__timers.shift();
        count += 1;
        next();
    }
    return count;
}

function createPageDocument(overrides = {}) {
    const documentHandlers = [];
    const doc = {
        readyState: 'complete',
        body: {},
        documentHandlers,
        head: { appendChild(node) { doc.injectedStyle = node; } },
        documentElement: { appendChild() {} },
        createElement() {
            return { textContent: '' };
        },
        addEventListener(type, handler, capture) {
            documentHandlers.push({ type, handler, capture });
        },
        ...overrides,
    };
    return doc;
}

test('only recordLog requests carrying logType=18 are blocked', () => {
    const ctx = createContext();
    const check = ctx.isBlockedExamLog;
    const url = 'https://study.neusoft.edu.cn/web-api/smartexam/invigilation-center/recordLog?t=1';

    assert.equal(check(url, '{"logType":18}'), true);
    assert.equal(check(url, JSON.stringify({ logType: '18', extra: 'x' })), true);
    assert.equal(check(url, { logType: 18 }), true);
    assert.equal(check(url, 'logType=18&foo=bar'), true);

    assert.equal(check(url, '{"logType":19}'), false);
    assert.equal(check(url, { logType: 4 }), false);
    assert.equal(check(url, '{"logType":18'), false);
    assert.equal(check(url, 'logType=180'), false);
    assert.equal(check(url, null), false);
    assert.equal(check('/web-api/smartexam/other/recordLog', '{"logType":18}'), false);
    assert.equal(check(undefined, '{"logType":18}'), false);
});

test('anti-detect reports the page as visible and focused', () => {
    const ctx = createContext();
    const pageDocument = { hidden: true, visibilityState: 'hidden', hasFocus: () => false };
    class FakeXHR {}
    const pageWindow = { XMLHttpRequest: FakeXHR };
    const messages = [];

    const hooked = ctx.installAntiDetectHooks(pageWindow, pageDocument, message => messages.push(message));

    assert.equal(pageDocument.hidden, false);
    assert.equal(pageDocument.visibilityState, 'visible');
    assert.equal(pageDocument.hasFocus(), true);
    assert.notEqual(pageWindow.XMLHttpRequest, FakeXHR);
    assert.equal(hooked, pageWindow.XMLHttpRequest);
    assert.equal(hooked.prototype instanceof FakeXHR, true);
    assert.ok(messages.some(message => message.includes('考试反检测已启用')));
});

test('anti-detect without XMLHttpRequest reports a failure instead of throwing', () => {
    const ctx = createContext();
    const pageDocument = { hidden: true, visibilityState: 'hidden', hasFocus: () => false };
    const messages = [];

    const hooked = ctx.installAntiDetectHooks({}, pageDocument, message => messages.push(message));

    assert.equal(hooked, null);
    assert.equal(pageDocument.hidden, false);
    assert.ok(messages.some(message => message.includes('XMLHttpRequest')));
});

test('logType=18 uploads are dropped and answered with a mock success response', () => {
    const ctx = createContext();
    const sent = [];
    class FakeXHR {
        constructor() {
            this.listeners = [];
            this.onreadystatechange = null;
            this.onload = null;
        }
        open(method, url) {
            this.method = method;
            this.url = url;
        }
        send(body) {
            sent.push({ method: this.method, url: this.url, body });
        }
        addEventListener(type, handler) {
            this.listeners.push([type, handler]);
        }
        dispatchEvent(event) {
            this.listeners
                .filter(([type]) => type === event.type)
                .forEach(([, handler]) => handler.call(this, event));
        }
    }
    class FakeEvent {
        constructor(type) {
            this.type = type;
        }
    }
    const pageWindow = { XMLHttpRequest: FakeXHR, Event: FakeEvent, ProgressEvent: FakeEvent };
    const pageDocument = createPageDocument({ hidden: true, visibilityState: 'hidden', hasFocus: () => false });
    const messages = [];
    ctx.installAntiDetectHooks(pageWindow, pageDocument, message => messages.push(message));

    const HookedXHR = pageWindow.XMLHttpRequest;
    const blocked = new HookedXHR();
    blocked.open('POST', '/web-api/smartexam/invigilation-center/recordLog');
    blocked.send(JSON.stringify({ logType: 18, detail: 'blur' }));

    assert.equal(sent.length, 0, 'blocked request never reaches the network layer');
    assert.ok(messages.some(message => message.includes('logType=18')));
    assert.equal(blocked.readyState, undefined);
    assert.equal(flushTimers(ctx), 4, 'readyState advances through 1..4');
    assert.equal(blocked.readyState, 4);    assert.equal(blocked.status, 200);
    assert.equal(blocked.statusText, 'OK');
    assert.equal(JSON.parse(blocked.responseText).code, 0);
    assert.equal(blocked.responseText, blocked.response);

    const allowed = new HookedXHR();
    allowed.open('POST', '/web-api/course/progress');
    allowed.send('{"logType":18}');
    assert.equal(sent.length, 1, 'unrelated endpoints keep working');

    const otherLogType = new HookedXHR();
    otherLogType.open('POST', '/web-api/smartexam/invigilation-center/recordLog');
    otherLogType.send(JSON.stringify({ logType: 9 }));
    assert.equal(sent.length, 2);
});

test('clipboard unlock filters hostile copy handlers but keeps paste handlers', () => {
    const ctx = createContext();
    const registered = [];
    class FakeEventTarget {}
    FakeEventTarget.prototype.addEventListener = function (type, handler) {
        registered.push({ type, handler });
    };
    const written = [];
    const clipboard = { writeText: text => { written.push(text); } };
    const pageWindow = { EventTarget: FakeEventTarget, navigator: { clipboard } };
    const pageDocument = createPageDocument();
    const messages = [];

    ctx.installClipboardUnlockHooks(pageWindow, pageDocument, message => messages.push(message));

    assert.ok(pageDocument.injectedStyle, 'user-select style is injected');
    assert.match(pageDocument.injectedStyle.textContent, /user-select: text !important/);
    assert.deepEqual(
        pageDocument.documentHandlers.map(entry => entry.type).sort(),
        ['copy', 'cut', 'paste']
    );
    assert.ok(pageDocument.documentHandlers.every(entry => entry.capture === true));

    const target = new FakeEventTarget();
    const emptyHandler = () => {};
    const hostileHandler = event => {
        event.preventDefault();
        navigator.clipboard.writeText('');
    };
    const pasteHandler = event => event.clipboardData.getData('text/plain');

    target.addEventListener('copy', emptyHandler);
    target.addEventListener('cut', hostileHandler);
    target.addEventListener('paste', pasteHandler);

    assert.deepEqual(registered.map(entry => entry.type), ['paste']);
    assert.equal(registered[0].handler, pasteHandler);
    assert.ok(messages.some(message => message.includes('空的 copy 监听器')));
    assert.ok(messages.some(message => message.includes('恶意的 cut 监听器')));
});

test('copy events suppress clipboard.writeText only for the running event', () => {
    const ctx = createContext();
    class FakeEventTarget {}
    FakeEventTarget.prototype.addEventListener = function () {};
    const written = [];
    const clipboard = { writeText: text => { written.push(text); } };
    const pageWindow = { EventTarget: FakeEventTarget, navigator: { clipboard } };
    const pageDocument = createPageDocument();

    ctx.installClipboardUnlockHooks(pageWindow, pageDocument, () => {});
    const copyHandler = pageDocument.documentHandlers.find(entry => entry.type === 'copy').handler;
    copyHandler({ preventDefault() {} });

    clipboard.writeText('cleared');
    assert.deepEqual(written, []);

    flushTimers(ctx);
    clipboard.writeText('kept');
    assert.deepEqual(written, ['kept']);
});

test('clipboard unlock defers style and observer setup until the body is ready', () => {
    const ctx = createContext();
    class FakeEventTarget {}
    FakeEventTarget.prototype.addEventListener = function () {};
    const observed = [];
    class FakeMutationObserver {
        observe(target, options) {
            observed.push({ target, options });
        }
    }
    const pageWindow = { EventTarget: FakeEventTarget, navigator: {}, MutationObserver: FakeMutationObserver };
    const pageDocument = createPageDocument({ body: null, readyState: 'loading' });

    ctx.installClipboardUnlockHooks(pageWindow, pageDocument, () => {});

    assert.equal(pageDocument.injectedStyle, undefined);
    assert.equal(observed.length, 0);

    const deferred = pageDocument.documentHandlers.filter(entry => entry.type === 'DOMContentLoaded');
    assert.equal(deferred.length, 2, 'style mount and mutation observer both wait for DOMContentLoaded');

    pageDocument.body = {};
    deferred.forEach(entry => entry.handler());

    assert.ok(pageDocument.injectedStyle);
    assert.equal(observed.length, 1);
    assert.equal(observed[0].target, pageDocument.body);
});

test('panel exposes persisted, default-off switches for both anti-check features', () => {
    assert.match(source, /GM_getValue\("antiDetectEnabled", false\) === true/);
    assert.match(source, /GM_getValue\("clipboardUnlockEnabled", false\) === true/);
    assert.match(source, /GM_setValue\(options\.storageKey, applied\)/);
    assert.match(source, /id="toggle-anti-detect"/);
    assert.match(source, /id="toggle-clipboard-unlock"/);
    assert.match(source, /bindAntiCheckSwitch\(\{[\s\S]*buttonId: "toggle-anti-detect"[\s\S]*install: \(\) => installAntiDetect\(\)/);
    assert.match(source, /bindAntiCheckSwitch\(\{[\s\S]*buttonId: "toggle-clipboard-unlock"[\s\S]*install: \(\) => installClipboardUnlock\(\)/);
});

test('document-start boot defers GUI setup until the body exists', () => {
    assert.match(source, /\/\/ @run-at\s+document-start/);
    assert.match(source, /if \(document\.body\) \{\s*startAssistant\(\);\s*\} else \{\s*document\.addEventListener\("DOMContentLoaded", startAssistant, \{ once: true \}\);/);
});
