// ==UserScript==
// @name         ManageBac Grade Bars Theme
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Theme ManageBac grade bars only (bars 1-50) with built-in/imported palettes and settings import/export.
// @author       GitHub Copilot
// @match        https://*.managebac.cn/*
// @match        https://managebac.cn/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'mb_gradebar_theme_v2';
    const STYLE_ID = 'mb-gradebar-theme-style';
    const BAR_COUNT = 50;

    const PRESET_PALETTES = {
        rainbow: ["#FF0000", "#FF3300", "#FF6600", "#FF9900", "#FFCC00", "#FFFF00", "#CCFF00", "#99FF00", "#66FF00", "#33FF00", "#00FF00", "#00FF33", "#00FF66", "#00FF99", "#00FFCC", "#00FFFF", "#00CCFF", "#0099FF", "#0066FF", "#0033FF", "#0000FF", "#3300FF", "#6600FF", "#9900FF", "#CC00FF", "#FF00FF", "#FF00CC", "#FF0099", "#FF0066", "#FF0033"],
        monochrome: ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777", "#888888", "#999999", "#AAAAAA", "#BBBBBB", "#CCCCCC", "#DDDDDD", "#EEEEEE", "#F5F5F5", "#FAFAFA"],
        pastel: ["#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF", "#D7BAFF", "#FFC6E0", "#BFF3FF", "#C8FFBA", "#FFE4BA", "#FAD6A5", "#E2F0CB", "#B5EAD7", "#C7CEEA", "#F8BBD0", "#D1C4E9"],
        neon: ["#FF2D95", "#FF5F1F", "#FFD400", "#B6FF00", "#00FF9A", "#00E5FF", "#00A3FF", "#7A00FF", "#FF00FF", "#FF1744", "#FF6D00", "#FFEA00", "#00E676", "#1DE9B6", "#18FFFF", "#2979FF"],
        earth: ["#5D4037", "#6D4C41", "#795548", "#8D6E63", "#A1887F", "#BCAAA4", "#4E342E", "#3E2723", "#8E735B", "#A67C52", "#7C5C4A", "#9E7B55", "#6B8E23", "#556B2F", "#8F9779", "#A3B18A"],
        plum: ["#2E003E", "#3D1A5A", "#4B2265", "#5A2A72", "#6A3480", "#7B3F8C", "#8C4A99", "#9D55A6", "#AE60B3", "#BF6BC0", "#D076CD", "#E181DA", "#F28CE7", "#D9A2FF", "#BE8BFF", "#A574FF"],
        forest: ["#0B6623", "#127B2B", "#228B22", "#2E8B57", "#3CB371", "#66CDAA", "#8FD7A4", "#B2E5C0", "#C9EFCF", "#DFF4E1", "#8F9779", "#7BB274", "#6AA06A", "#5E8F5E", "#4E7F4E", "#3E6E3E", "#2E5E2E", "#1F4F1F", "#15441A", "#0B3A16", "#2C5F2C", "#417B41", "#588B58", "#6EA86E", "#86C286", "#9FD99F", "#B8E8B8", "#D1F7D1", "#E8FFE8", "#F6FFF6"],
        ocean: ["#002F4B", "#034F6C", "#016A8A", "#0188A8", "#00A3C4", "#00BCD6", "#00D1D3", "#00E5D9", "#2FECE1", "#5FF6E7", "#8FFDF0", "#B2FFFF", "#CCEFFF", "#99E6FF", "#66D4FF", "#33C2FF", "#00B0FF", "#0099FF", "#007DFF", "#0063FF", "#0049FF", "#0030FF", "#0017FF", "#0014E6", "#0013CC", "#0011B3", "#00108F", "#00106D", "#00104A", "#001028"],
        sunset: ["#FF4E50", "#FF6B6B", "#FF7F50", "#FF8C42", "#FF9E44", "#FFA64D", "#FFB066", "#FFB77F", "#FFC18F", "#FFCB9E", "#FFD6A8", "#FFE0B3", "#FFE8C2", "#FFF1D1", "#FFF7DF", "#FFDBE9", "#FFCCE5", "#FFB6D9", "#FFA1CF", "#FF8AC3", "#FF74B8", "#FF5DB0", "#FF47A8", "#FF329F", "#FF1E94", "#F01589", "#E00B7D", "#C90672", "#B00266", "#99005B"]
    };

    function defaultState() {
        return {
            version: 2,
            enabled: true,
            activePalette: 'rainbow',
            palettes: [],
            scoped: {
                global: {
                    barColors: {}
                }
            }
        };
    }

    function scopeKey() {
        const match = location.pathname.match(/\/student\/classes\/(\d+)/);
        return match ? `class:${match[1]}` : 'global';
    }

    function normalizeHex(value) {
        if (typeof value !== 'string') return null;
        const raw = value.trim();
        if (!raw) return null;
        const withHash = raw.startsWith('#') ? raw : `#${raw}`;
        return /^#[0-9A-Fa-f]{6}$/.test(withHash) ? withHash.toUpperCase() : null;
    }

    function parsePaletteObject(obj) {
        let colors = [];
        if (Array.isArray(obj)) {
            colors = obj;
        } else if (obj && Array.isArray(obj.colors)) {
            colors = obj.colors;
        } else if (obj && Array.isArray(obj.palette)) {
            colors = obj.palette;
        }
        const normalized = (colors || []).map(normalizeHex).filter(Boolean);
        return Array.from(new Set(normalized));
    }

    function loadState() {
        const raw = GM_getValue(STORAGE_KEY, null);
        if (!raw) return defaultState();
        try {
            const parsed = JSON.parse(raw);
            const base = defaultState();
            const merged = {
                ...base,
                ...parsed,
                scoped: { ...(base.scoped || {}), ...((parsed && parsed.scoped) || {}) }
            };
            if (!merged.scoped.global) merged.scoped.global = { barColors: {} };
            return merged;
        } catch (err) {
            return defaultState();
        }
    }

    function saveState(state) {
        GM_setValue(STORAGE_KEY, JSON.stringify(state));
    }

    function getPaletteColors(state) {
        const key = state.activePalette;
        if (!key) return [];
        if (key.startsWith('user:')) {
            const idx = parseInt(key.split(':')[1], 10);
            const entry = (state.palettes || [])[idx];
            return entry && Array.isArray(entry.colors) ? entry.colors : [];
        }
        return PRESET_PALETTES[key] || [];
    }

    function getActiveBarColors(state) {
        const key = scopeKey();
        const scopedEntry = state.scoped && state.scoped[key];
        if (scopedEntry && scopedEntry.barColors) return scopedEntry.barColors;
        return (state.scoped && state.scoped.global && state.scoped.global.barColors) || {};
    }

    function applyThemeStyles() {
        const old = document.getElementById(STYLE_ID);
        if (old) old.remove();

        const state = loadState();
        if (!state.enabled) return;

        const barColors = getActiveBarColors(state);
        const cssLines = [];
        for (let i = 1; i <= BAR_COUNT; i++) {
            const color = normalizeHex(barColors[String(i)] || barColors[i]);
            if (!color) continue;
            const series = i - 1;
            const sel = `.assignments-progress-chart .highcharts-series-${series} .highcharts-point`;
            cssLines.push(`${sel} { fill: ${color} !important; stroke: ${color} !important; }`);
        }

        if (!cssLines.length) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = cssLines.join('\n');
        document.head.appendChild(style);
    }

    function randomizeBarsForCurrentScope() {
        const state = loadState();
        const palette = getPaletteColors(state);
        if (!palette.length) {
            alert('Selected palette has no valid colors');
            return;
        }
        const key = scopeKey();
        state.scoped = state.scoped || {};
        state.scoped[key] = state.scoped[key] || { barColors: {} };
        state.scoped[key].barColors = {};
        const orderedRainbow = state.activePalette === 'rainbow';
        for (let i = 1; i <= BAR_COUNT; i++) {
            if (orderedRainbow) {
                state.scoped[key].barColors[String(i)] = palette[(i - 1) % palette.length];
            } else {
                state.scoped[key].barColors[String(i)] = palette[Math.floor(Math.random() * palette.length)];
            }
        }
        saveState(state);
        applyThemeStyles();
        const label = key === 'global' ? 'global' : key;
        alert(`Theme applied for ${label} (bars 1-50${orderedRainbow ? ', rainbow ordered loop' : ''})`);
        setTimeout(() => location.reload(), 150);
    }

    function clearAllSettings() {
        if (!confirm('Clear all saved palettes and themes?')) return;
        saveState(defaultState());
        const old = document.getElementById(STYLE_ID);
        if (old) old.remove();
        applyThemeStyles();
        alert('All settings cleared');
        setTimeout(() => location.reload(), 150);
    }

    function downloadJSON(filename, payload) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function renderUI() {
        if (document.getElementById('mb-gb-toggle')) return;

        const panel = document.createElement('div');
        panel.id = 'mb-gradebar-theme-panel';
        panel.style.cssText = 'position:fixed;right:16px;bottom:62px;z-index:2147483647;background:#fff;border:1px solid rgba(0,0,0,0.12);padding:12px;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.15);font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;min-width:320px;max-width:420px;display:none;';
        panel.innerHTML = `
            <div style="font-weight:600;margin-bottom:10px">Grade Bars Theme (1-50)</div>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
                <label style="display:flex;align-items:center;gap:6px;">
                    <input id="mb-gb-enabled" type="checkbox">
                    Enabled
                </label>
                <div id="mb-gb-scope" style="font-size:12px;color:#555;margin-left:auto"></div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
                <select id="mb-gb-palette" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:8px;"></select>
                <button id="mb-gb-apply" style="padding:8px 10px;border:1px solid #0b79ff;border-radius:8px;background:#0b79ff;color:#fff;cursor:pointer;">Apply Theme</button>
            </div>
            <div id="mb-gb-preview" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;"></div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <input id="mb-gb-import-palette-file" type="file" accept=".json" style="display:none">
                <button id="mb-gb-import-palette" style="padding:8px;border:1px solid #0b79ff;border-radius:8px;background:#fff;color:#0b79ff;cursor:pointer;">Import Palette</button>
                <input id="mb-gb-import-settings-file" type="file" accept=".json" style="display:none">
                <button id="mb-gb-import-settings" style="padding:8px;border:1px solid #0b79ff;border-radius:8px;background:#fff;color:#0b79ff;cursor:pointer;">Import Settings</button>
                <button id="mb-gb-export-settings" style="padding:8px;border:1px solid #0b79ff;border-radius:8px;background:#0b79ff;color:#fff;cursor:pointer;">Export Settings</button>
                <button id="mb-gb-clear-settings" style="padding:8px;border:1px solid #d33;border-radius:8px;background:#fff;color:#d33;cursor:pointer;">Clear All Settings</button>
            </div>
        `;
        document.body.appendChild(panel);

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'mb-gb-toggle';
        toggleBtn.textContent = '🎨';
        toggleBtn.title = 'Grade bars theme';
        toggleBtn.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483646;background:#0b79ff;color:#fff;border:none;border-radius:10px;padding:9px 11px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(11,121,255,0.22);';
        document.body.appendChild(toggleBtn);
        toggleBtn.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });

        const enabledInput = panel.querySelector('#mb-gb-enabled');
        const scopeLabel = panel.querySelector('#mb-gb-scope');
        const paletteSel = panel.querySelector('#mb-gb-palette');
        const preview = panel.querySelector('#mb-gb-preview');
        const applyBtn = panel.querySelector('#mb-gb-apply');
        const importPaletteFile = panel.querySelector('#mb-gb-import-palette-file');
        const importPaletteBtn = panel.querySelector('#mb-gb-import-palette');
        const importSettingsFile = panel.querySelector('#mb-gb-import-settings-file');
        const importSettingsBtn = panel.querySelector('#mb-gb-import-settings');
        const exportSettingsBtn = panel.querySelector('#mb-gb-export-settings');
        const clearSettingsBtn = panel.querySelector('#mb-gb-clear-settings');

        function renderPaletteSelector() {
            const state = loadState();
            paletteSel.innerHTML = '';
            Object.keys(PRESET_PALETTES).forEach((name) => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = `${name} (built-in)`;
                if (state.activePalette === name) opt.selected = true;
                paletteSel.appendChild(opt);
            });
            (state.palettes || []).forEach((entry, idx) => {
                const key = `user:${idx}`;
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = entry.name || `Custom ${idx + 1}`;
                if (state.activePalette === key) opt.selected = true;
                paletteSel.appendChild(opt);
            });
            enabledInput.checked = !!state.enabled;
            scopeLabel.textContent = `Scope: ${scopeKey()}`;
            renderPreview();
        }

        function renderPreview() {
            const state = loadState();
            const colors = getPaletteColors(state).slice(0, 16);
            preview.innerHTML = '';
            colors.forEach((c) => {
                const sw = document.createElement('div');
                sw.style.cssText = `width:22px;height:18px;border-radius:4px;border:1px solid #ddd;background:${c};`;
                sw.title = c;
                preview.appendChild(sw);
            });
        }

        enabledInput.addEventListener('change', () => {
            const state = loadState();
            state.enabled = !!enabledInput.checked;
            saveState(state);
            applyThemeStyles();
        });

        paletteSel.addEventListener('change', () => {
            const state = loadState();
            state.activePalette = paletteSel.value;
            saveState(state);
            renderPreview();
        });

        applyBtn.addEventListener('click', () => {
            randomizeBarsForCurrentScope();
        });

        importPaletteBtn.addEventListener('click', () => importPaletteFile.click());
        importPaletteFile.addEventListener('change', async (ev) => {
            const file = ev.target && ev.target.files && ev.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                const colors = parsePaletteObject(parsed);
                if (!colors.length) {
                    alert('No valid hex colors found in palette file');
                    return;
                }
                const state = loadState();
                const name = file.name.replace(/\.[^/.]+$/, '');
                state.palettes = state.palettes || [];
                state.palettes.push({ name, colors });
                state.activePalette = `user:${state.palettes.length - 1}`;
                saveState(state);
                renderPaletteSelector();
                alert(`Palette imported: ${name}`);
            } catch (err) {
                alert(`Palette import failed: ${err}`);
            } finally {
                importPaletteFile.value = '';
            }
        });

        exportSettingsBtn.addEventListener('click', () => {
            const state = loadState();
            const ts = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const name = `mb-gradebar-theme-${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.json`;
            downloadJSON(name, state);
        });

        clearSettingsBtn.addEventListener('click', () => {
            clearAllSettings();
        });

        importSettingsBtn.addEventListener('click', () => importSettingsFile.click());
        importSettingsFile.addEventListener('change', async (ev) => {
            const file = ev.target && ev.target.files && ev.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const incoming = JSON.parse(text);
                if (!incoming || typeof incoming !== 'object') throw new Error('Invalid settings JSON');
                const next = defaultState();
                next.enabled = incoming.enabled !== false;
                next.activePalette = incoming.activePalette || next.activePalette;
                next.palettes = Array.isArray(incoming.palettes)
                    ? incoming.palettes.map((p) => ({
                        name: (p && p.name) || 'Imported',
                        colors: parsePaletteObject(p && p.colors ? p.colors : p)
                    })).filter((p) => p.colors.length)
                    : [];
                if (incoming.scoped && typeof incoming.scoped === 'object') {
                    next.scoped = {};
                    Object.keys(incoming.scoped).forEach((k) => {
                        const entry = incoming.scoped[k] || {};
                        const inBarColors = entry.barColors || {};
                        const outBarColors = {};
                        Object.keys(inBarColors).forEach((bar) => {
                            const normalized = normalizeHex(inBarColors[bar]);
                            if (normalized) outBarColors[String(bar)] = normalized;
                        });
                        next.scoped[k] = { barColors: outBarColors };
                    });
                }
                if (!next.scoped.global) next.scoped.global = { barColors: {} };
                saveState(next);
                renderPaletteSelector();
                applyThemeStyles();
                alert('Settings imported');
            } catch (err) {
                alert(`Settings import failed: ${err}`);
            } finally {
                importSettingsFile.value = '';
            }
        });

        renderPaletteSelector();
    }

    function boot() {
        renderUI();
        applyThemeStyles();
    }

    boot();

    const observer = new MutationObserver(() => {
        if (!document.getElementById('mb-gb-toggle')) renderUI();
        applyThemeStyles();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: false });

    ['turbolinks:load', 'turbolinks:render', 'turbo:load', 'turbo:render', 'pjax:end', 'popstate'].forEach((ev) => {
        document.addEventListener(ev, () => {
            renderUI();
            applyThemeStyles();
        });
    });

    try {
        if (typeof GM_registerMenuCommand === 'function') {
            GM_registerMenuCommand('Grade Bars Theme: Open panel', () => {
                renderUI();
                const panel = document.getElementById('mb-gradebar-theme-panel');
                if (panel) panel.style.display = 'block';
            });
        }
    } catch (err) {
        // Ignore menu command registration failures.
    }
})();
