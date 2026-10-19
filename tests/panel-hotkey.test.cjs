const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'neumooc-script.user.js'), 'utf8');
const regionStart = source.indexOf('/* #region panel-hotkey');
const regionEnd = source.indexOf('/* #endregion panel-hotkey */', regionStart);
assert.ok(regionStart >= 0 && regionEnd > regionStart, 'panel-hotkey module region exists');

const moduleSource = source.slice(regionStart, regionEnd);

function createContext() {
    const sandbox = { console: { log() {}, warn() {}, error() {} } };
    vm.createContext(sandbox);
    vm.runInContext(moduleSource, sandbox, { filename: 'panel-hotkey.js' });
    return sandbox;
}

test('Alt+X is recognized, other modifier combinations are ignored', () => {
    const ctx = createContext();
    const match = ctx.isTogglePanelHotkey;

    assert.equal(match({ altKey: true, code: 'KeyX' }), true);
    assert.equal(match({ altKey: true, key: 'x' }), true);
    assert.equal(match({ altKey: true, key: 'X' }), true);

    assert.equal(match({ altKey: true, code: 'KeyX', ctrlKey: true }), false);
    assert.equal(match({ altKey: true, code: 'KeyX', shiftKey: true }), false);
    assert.equal(match({ altKey: true, code: 'KeyX', metaKey: true }), false);
    assert.equal(match({ altKey: false, code: 'KeyX' }), false);
    assert.equal(match({ code: 'KeyX' }), false);
    assert.equal(match({ altKey: true, code: 'KeyY' }), false);
    assert.equal(match({ altKey: true, key: 'y' }), false);
    assert.equal(match(null), false);
    assert.equal(match({}), false);
});

test('toggle hides the panel and floating ball, then restores the panel', () => {
    const ctx = createContext();
    const panel = { style: { display: '' } };
    const floatingBall = { style: { display: 'flex' } };
    const states = [];
    const toggle = ctx.createPanelToggle({
        panel,
        floatingBall,
        onToggle: visible => states.push(visible),
    });

    assert.equal(toggle(), false);
    assert.equal(panel.style.display, 'none');
    assert.equal(floatingBall.style.display, 'none');

    assert.equal(toggle(), true);
    assert.equal(panel.style.display, '');
    assert.equal(floatingBall.style.display, 'none');
    assert.deepEqual(states, [false, true]);
});

test('toggle restores a minimized panel instead of hiding it again', () => {
    const ctx = createContext();
    const panel = { style: { display: 'none' } };
    const floatingBall = { style: { display: 'flex' } };
    const states = [];
    const toggle = ctx.createPanelToggle({
        panel,
        floatingBall,
        onToggle: visible => states.push(visible),
    });

    assert.equal(toggle(), true);
    assert.equal(panel.style.display, '');
    assert.equal(floatingBall.style.display, 'none');
    assert.deepEqual(states, [true]);
});

test('toggle without a panel is a no-op instead of throwing', () => {
    const ctx = createContext();
    const toggle = ctx.createPanelToggle({ panel: null, floatingBall: null });

    assert.equal(toggle(), false);
    assert.equal(toggle(), false);
});

test('the panel binds the hotkey on capture and prints a hint', () => {
    assert.match(source, /document\.addEventListener\(\s*"keydown",\s*\(event\) => \{\s*if \(!isTogglePanelHotkey\(event\)\) return;\s*event\.preventDefault\(\);\s*event\.stopPropagation\(\);\s*togglePanelByHotkey\(\);/, 'hotkey listener runs in capture phase');
    assert.match(source, /id="control-panel-version">v1\.5\.0<\/span>/);
    assert.match(source, /class="panel-hotkey-hint">⌨️ <kbd>Alt<\/kbd> \+ <kbd>X<\/kbd> 显示 \/ 隐藏面板/);
    assert.match(source, /const PANEL_HOTKEY_LABEL = "Alt\+X";/);
});
