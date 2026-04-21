// ==UserScript==
// @name         ManageBac Grade Bars Colorizer
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Change color of grade/progress bars on ManageBac (or any site) using selector + color picker. Persist rules.
// @author       GitHub Copilot
// @match        https://*.managebac.cn/*
// @match        https://managebac.cn/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    const STORAGE_KEY = 'mb_gradebar_rules_v1';

    // Built-in palette presets (embedded from project files)
    const PRESET_PALETTES = {
        "rainbow": ["#FF0000","#FF3300","#FF6600","#FF9900","#FFCC00","#FFFF00","#CCFF00","#99FF00","#66FF00","#33FF00","#00FF00","#00FF33","#00FF66","#00FF99","#00FFCC","#00FFFF","#00CCFF","#0099FF","#0066FF","#0033FF","#0000FF","#3300FF","#6600FF","#9900FF","#CC00FF","#FF00FF","#FF00CC","#FF0099","#FF0066","#FF0033"],
        "forest": ["#0B6623","#127B2B","#228B22","#2E8B57","#3CB371","#66CDAA","#8FD7A4","#B2E5C0","#C9EFCF","#DFF4E1","#8F9779","#7BB274","#6AA06A","#5E8F5E","#4E7F4E","#3E6E3E","#2E5E2E","#1F4F1F","#15441A","#0B3A16","#2C5F2C","#417B41","#588B58","#6EA86E","#86C286","#9FD99F","#B8E8B8","#D1F7D1","#E8FFE8","#F6FFF6"],
        "ocean": ["#002F4B","#034F6C","#016A8A","#0188A8","#00A3C4","#00BCD6","#00D1D3","#00E5D9","#2FECE1","#5FF6E7","#8FFDF0","#B2FFFF","#CCEFFF","#99E6FF","#66D4FF","#33C2FF","#00B0FF","#0099FF","#007DFF","#0063FF","#0049FF","#0030FF","#0017FF","#0014E6","#0013CC","#0011B3","#00108F","#00106D","#00104A","#001028"],
        "sunset": ["#FF4E50","#FF6B6B","#FF7F50","#FF8C42","#FF9E44","#FFA64D","#FFB066","#FFB77F","#FFC18F","#FFCB9E","#FFD6A8","#FFE0B3","#FFE8C2","#FFF1D1","#FFF7DF","#FFDBE9","#FFCCE5","#FFB6D9","#FFA1CF","#FF8AC3","#FF74B8","#FF5DB0","#FF47A8","#FF329F","#FF1E94","#F01589","#E00B7D","#C90672","#B00266","#99005B"]
    };

    // New storage format includes palette settings
    // { version:1, defaultRules: [], scoped: { 'class:ID': [...] }, recentColors: [], palettes: [{name,colors}], activePalette: '', usePalette: false }
    function loadStorage(){
        const raw = GM_getValue(STORAGE_KEY, null);
        try{
            if(!raw) return {version:1, defaultRules:[], scoped:{}, recentColors:[], palettes: [], activePalette: null, usePalette: false};
            const obj = JSON.parse(raw);
            if(Array.isArray(obj)){
                // migrate old array -> defaultRules
                return {version:1, defaultRules:obj, scoped:{}, recentColors:[], palettes: [], activePalette: null, usePalette: false};
            }
            // normalize if scoped was stored as an array (old/other export formats)
            if(obj && obj.scoped && Array.isArray(obj.scoped)){
                obj.defaultRules = (obj.defaultRules || []).concat(obj.scoped || []);
                obj.scoped = {};
            }
            return {
                version:1,
                defaultRules: obj.defaultRules || [],
                scoped: obj.scoped || {},
                recentColors: obj.recentColors || [],
                palettes: obj.palettes || [],
                activePalette: obj.activePalette || null,
                usePalette: !!obj.usePalette
            };
        }catch(e){
            return {version:1, defaultRules:[], scoped:{}, recentColors:[], palettes: [], activePalette: null, usePalette: false};
        }
    }
    function saveStorage(st){ GM_setValue(STORAGE_KEY, JSON.stringify(st)); }

    function getCurrentScopeKey(){
        // Prefer class id from URL: /student/classes/11422326/...
        try{
            const m = location.pathname.match(/\/student\/classes\/(\d+)/);
            return m ? `class:${m[1]}` : 'global';
        }catch(e){ return 'global'; }
    }

    function getCombinedRules(){
        const st = loadStorage();
        const combined = [];
        // Always include global/default rules first
        st.defaultRules.forEach((r, idx)=> combined.push({...r, _scope: 'global', _idx: idx}));
        // Also include scoped rules from ALL scopes so they effectively apply everywhere
        for(const scopeKey in (st.scoped || {})){
            (st.scoped[scopeKey] || []).forEach((r, idx)=> combined.push({...r, _scope: scopeKey, _idx: idx}));
        }
        return combined;
    }

    function addRuleToStorage(rule, scopeKey){
        const st = loadStorage();
        const newRule = Object.assign({}, rule);
        if(typeof newRule.enabled === 'undefined') newRule.enabled = true;
        if(!scopeKey || scopeKey === 'global' || scopeKey === 'all'){
            st.defaultRules.push(newRule);
        }else{
            st.scoped[scopeKey] = st.scoped[scopeKey] || [];
            st.scoped[scopeKey].push(newRule);
        }
        // keep recent colors
        st.recentColors = st.recentColors || [];
        if(rule.color){
            st.recentColors = [rule.color].concat(st.recentColors.filter(c=>c!==rule.color)).slice(0,12);
        }
        saveStorage(st);
    }

    function deleteRuleFromStorage(scopeKey, idx){
        const st = loadStorage();
        if(scopeKey === 'global' || !scopeKey || scopeKey === 'all'){
            if(typeof idx === 'number') st.defaultRules.splice(idx,1);
        }else{
            st.scoped[scopeKey] = st.scoped[scopeKey] || [];
            if(typeof idx === 'number') st.scoped[scopeKey].splice(idx,1);
        }
        saveStorage(st);
    }

    // Toggle enabled state for a stored rule
    function toggleRuleEnabled(scopeKey, idx, enabled){
        const st = loadStorage();
        if(scopeKey === 'global' || !scopeKey || scopeKey === 'all'){
            if(st.defaultRules && typeof st.defaultRules[idx] !== 'undefined'){
                st.defaultRules[idx].enabled = !!enabled;
            }
        }else{
            st.scoped[scopeKey] = st.scoped[scopeKey] || [];
            if(st.scoped[scopeKey] && typeof st.scoped[scopeKey][idx] !== 'undefined'){
                st.scoped[scopeKey][idx].enabled = !!enabled;
            }
        }
        saveStorage(st);
    }

        // Create UI (panel + toggle). Called initially and also after SPA navigation.
        function createUI(){
                // Avoid duplicating UI
                if(document.getElementById('mb-gb-toggle')) return;

                const panel = document.createElement('div');
                panel.id = 'mb-gradebar-colorizer-panel';
                panel.style.cssText = 'position:fixed;right:16px;bottom:62px;z-index:2147483647;background:#fff;border:1px solid rgba(0,0,0,0.08);padding:12px;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.12);font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;min-width:340px;max-width:460px;';

                panel.innerHTML = `
                    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
                        <input id="mb-gb-selector" list="mb-gb-suggestions" placeholder="CSS selector (eg .progress-bar) or leave empty to use Bar #" style="flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-size:14px">
                        <input id="mb-gb-bar-index" type="number" min="1" placeholder="Bar #" style="width:84px;padding:8px;border:1px solid #ddd;border-radius:8px;margin-left:6px;font-size:14px">
                        <button id="mb-gb-bar-prev" title="Previous bar" style="width:34px;padding:8px;border-radius:8px;border:1px solid #ddd;background:#fff;margin-left:6px">◀</button>
                        <button id="mb-gb-bar-next" title="Next bar" style="width:34px;padding:8px;border-radius:8px;border:1px solid #ddd;background:#fff">▶</button>
                        <select id="mb-gb-bar-mode" style="width:150px;padding:8px;border-radius:8px;border:1px solid #ddd;margin-left:6px;font-size:14px">
                            <option value="auto">Auto detect (series or point)</option>
                            <option value="point">Point index (nth within series-0)</option>
                            <option value="series">Series index (1-based → series-(n-1))</option>
                        </select>
                        <datalist id="mb-gb-suggestions">
                            <option value=".progress-bar"></option>
                            <option value=".grade-bar"></option>
                            <option value=".progress"></option>
                            <option value=".bar"></option>
                            <option value="[data-progress]"></option>
                            <option value=".task-progress"></option>
                        </datalist>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
                        <label style="display:flex;align-items:center;gap:8px;font-size:14px;margin-right:6px"><input id="mb-gb-use-palette" type="checkbox" style="transform:scale(1.05);"> Use theme (random per bar)</label>
                        <select id="mb-gb-palette-select" style="padding:8px;border-radius:8px;border:1px solid #ddd;font-size:14px">
                            <option value="">— Select palette —</option>
                            <option value="rainbow">Rainbow</option>
                            <option value="ocean">Ocean</option>
                            <option value="forest">Forest</option>
                            <option value="sunset">Sunset</option>
                        </select>
                        <button id="mb-gb-apply-theme" style="padding:8px;border-radius:8px;border:1px solid #0b79ff;background:#0b79ff;color:#fff;cursor:pointer;margin-left:6px">Apply Theme</button>
                        <input id="mb-gb-import-palette-file" type="file" accept=".json" style="display:none">
                        <button id="mb-gb-import-palette-btn" style="padding:8px;border-radius:8px;border:1px solid #0b79ff;background:#fff;color:#0b79ff;cursor:pointer;margin-left:6px">Import palette</button>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
                        <input id="mb-gb-color" type="color" value="#4caf50" title="Choose color" style="width:46px;height:36px;border:none;padding:0;background:transparent">
                        <div id="mb-gb-swatches" style="display:flex;gap:8px;flex-wrap:wrap;margin-left:6px"></div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
                        <select id="mb-gb-scope" style="padding:8px;border-radius:8px;border:1px solid #ddd">
                            <option value="global" selected>All pages</option>
                            <option value="this">This class</option>
                        </select>
                        <select id="mb-gb-target" style="padding:8px;border-radius:8px;border:1px solid #ddd">
                            <option value="all">All matches</option>
                            <option value="first">First match</option>
                            <option value="nth">Nth match</option>
                        </select>
                        <input id="mb-gb-target-n" type="number" min="1" value="1" style="width:72px;padding:8px;border-radius:8px;border:1px solid #ddd;display:none">
                        <input id="mb-gb-name" placeholder="Rule name (optional)" style="flex:1;padding:8px;border-radius:8px;border:1px solid #ddd">
                    </div>
                    <div style="display:flex;gap:8px;margin-top:8px">
                        <button id="mb-gb-preview" style="padding:8px 10px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer">Preview</button>
                        <button id="mb-gb-add" style="padding:8px 10px;border-radius:8px;border:1px solid #0b79ff;background:#0b79ff;color:#fff;cursor:pointer">Add</button>
                        <button id="mb-gb-apply" style="padding:8px 10px;border-radius:8px;border:1px solid #ccc;background:#f6f6f6;cursor:pointer">Apply</button>
                    </div>
                    <div id="mb-gb-rules" style="margin-top:12px;max-height:260px;overflow:auto"></div>
                    <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
                        <div style="font-size:13px;color:#666">Rules persist across pages</div>
                        <div>
                            <input id="mb-gb-import-file" type="file" accept=".json" style="display:none">
                            <button id="mb-gb-import-btn" style="font-size:13px;padding:8px;border-radius:8px;border:1px solid #0b79ff;background:#fff;color:#0b79ff;cursor:pointer;margin-right:6px">Import</button>
                            <button id="mb-gb-export" style="font-size:13px;padding:8px;border-radius:8px;border:1px solid #0b79ff;background:#0b79ff;color:#fff;cursor:pointer;margin-right:6px">Export</button>
                            <button id="mb-gb-reset" style="font-size:13px;padding:8px;border-radius:8px;border:1px solid #eee;background:#fff;cursor:pointer">Reset</button>
                        </div>
                    </div>
                `;

                document.body.appendChild(panel);

                // small toggle button
                const toggleBtn = document.createElement('button');
                toggleBtn.id = 'mb-gb-toggle';
                toggleBtn.textContent = '🎨';
                toggleBtn.title = 'Grade bars colorizer';
                toggleBtn.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483646;background:#0b79ff;color:#fff;border:none;border-radius:10px;padding:8px 10px;font-size:16px;cursor:pointer;box-shadow:0 6px 18px rgba(11,121,255,0.18)';
                document.body.appendChild(toggleBtn);
                panel.style.display = 'none';
                toggleBtn.addEventListener('click', ()=>{ panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; });

                // Wire the buttons inside the newly-created panel
                (function wire(){
                    const selInput = panel.querySelector('#mb-gb-selector');
                    const colorInput = panel.querySelector('#mb-gb-color');
                    const barIndexInput = panel.querySelector('#mb-gb-bar-index');
                    const barPrevBtn = panel.querySelector('#mb-gb-bar-prev');
                    const barNextBtn = panel.querySelector('#mb-gb-bar-next');
                    const barModeSel = panel.querySelector('#mb-gb-bar-mode');
                    const swatchesEl = panel.querySelector('#mb-gb-swatches');
                    const scopeSel = panel.querySelector('#mb-gb-scope');
                    const targetSel = panel.querySelector('#mb-gb-target');
                    const targetN = panel.querySelector('#mb-gb-target-n');
                    const nameInput = panel.querySelector('#mb-gb-name');
                    const previewBtn = panel.querySelector('#mb-gb-preview');

                    // theme controls
                    const usePaletteChk = panel.querySelector('#mb-gb-use-palette');
                    const paletteSelect = panel.querySelector('#mb-gb-palette-select');
                    const importPaletteFile = panel.querySelector('#mb-gb-import-palette-file');
                    const importPaletteBtn = panel.querySelector('#mb-gb-import-palette-btn');

                    // show/hide nth input
                    targetSel.addEventListener('change', ()=>{
                        targetN.style.display = targetSel.value === 'nth' ? 'inline-block' : 'none';
                    });

                    // Helper: return active palette colors (user or built-in)
                    function getActivePaletteColors(){
                        const st = loadStorage();
                        const name = st.activePalette;
                        if(!name) return [];
                        if(typeof name === 'string' && name.indexOf('user:') === 0){
                            const idx = parseInt(name.split(':')[1],10);
                            if(st.palettes && st.palettes[idx] && Array.isArray(st.palettes[idx].colors)) return st.palettes[idx].colors;
                            return [];
                        }
                        return PRESET_PALETTES[name] || [];
                    }

                    // render palette select options (built-ins + user palettes)
                    function renderPaletteOptions(){
                        const st = loadStorage();
                        paletteSelect.innerHTML = '<option value="">— Select palette —</option>';
                        Object.keys(PRESET_PALETTES).forEach(k=>{
                            const o = document.createElement('option');
                            o.value = k; o.textContent = k.charAt(0).toUpperCase()+k.slice(1)+' (built-in)';
                            if(st.activePalette === k) o.selected = true;
                            paletteSelect.appendChild(o);
                        });
                        (st.palettes || []).forEach((p,i)=>{
                            const key = `user:${i}`;
                            const o = document.createElement('option');
                            o.value = key; o.textContent = p.name || `Custom ${i+1}`;
                            if(st.activePalette === key) o.selected = true;
                            paletteSelect.appendChild(o);
                        });
                        usePaletteChk.checked = !!st.usePalette;
                    }

                    // populate swatches (active palette when enabled, otherwise recent+presets)
                    function renderSwatches(){
                        swatchesEl.innerHTML = '';
                        const st = loadStorage();
                        if(st.usePalette){
                            const colors = getActivePaletteColors();
                            (colors || []).slice(0,16).forEach(c=>{
                                const b = document.createElement('button');
                                b.style.cssText = `width:26px;height:22px;border-radius:4px;border:1px solid #ddd;background:${c};cursor:pointer;padding:0`;
                                b.title = c;
                                b.addEventListener('click', ()=>{ colorInput.value = c; });
                                swatchesEl.appendChild(b);
                            });
                            return;
                        }
                        const presets = ['#3363D0','#00A688','#4580FF','#FF9A00','#FE2B09','#f15c80','#e4d354','#8085e8','#8d4653','#91e8e1','#4caf50','#ff0000','#00ff00','#ffff00','#000000'];
                        const recent = st.recentColors || [];
                        const all = [...recent, ...presets.filter(p=>!recent.includes(p))];
                        all.slice(0,16).forEach(c=>{
                            const b = document.createElement('button');
                            b.style.cssText = `width:26px;height:22px;border-radius:4px;border:1px solid #ddd;background:${c};cursor:pointer;padding:0`;
                            b.title = c;
                            b.addEventListener('click', ()=>{ colorInput.value = c; });
                            swatchesEl.appendChild(b);
                        });
                    }
                    renderPaletteOptions(); renderSwatches();

                    // palette controls
                    usePaletteChk.addEventListener('change', ()=>{
                        const st = loadStorage(); st.usePalette = !!usePaletteChk.checked; saveStorage(st); renderSwatches(); applyRules();
                    });
                    paletteSelect.addEventListener('change', ()=>{
                        const st = loadStorage(); st.activePalette = paletteSelect.value || null; saveStorage(st); renderSwatches(); applyRules();
                    });
                    // Apply Theme button: generate scoped theme rules (series 0..49) for the current class
                    const applyThemeBtn = panel.querySelector('#mb-gb-apply-theme');
                    applyThemeBtn && applyThemeBtn.addEventListener('click', ()=>{
                        const st = loadStorage();
                        if(!st.activePalette){ return alert('Select a palette first'); }
                        st.usePalette = true;
                        // enable usePalette in UI
                        usePaletteChk.checked = true;
                        renderSwatches();

                        // Resolve active palette colors (user or built-in)
                        let paletteColors = [];
                        if(typeof st.activePalette === 'string' && st.activePalette.indexOf('user:') === 0){
                            const idx = parseInt(st.activePalette.split(':')[1],10);
                            paletteColors = (st.palettes && st.palettes[idx] && st.palettes[idx].colors) || [];
                        }else{
                            paletteColors = PRESET_PALETTES[st.activePalette] || [];
                        }
                        if(!paletteColors || !paletteColors.length) return alert('Selected palette has no colors');

                        // Build 50 series rules
                        const seriesRules = [];
                        for(let i = 0; i < 50; i++){
                            const color = paletteColors[Math.floor(Math.random()*paletteColors.length)];
                            seriesRules.push({
                                selector: `.assignments-progress-chart .highcharts-series-${i} .highcharts-point`,
                                color: color,
                                target: 'all',
                                nth: i+1,
                                name: '',
                                enabled: true
                            });
                        }

                        // Decide where to save: respect scope select (global = defaultRules, this = class-scoped)
                        const scopeValue = (scopeSel && scopeSel.value) ? scopeSel.value : 'global';
                        // ensure storage shapes exist
                        st.defaultRules = st.defaultRules || [];
                        st.scoped = st.scoped || {};

                        // Merge generated series into defaultRules to guarantee immediate application
                        const keyOf = r => `${r.selector}||${r.color}||${r.target||''}||${r.nth||''}||${r.name||''}`;
                        const existingSet = new Set((st.defaultRules||[]).map(keyOf));
                        seriesRules.forEach(r => { const k = keyOf(r); if(!existingSet.has(k)){ st.defaultRules.push(r); existingSet.add(k); } });

                        // If user requested class-scoped, also write into scoped[class:id]
                        if(scopeValue !== 'global'){
                            const scopeKey = getCurrentScopeKey();
                            st.scoped[scopeKey] = seriesRules.slice();
                        }

                        // Persist and apply — no automatic download
                        saveStorage(st);
                        renderRules(); applyRules();
                        const displayScope = (scopeValue === 'global') ? 'global' : getCurrentScopeKey();
                        alert('Applied theme ('+displayScope+') with 50 series');
                    });
                    importPaletteBtn.addEventListener('click', ()=>{ if(importPaletteFile) importPaletteFile.click(); });
                    importPaletteFile && importPaletteFile.addEventListener('change', async (ev)=>{
                        const f = ev.target && ev.target.files && ev.target.files[0]; if(!f) return;
                        try{
                            const txt = await f.text();
                            let obj = JSON.parse(txt);
                            let colors = [];
                            const name = f.name.replace(/\.[^/.]+$/, '');
                            if(Array.isArray(obj)) colors = obj;
                            else if(obj.colors && Array.isArray(obj.colors)) colors = obj.colors;
                            else if(obj.palette && Array.isArray(obj.palette)) colors = obj.palette;
                            else if(typeof obj === 'object'){
                                try{ colors = Array.from(new Set(Object.values(obj).flat().filter(v=>typeof v === 'string' && v.match(/^#?[0-9A-Fa-f]{6}$/)))); }catch(e){ colors = []; }
                            }
                            colors = colors.map(c=> c && c.toString().trim().startsWith('#') ? c.toString().trim() : ('#'+c.toString().trim()));
                            colors = colors.filter(c=>/^#?[0-9A-Fa-f]{6}$/.test(c.replace('#',''))).map(c=> c.startsWith('#') ? c : ('#'+c));
                            if(!colors.length) return alert('No valid colors found in palette file');
                            const st = loadStorage(); st.palettes = st.palettes || []; st.palettes.push({name, colors}); st.activePalette = `user:${st.palettes.length-1}`; saveStorage(st);
                            renderPaletteOptions(); renderSwatches(); applyRules(); alert('Imported palette: '+name);
                        }catch(e){ alert('Import palette failed: '+e); }
                        finally{ importPaletteFile.value = ''; }
                    });

                    // when a Bar # is entered, auto-fill the selector based on chosen mode
                    if(barIndexInput){
                        barIndexInput.addEventListener('input', ()=>{
                            try{
                                const v = (barIndexInput.value||'').toString().trim();
                                if(!v){ return; }
                                const num = parseInt(v,10);
                                if(isNaN(num) || num <= 0) return;
                                const mode = (barModeSel && barModeSel.value) ? barModeSel.value : 'auto';
                                if(mode === 'series'){
                                    const sidx = Math.max(0, num-1);
                                    selInput.value = `.assignments-progress-chart .highcharts-series-${sidx} .highcharts-point`;
                                    targetSel.value = 'all';
                                    targetN.style.display = 'none';
                                }else{
                                    // point or auto default to point-prefill
                                    selInput.value = '.assignments-progress-chart .highcharts-series-0 .highcharts-point';
                                    targetSel.value = 'nth';
                                    targetN.value = num;
                                    targetN.style.display = 'inline-block';
                                }
                            }catch(e){}
                        });
                    }

                    if(barPrevBtn){
                        barPrevBtn.addEventListener('click', ()=>{
                            try{
                                let v = parseInt(barIndexInput.value||'1',10);
                                if(isNaN(v) || v<1) v = 1;
                                v = Math.max(1, v-1);
                                barIndexInput.value = v; barIndexInput.dispatchEvent(new Event('input'));
                                // show preview of new selection
                                previewBtn.click();
                            }catch(e){}
                        });
                    }
                    if(barNextBtn){
                        barNextBtn.addEventListener('click', ()=>{
                            try{
                                let v = parseInt(barIndexInput.value||'0',10);
                                if(isNaN(v) || v<0) v = 0;
                                v = v+1;
                                barIndexInput.value = v; barIndexInput.dispatchEvent(new Event('input'));
                                previewBtn.click();
                            }catch(e){}
                        });
                    }

                    let previewActive = false;
                    function clearPreview(){
                        document.querySelectorAll('[data-mb-gb-preview]').forEach(el=>{
                            try{
                                el.style.removeProperty('background');
                                el.style.removeProperty('background-color');
                                el.style.removeProperty('fill');
                                el.style.removeProperty('stroke');
                            }catch(e){}
                            el.removeAttribute('data-mb-gb-preview');
                            try{ el.removeAttribute('data-mb-gb-preview-color'); }catch(e){}
                        });
                        previewActive = false;
                    }

                    previewBtn.addEventListener('click', ()=>{
                        let selector = selInput.value.trim();
                        const color = colorInput.value;
                        let target = targetSel.value;
                        let n = parseInt(targetN.value||1,10);
                        const barIdx = (barIndexInput && barIndexInput.value) ? barIndexInput.value.toString().trim() : '';
                        const mode = (barModeSel && barModeSel.value) ? barModeSel.value : 'auto';
                        clearPreview();
                        if(barIdx){
                            const num = parseInt(barIdx,10);
                            if(!isNaN(num) && num>0){
                                if(mode === 'series'){
                                    const sidx = Math.max(0, num-1);
                                    selector = `.assignments-progress-chart .highcharts-series-${sidx} .highcharts-point`;
                                    target = 'all';
                                }else if(mode === 'point'){
                                    selector = '.assignments-progress-chart .highcharts-series-0 .highcharts-point';
                                    target = 'nth';
                                    n = num;
                                    targetSel.value = 'nth';
                                    targetN.value = n;
                                    targetN.style.display = 'inline-block';
                                }else{
                                    // auto: try series mapping first, fall back to point indexing
                                    const sidx = Math.max(0, num-1);
                                    const selSeries = `.assignments-progress-chart .highcharts-series-${sidx} .highcharts-point`;
                                    const nodesSeries = Array.from(document.querySelectorAll(selSeries));
                                    if(nodesSeries.length){
                                        selector = selSeries; target = 'all';
                                    }else{
                                        selector = '.assignments-progress-chart .highcharts-series-0 .highcharts-point';
                                        target = 'nth';
                                        n = num;
                                        targetSel.value = 'nth';
                                        targetN.value = n;
                                        targetN.style.display = 'inline-block';
                                    }
                                }
                            }
                        }
                        if(!selector) return alert('Enter selector to preview');
                        try{
                            const nodes = Array.from(document.querySelectorAll(selector));
                            if(!nodes.length) return alert('No elements match that selector on this page');
                            const st = loadStorage();
                            const usePalette = !!st.usePalette;
                            const palette = (function(){ if(!st.activePalette) return []; if(typeof st.activePalette === 'string' && st.activePalette.indexOf('user:')===0){ const idx = parseInt(st.activePalette.split(':')[1],10); return (st.palettes && st.palettes[idx] && st.palettes[idx].colors) || []; } return PRESET_PALETTES[st.activePalette] || []; })();
                            if(usePalette && (!palette || !palette.length)) return alert('No palette selected for preview');
                            const applyIndex = (idx)=>{
                                const el = nodes[idx];
                                if(!el) return;
                                try{
                                    if(usePalette){
                                        const c = palette[Math.floor(Math.random()*palette.length)];
                                        el.style.setProperty('background', c, 'important'); el.style.setProperty('background-color', c, 'important');
                                        try{ el.style.setProperty('fill', c, 'important'); el.style.setProperty('stroke', c, 'important'); if(typeof SVGElement !== 'undefined' && el instanceof SVGElement){ el.setAttribute('fill', c); el.setAttribute('stroke', c); } }catch(e){}
                                        el.setAttribute('data-mb-gb-preview-color', c);
                                    }else{
                                        el.style.setProperty('background', color, 'important'); el.style.setProperty('background-color', color, 'important');
                                        try{ el.style.setProperty('fill', color, 'important'); el.style.setProperty('stroke', color, 'important'); if(typeof SVGElement !== 'undefined' && el instanceof SVGElement){ el.setAttribute('fill', color); el.setAttribute('stroke', color); } }catch(e){}
                                    }
                                }catch(e){}
                                el.setAttribute('data-mb-gb-preview','1');
                            };
                            if(target === 'all') nodes.forEach((_,i)=>applyIndex(i));
                            else if(target === 'first') applyIndex(0);
                            else if(target === 'nth') applyIndex(Math.max(0, n-1));
                            previewActive = true;
                        }catch(e){ alert('Invalid selector or error during preview'); }
                    });

                    panel.querySelector('#mb-gb-add').addEventListener('click', ()=>{
                        let selector = selInput.value.trim();
                        const color = colorInput.value;
                        // Force new additions to be global so changes apply to all classes
                        const scope = 'global';
                        let target = targetSel.value;
                        let nth = parseInt(targetN.value||1,10);
                        const name = nameInput.value.trim();
                        const barIdx = (barIndexInput && barIndexInput.value) ? barIndexInput.value.toString().trim() : '';
                        const mode = (barModeSel && barModeSel.value) ? barModeSel.value : 'auto';
                        if(barIdx){
                            const num = parseInt(barIdx,10);
                            if(!isNaN(num) && num>0){
                                if(mode === 'series'){
                                    const sidx = Math.max(0, num-1);
                                    selector = `.assignments-progress-chart .highcharts-series-${sidx} .highcharts-point`;
                                    target = 'all';
                                }else if(mode === 'point'){
                                    selector = '.assignments-progress-chart .highcharts-series-0 .highcharts-point';
                                    target = 'nth';
                                    nth = num;
                                }else{
                                    // auto: prefer series mapping if it yields nodes
                                    const sidx = Math.max(0, num-1);
                                    const selSeries = `.assignments-progress-chart .highcharts-series-${sidx} .highcharts-point`;
                                    if(document.querySelectorAll(selSeries).length){
                                        selector = selSeries; target = 'all';
                                    }else{
                                        selector = '.assignments-progress-chart .highcharts-series-0 .highcharts-point';
                                        target = 'nth'; nth = num;
                                    }
                                }
                            }
                        }
                        if(!selector) return alert('Please enter a selector or a Bar #');
                        const rule = { selector, color, target, nth: isNaN(nth)?1:nth, name };
                        addRuleToStorage(rule, scope);
                        renderRules(); applyRules(); renderSwatches();
                        clearPreview();
                    });

                    panel.querySelector('#mb-gb-apply').addEventListener('click', ()=>{ clearPreview(); applyRules(); });

                    const importFileInput = panel.querySelector('#mb-gb-import-file');
                    const importBtn = panel.querySelector('#mb-gb-import-btn');
                    const exportBtn = panel.querySelector('#mb-gb-export');

                    exportBtn.addEventListener('click', ()=>{
                        try{
                            const st = loadStorage();
                            const data = JSON.stringify(st, null, 2);
                            const blob = new Blob([data], {type: 'application/json'});
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            const ts = new Date(); const pad = n => n.toString().padStart(2,'0');
                            a.download = `mb-gradebars-rules-${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.json`;
                            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
                            alert('Exported rules');
                        }catch(e){ alert('Export failed: '+e); }
                    });

                    importBtn.addEventListener('click', ()=>{ if(importFileInput) importFileInput.click(); });

                    importFileInput && importFileInput.addEventListener('change', async (ev)=>{
                        const f = ev.target && ev.target.files && ev.target.files[0];
                        if(!f) return;
                        try{
                            const txt = await f.text();
                            let obj = JSON.parse(txt);
                            if(Array.isArray(obj)){
                                obj = {version:1, defaultRules: obj, scoped: {}, recentColors: []};
                            }else{
                                obj.version = obj.version || 1;
                                obj.defaultRules = obj.defaultRules || [];
                                obj.scoped = obj.scoped || {};
                                obj.recentColors = obj.recentColors || [];
                            }
                            const replace = confirm('Replace existing rules with imported data? Click OK to replace, Cancel to merge');
                            if(replace){
                                // Flatten any scoped rules into defaultRules so imported rules apply globally
                                const flattened = (obj.defaultRules || []).concat(
                                    Object.keys(obj.scoped || {}).reduce((acc, k) => acc.concat(obj.scoped[k] || []), [])
                                );
                                obj.defaultRules = flattened;
                                obj.scoped = {};
                                saveStorage(obj);
                            }else{
                                const st = loadStorage();
                                const keyOf = r => `${r.selector}||${r.color}||${r.target||''}||${r.nth||''}||${r.name||''}`;
                                const existing = st.defaultRules || [];
                                const existingSet = new Set(existing.map(keyOf));
                                (obj.defaultRules||[]).forEach(r => { const k = keyOf(r); if(!existingSet.has(k)){ existing.push(r); existingSet.add(k); }});
                                // Merge any scoped rules from imported data into the global defaultRules
                                for(const sk in obj.scoped){
                                    (obj.scoped[sk]||[]).forEach(r => { const k = keyOf(r); if(!existingSet.has(k)){ existing.push(r); existingSet.add(k); }});
                                }
                                st.defaultRules = existing;
                                // do not preserve imported scoped entries — they are flattened into global defaults
                                // merge recentColors
                                st.recentColors = Array.from(new Set([].concat(st.recentColors||[], obj.recentColors||[]))).slice(0,50);
                                saveStorage(st);
                            }
                            renderSwatches(); renderRules(); applyRules();
                            alert('Import complete');
                        }catch(e){ alert('Import failed: '+e); }
                        finally{ importFileInput.value = ''; }
                    });

                    panel.querySelector('#mb-gb-reset').addEventListener('click', () =>{
                        if(!confirm('Reset all saved rules?')) return; saveStorage({version:1, defaultRules:[], scoped:{}, recentColors:[], palettes: [], activePalette: null, usePalette: false}); renderRules(); applyRules(); renderSwatches();
                    });
                })();
        }

    // Render rules
    function renderRules(){
        const rules = getCombinedRules();
        const container = document.getElementById('mb-gb-rules');
        if(!container) return;
        container.innerHTML = '';
        if(!rules || rules.length === 0){ container.innerHTML = '<div style="color:#666;font-size:13px;padding:6px">No rules yet — add a selector + color</div>'; return; }
        rules.forEach((r, idx)=>{
            const enabled = (typeof r.enabled === 'undefined') ? true : !!r.enabled;
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px;border-radius:6px;border:1px solid #f0f0f0;background:#fbfbfb;margin-bottom:6px';
            if(!enabled) row.style.opacity = '0.5';

            const enToggle = document.createElement('input');
            enToggle.type = 'checkbox'; enToggle.checked = enabled; enToggle.title = 'Enable rule'; enToggle.style.cssText = 'width:16px;height:16px;margin-left:2px;margin-right:6px';
            enToggle.addEventListener('change', ()=>{ toggleRuleEnabled(r._scope === 'global' ? 'global' : r._scope, r._idx, enToggle.checked); renderRules(); applyRules(); });

            const sw = document.createElement('div'); sw.style.cssText = `width:28px;height:20px;border-radius:4px;background:${r.color};border:1px solid rgba(0,0,0,0.06)`;
            const desc = document.createElement('div');
            desc.style.flex = '1'; desc.style.fontSize='13px'; desc.style.color='#222';
            const nameText = r.name ? (`${r.name} — `) : '';
            desc.textContent = nameText + r.selector;

            const scopeLabel = document.createElement('div');
            scopeLabel.style.cssText = 'font-size:11px;color:#666;padding:2px 6px;border-radius:6px;background:#fff;margin-left:6px;border:1px solid #eee';
            scopeLabel.textContent = (r._scope === 'global') ? 'All pages' : (r._scope && r._scope.startsWith('class:') ? `Class ${r._scope.split(':')[1]}` : r._scope);

            const copyBtn = document.createElement('button'); copyBtn.textContent='Copy'; copyBtn.title='Copy selector'; copyBtn.style.cssText='font-size:12px;padding:4px 6px;border-radius:6px;border:1px solid #ddd;background:#fff;cursor:pointer;margin-left:6px';
            copyBtn.addEventListener('click', ()=>{ try{ navigator.clipboard.writeText(r.selector); }catch(e){ prompt('Selector', r.selector); } });

            const del = document.createElement('button'); del.textContent='✕'; del.title='Delete rule'; del.style.cssText='border:none;background:none;color:#a00;cursor:pointer;font-weight:600;margin-left:6px';
            del.addEventListener('click', ()=>{ if(!confirm('Delete this rule?')) return; deleteRuleFromStorage(r._scope === 'global' ? 'global' : r._scope, r._idx); renderRules(); applyRules(); });

            row.appendChild(enToggle);
            row.appendChild(sw); row.appendChild(desc); row.appendChild(scopeLabel); row.appendChild(copyBtn); row.appendChild(del);
            container.appendChild(row);
        });
    }

    function applyRules(){
        const prev = document.getElementById('mb-gb-style'); if(prev) prev.remove();
        const rules = getCombinedRules().filter(r => r.enabled !== false); if(!rules || rules.length===0) return;
        const st = loadStorage();
        const usePalette = !!st.usePalette;
        let activeColors = [];
        if(usePalette && st.activePalette){
            if(typeof st.activePalette === 'string' && st.activePalette.indexOf('user:') === 0){
                const idx = parseInt(st.activePalette.split(':')[1],10);
                activeColors = (st.palettes && st.palettes[idx] && st.palettes[idx].colors) || [];
            }else{
                activeColors = PRESET_PALETTES[st.activePalette] || [];
            }
        }

        const sheet = document.createElement('style'); sheet.id = 'mb-gb-style';
        sheet.type = 'text/css';
        const css = rules.map(r => {
            if(usePalette && activeColors && activeColors.length){
                return `${r.selector} { background-image: none !important; box-shadow: none !important; color: inherit !important; }
                        ${r.selector} * { color: inherit !important; }`;
            }
            // ensure we override common properties and handle SVG fills/strokes
            return `${r.selector} { background-image: none !important; background: ${r.color} !important; background-color: ${r.color} !important; border-color: ${r.color} !important; box-shadow: none !important; color: inherit !important; fill: ${r.color} !important; stroke: ${r.color} !important; }
                    ${r.selector} * { color: inherit !important; }
                    ${r.selector} rect, ${r.selector} path, ${r.selector} circle, ${r.selector} polygon, ${r.selector} g { fill: ${r.color} !important; stroke: ${r.color} !important; }`;
        }).join('\n');
        sheet.appendChild(document.createTextNode(css));
        document.head.appendChild(sheet);

        // also set inline style and attributes for matched elements and SVG children
        rules.forEach(r => {
            try{
                const nodes = Array.from(document.querySelectorAll(r.selector));
                nodes.forEach(el => {
                    if(usePalette && activeColors && activeColors.length){
                        try{
                            let assigned = el.getAttribute('data-mb-gb-palette-color');
                            if(!assigned){ assigned = activeColors[Math.floor(Math.random()*activeColors.length)]; try{ el.setAttribute('data-mb-gb-palette-color', assigned); }catch(e){} }
                            el.style.setProperty('background', assigned, 'important');
                            el.style.setProperty('background-color', assigned, 'important');
                            el.style.setProperty('border-color', assigned, 'important');
                        }catch(e){}
                        try{
                            el.style.setProperty('fill', assigned, 'important');
                            el.style.setProperty('stroke', assigned, 'important');
                            if (typeof SVGElement !== 'undefined' && el instanceof SVGElement) { el.setAttribute('fill', assigned); el.setAttribute('stroke', assigned); }
                        }catch(e){}
                    }else{
                        try {
                            el.style.setProperty('background', r.color, 'important');
                            el.style.setProperty('background-color', r.color, 'important');
                            el.style.setProperty('border-color', r.color, 'important');
                        } catch(e){}

                        try {
                            el.style.setProperty('fill', r.color, 'important');
                            el.style.setProperty('stroke', r.color, 'important');
                            if (typeof SVGElement !== 'undefined' && el instanceof SVGElement) {
                                el.setAttribute('fill', r.color);
                                el.setAttribute('stroke', r.color);
                            }
                        } catch(e){}
                    }

                    // if child elements use width for the filled portion, color those too
                    el.querySelectorAll('*').forEach(c => {
                        try {
                            if(c.style && c.style.width && c.style.width.includes('%')){
                                const col = (usePalette && activeColors && activeColors.length) ? (el.getAttribute('data-mb-gb-palette-color') || r.color) : r.color;
                                c.style.setProperty('background', col, 'important');
                                c.style.setProperty('background-color', col, 'important');
                            }
                            // also apply to SVG child shapes
                            if (typeof SVGElement !== 'undefined' && c instanceof SVGElement) {
                                const colSvg = (usePalette && activeColors && activeColors.length) ? (el.getAttribute('data-mb-gb-palette-color') || r.color) : r.color;
                                c.style.setProperty('fill', colSvg, 'important');
                                c.style.setProperty('stroke', colSvg, 'important');
                                c.setAttribute && c.setAttribute('fill', colSvg);
                                c.setAttribute && c.setAttribute('stroke', colSvg);
                            }
                        } catch(e){}
                    });
                });
            }catch(e){ /* ignore */ }
        });
    }


    // initial UI + apply
    try{ createUI(); }catch(e){}
    renderRules(); applyRules();

    // re-apply when DOM mutates (pages with SPA dynamics) and recreate UI if removed
    const mo = new MutationObserver(()=>{ if(!document.getElementById('mb-gb-toggle')) try{ createUI(); }catch(e){}; applyRules(); });
    mo.observe(document.body, {childList:true,subtree:true,attributes:false});

    // Recreate UI on common SPA navigation events (Turbolinks / Turbo)
    ['turbolinks:load','turbolinks:render','turbo:load','turbo:render','pjax:end','popstate'].forEach(ev=>{
        document.addEventListener(ev, ()=>{ try{ createUI(); renderRules(); applyRules(); }catch(e){} });
    });

    // Optional menu command
    try{
        if(typeof GM_registerMenuCommand === 'function'){
            GM_registerMenuCommand('Grade Bars: Open panel', ()=>{
                let panelEl = document.getElementById('mb-gradebar-colorizer-panel');
                if(!panelEl) { try{ createUI(); }catch(e){} panelEl = document.getElementById('mb-gradebar-colorizer-panel'); }
                if(panelEl){ panelEl.style.display = 'block'; panelEl.scrollIntoView({behavior:'smooth',block:'center'}); }
            });
        }
    }catch(e){ /* ignore */ }

})();
