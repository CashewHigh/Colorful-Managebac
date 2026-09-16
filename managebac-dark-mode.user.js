// ==UserScript==
// @name         ManageBac Dark Mode Theme
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  ManageBac theme layer with System, Light, and Dark modes across Home, Timetables, Calendar, Tasks & Deadlines, Task Details and Class pages.
// @author       The Interwebs
// @match        https://*.managebac.cn/*
// @match        https://managebac.cn/*
// @match        https://*.managebac.com/*
// @match        https://managebac.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const STYLE_ID = 'mb-dark-mode-theme-styles';

    // Maximum-specificity CSS overrides
    const darkThemeStyles = `
        :root {
            --mb-bg-main: #0d1117;
            --mb-bg-card: #161b22;
            --mb-bg-hover: #21262d;
            --mb-border: #30363d;
            --mb-text-main: #c9d1d9;
            --mb-text-muted: #8b949e;
            --mb-accent: #58a6ff;
            --mb-accent-hover: #79c0ff;
        }

        /* 1. FORCE GLOBAL WRAPPERS & UTILITY BACKGROUNDS
           (matches the real f-layout-main__* structure ManageBac ships today) */
        html body,
        html body #wrapper,
        html body .wrapper,
        html body #content,
        html body #main,
        html body #main-content,
        html body .main-content,
        html body .f-layout-main,
        html body .f-layout-main__wrapper,
        html body .f-layout-main__content,
        html body .f-layout-main__body,
        html body .f-layout-main__body--blank,
        html body .bg-gray-100,
        html body .bg-gray-50,
        html body .bg-white {
            background-color: var(--mb-bg-main) !important;
            color: var(--mb-text-main) !important;
        }

        /* 2. CONTAINERS, CARDS, TILES, PANELS & MODALS */
        html body .card,
        html body .card-header,
        html body .card-body,
        html body .card-footer,
        html body .card-tinted,
        html body .panel,
        html body .box,
        html body .ibox,
        html body .block,
        html body .f-tile,
        html body .f-tile__body,
        html body .f-task-tile,
        html body .f-panel-header,
        html body .modal-content,
        html body .modal-header,
        html body .modal-footer,
        html body .dropdown-menu,
        html body .f-cookie-consent-modal,
        html body .global-search-modal,
        html body .widget,
        html body .list-group-item,
        html body .well,
        html body .f-card,
        html body .upcoming-event-item,
        html body .offcanvas-header,
        html body .offcanvas-body,
        html body .offcanvas-footer,
        html body #sidebar-offcanvas,
        html body #message-notifications-modal,
        html body #modal-box-wrapper {
            background-color: var(--mb-bg-card) !important;
            border-color: var(--mb-border) !important;
            color: var(--mb-text-main) !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
        }

        /* 3. TOP NAVBAR, SIDEBAR & SUBMENUS
           (real classes: navbar-grid/navbar-row/navbar-brand-wrapper,
           f-layout-main__sidebar.css-sidebar, f-sidebar-*, f-menu__submenu*) */
        html body .navbar,
        html body .navbar-grid,
        html body .navbar-row,
        html body .navbar-brand-wrapper,
        html body .navbar-search-wrapper,
        html body .f-menu,
        html body .sidebar,
        html body .f-layout-main__sidebar,
        html body .css-sidebar,
        html body .f-sidebar-wrapper,
        html body .f-sidebar-tabs,
        html body .f-menu__submenu,
        html body .f-menu__submenu-item,
        html body .main-header,
        html body .menu-bar,
        html body .sub-navigation {
            background-color: var(--mb-bg-card) !important;
            border-color: var(--mb-border) !important;
        }

        html body .navbar-inner,
        html body .nav-tabs,
        html body .nav-pills {
            background: var(--mb-bg-card) !important;
            border-color: var(--mb-border) !important;
        }

        /* 3b. DEFENSIVE CATCH-ALL for sidebar panels on newer ManageBac
           dashboard builds whose container classes differ from the ones
           above (e.g. hashed/CSS-in-JS class names). Matches by partial
           class/id/role/aria-label instead of an exact class. */
        html body [class*="sidebar" i],
        html body [class*="Sidebar" i],
        html body [id*="sidebar" i],
        html body nav[aria-label*="sidebar" i],
        html body [role="navigation"],
        html body aside {
            background-color: var(--mb-bg-card) !important;
            border-color: var(--mb-border) !important;
        }

        /* Text inside those panels: only recolor plain text nodes, not
           icons/badges, so colored program labels etc. stay intact */
        html body [class*="sidebar" i] > *,
        html body aside > * {
            color: var(--mb-text-main);
        }

        /* 3c. THE ACTUAL MAIN NAV, confirmed from live markup:
           <nav id="menu" class="f-menu f-menu--expanded"> ... </nav>
           Anchored on the #menu id so this wins the specificity fight
           against ManageBac's own (also !important) light-theme rules. */
        html body#action-show #menu,
        html body #menu,
        html body #menu.f-menu,
        html body #menu .f-menu__nav,
        html body #menu .f-menu__item,
        html body #menu .f-menu__submenu,
        html body #menu .f-menu__submenu-item {
            background: var(--mb-bg-card) !important;
            background-color: var(--mb-bg-card) !important;
            border-color: var(--mb-border) !important;
        }

        html body #menu .f-menu__link,
        html body #menu .f-menu__link-title,
        html body #menu .f-menu__submenu-link,
        html body #menu .f-menu__submenu-link-title,
        html body #menu .text-node,
        html body #menu svg {
            color: var(--mb-text-main) !important;
            fill: var(--mb-text-main) !important;
        }

        html body #menu .f-menu__link.active,
        html body #menu .f-menu__nav-link.active,
        html body #menu .f-menu__submenu-link.active {
            background-color: var(--mb-bg-hover) !important;
            color: var(--mb-accent) !important;
        }

        html body #menu .f-menu__link.active svg,
        html body #menu .f-menu__nav-link.active svg {
            fill: var(--mb-accent) !important;
        }

        html body #menu .f-menu__item.opened > .f-menu__submenu {
            background-color: var(--mb-bg-card) !important;
        }

        /* Leave the Faria Service Manager logo's own brand-color SVG alone */
        html body #menu .faria-one svg,
        html body #menu .faria-one svg * {
            fill: revert !important;
        }

        /* 4. TYPOGRAPHY & INVERSE TEXT LEAKS */
        html body h1, html body h2, html body h3, html body h4, html body h5, html body h6,
        html body .fs-1, html body .fs-2, html body .fs-3, html body .fs-4, html body .fs-5, html body .fs-6,
        html body p, html body div, html body label, html body th, html body td, html body .text-node,
        html body .f-menu__submenu-link-title, html body .f-menu__link-title,
        html body .f-title, html body .card-header-title, html body .accordion-header-title,
        html body .title, html body .heading,
        html body strong, html body b, html body .text-dark,
        html body .color-gray-800, html body .color-gray-900, html body .link-dark {
            color: var(--mb-text-main) !important;
        }

        /* Secondary muted content */
        html body .text-muted, html body .text-secondary, html body .color-secondary,
        html body .color-gray-500, html body .color-gray-600, html body .help-block,
        html body .help-block b, html body .hint, html body .date, html body .time {
            color: var(--mb-text-muted) !important;
        }

        /* Links & interactive anchors */
        html body a, html body .f-menu__link, html body .f-menu__nav-link,
        html body .f-menu__submenu-link, html body .dropdown-item, html body .nav-link, html body .f-link {
            color: var(--mb-accent) !important;
            background-color: transparent !important;
        }

        html body a:hover, html body .f-menu__link:hover, html body .f-menu__nav-link:hover,
        html body .f-menu__submenu-link:hover, html body .dropdown-item:hover,
        html body .nav-link:hover, html body .nav-link.active,
        html body .f-menu__submenu-link.active {
            color: var(--mb-accent-hover) !important;
            background-color: var(--mb-bg-hover) !important;
        }

        /* 5. DATA TABLES, ACCORDIONS & MATRIX GRIDS */
        html body table, html body .table, html body tr, html body th, html body td,
        html body tbody, html body thead {
            background-color: transparent !important;
            border-color: var(--mb-border) !important;
            color: var(--mb-text-main) !important;
        }

        html body .table-striped tbody tr:nth-of-type(odd) {
            background-color: rgba(255, 255, 255, 0.03) !important;
        }

        html body .accordion,
        html body .accordion-item,
        html body .accordion-header,
        html body .accordion-button,
        html body .accordion-collapse,
        html body .accordion-body {
            background-color: var(--mb-bg-card) !important;
            border-color: var(--mb-border) !important;
            color: var(--mb-text-main) !important;
        }

        html body .accordion-button:not(.collapsed) {
            background-color: var(--mb-bg-hover) !important;
        }

        /* 5b. POPOVERS — member/user info cards on Task Details & Class
           pages (.user-popover, .fusion-popover, .compact.popover-sm are
           all just modifier classes on the same underlying .popover) */
        html body .popover,
        html body .popover-header,
        html body .popover-body {
            background-color: var(--mb-bg-card) !important;
            border-color: var(--mb-border) !important;
            color: var(--mb-text-main) !important;
        }

        html body .popover .popover-arrow::before {
            border-top-color: var(--mb-border) !important;
            border-right-color: var(--mb-border) !important;
            border-bottom-color: var(--mb-border) !important;
            border-left-color: var(--mb-border) !important;
        }

        html body .popover .popover-arrow::after {
            border-top-color: var(--mb-bg-card) !important;
            border-right-color: var(--mb-bg-card) !important;
            border-bottom-color: var(--mb-bg-card) !important;
            border-left-color: var(--mb-bg-card) !important;
        }

        /* 5c. SIDEBAR LIST PANELS — used for member lists / activity feeds
           on Class and Task Details pages */
        html body .list-item,
        html body .sidebar-box-item {
            background-color: transparent !important;
            border-color: var(--mb-border) !important;
            color: var(--mb-text-main) !important;
        }

        html body .list-item:nth-child(even) {
            background-color: rgba(255, 255, 255, 0.03) !important;
        }

        /* 6. FULLCALENDAR (fc-*) — the unit/upcoming-events calendar widget */
        html body .fc-event, html body .fc-agenda-view, html body .calendar-box,
        html body .m-calendar, html body .calendar,
        html body .fc-scrollgrid, html body .fc-scrollgrid-section,
        html body .fc-col-header-cell, html body .fc-daygrid-day,
        html body .fc-daygrid-day-frame, html body .fc-daygrid-day-bg,
        html body .fc-daygrid-day-events, html body .fc-daygrid-day-bottom {
            background-color: var(--mb-bg-card) !important;
            border-color: var(--mb-border) !important;
            color: var(--mb-text-main) !important;
        }

        html body .fc-day-sun,
        html body .fc-day-today {
            background-color: var(--mb-bg-hover) !important;
        }

        html body .fc-day-inner-num {
            background-color: var(--mb-accent) !important;
            color: #0d1117 !important;
        }

        /* 6b. COLOUR-CODED TIMETABLE & CALENDAR CHIPS
           ManageBac derives each class/period chip's background by mixing
           its course colour toward WHITE via color-mix() on --f-color-box-*
           custom properties (.f-timetable-item, .f-calendar-item, badges).
           Re-point those same variables at our dark card colour instead of
           #fff so every course keeps its own hue instead of washing out to a
           near-white block. Needs a browser with CSS color-mix() support. */
        html body .color-box-custom,
        html body .f-timetable-item,
        html body .f-calendar-item {
            --f-color-box-bg: color-mix(in srgb, var(--f-color-box-color, currentColor) 30%, var(--mb-bg-card)) !important;
            --f-color-box-bg-light: color-mix(in srgb, var(--f-color-box-color, currentColor) 18%, var(--mb-bg-card)) !important;
            --f-color-box-border-dark: color-mix(in srgb, var(--f-color-box-color, currentColor) 55%, var(--mb-bg-card)) !important;
            border-color: color-mix(in srgb, var(--f-color-box-color, currentColor) 55%, var(--mb-bg-card)) !important;
        }

        /* Neutral (gray/theme) chips that don't carry a course colour */
        html body .color-box-gray,
        html body .color-box-theme,
        html body .badge.color-box-gray {
            background-color: var(--mb-bg-hover) !important;
            border-color: var(--mb-border) !important;
            color: var(--mb-text-main) !important;
        }

        /* Mini attendance-style calendar */
        html body table.calendar td.day:not([style]) {
            background-color: var(--mb-bg-card) !important;
            color: var(--mb-text-main) !important;
            border-color: var(--mb-border) !important;
        }

        html body table.calendar td.day.today:not([style]) {
            background-color: var(--mb-bg-hover) !important;
        }

        /* Grade/assessment grid cells */
        html body .assessment,
        html body .assessment-cell {
            background-color: var(--mb-bg-hover) !important;
            border-color: var(--mb-border) !important;
        }

        /* 6c. .f-hero */
        html body .f-hero {
            background-color: var(--mb-bg-card) !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4) !important;
        }

        html body #layout-hero {
            background-color: var(--mb-bg-card) !important;
        }

        html body .f-hero__icon {
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4) !important;
        }

        /* 6d. Empty-state panels */
        html body .blank-slate-container {
            background-color: var(--mb-bg-card) !important;
        }

        html body .blank-slate-container::before {
            display: none !important;
        }

        html body .blank-slate-content,
        html body .blank-slate-content .h4,
        html body .blank-slate-content p {
            color: var(--mb-text-main) !important;
        }

        /* 6e. Date badge — intentionally remains bright */
        html body .date-badge .day {
            background-color: #fff !important;
            color: #293041 !important;
        }

        /* 6f. Show-more text fade */
        html body .show-more::after,
        html body .show-more.active::after {
            box-shadow: 0 -12.75px 12.75px var(--mb-bg-card) inset !important;
        }

        /* Dividers & borders */
        html body .dropdown-divider, html body hr, html body .divider,
        html body .offcanvas-header.border-bottom {
            border-top: 1px solid var(--mb-border) !important;
            border-bottom-color: var(--mb-border) !important;
            opacity: 1 !important;
        }

        /* 7. FORM FIELDS & INTERACTIVE CONTROLS */
        html body input, html body select, html body textarea,
        html body .form-control, html body .form-select, html body .search-bar,
        html body #global-search-q, html body #nav-search-form input {
            background-color: var(--mb-bg-hover) !important;
            color: var(--mb-text-main) !important;
            border: 1px solid var(--mb-border) !important;
            border-radius: 6px !important;
        }

        html body input:focus, html body select:focus, html body textarea:focus,
        html body .form-control:focus {
            border-color: var(--mb-accent) !important;
            box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.25) !important;
            background-color: var(--mb-bg-hover) !important;
        }

        /* Buttons & badges */
        html body .btn-secondary, html body .btn-blank, html body .btn-icon,
        html body .btn-default, html body .btn-light {
            background-color: var(--mb-bg-hover) !important;
            color: var(--mb-text-main) !important;
            border: 1px solid var(--mb-border) !important;
        }

        html body .btn-secondary:hover, html body .btn-blank:hover, html body .btn-icon:hover,
        html body .btn-default:hover, html body .btn-light:hover {
            background-color: var(--mb-border) !important;
            color: #ffffff !important;
        }

        /* Keep colored program/course labels intact */
        html body .badge-label, html body .badge.color-box-gray,
        html body .f-badge-key, html body .label.label-key {
            background-color: var(--mb-bg-hover) !important;
            border: 1px solid var(--mb-border) !important;
            color: var(--mb-text-main) !important;
        }

        /* 8. HIGHCHARTS DATA GRAPHS & CORE ANALYTICS PLOTS */
        html body .highcharts-background {
            fill: var(--mb-bg-card) !important;
        }

        html body .highcharts-text-outline {
            stroke: var(--mb-bg-card) !important;
            fill: var(--mb-bg-card) !important;
        }

        html body .highcharts-title, html body .highcharts-axis-labels text,
        html body .highcharts-legend-item text, html body .highcharts-label text {
            fill: var(--mb-text-main) !important;
            color: var(--mb-text-main) !important;
        }

        html body .highcharts-grid-line, html body .highcharts-axis-line {
            stroke: var(--mb-border) !important;
        }

        html body .highcharts-plot-background, html body .highcharts-plot-border {
            fill: transparent !important;
            stroke: var(--mb-border) !important;
        }

        html body .highcharts-tooltip-box, html body .highcharts-label-box.highcharts-tooltip-box {
            fill: var(--mb-bg-card) !important;
            stroke: var(--mb-border) !important;
        }

        html body .highcharts-tooltip text, html body .highcharts-tooltip tspan {
            fill: var(--mb-text-main) !important;
        }

        /* 9. GRAPHIC ASSETS & UTILITIES */
        html body svg, html body .fi, html body .sebo-icon {
            filter: brightness(0.9) contrast(1.1);
        }

        html body .spinner-border, html body .f-spinner {
            color: var(--mb-accent) !important;
        }

        /* Custom scrollbars */
        ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
        }

        ::-webkit-scrollbar-track {
            background: var(--mb-bg-main);
        }

        ::-webkit-scrollbar-thumb {
            background: var(--mb-border);
            border-radius: 5px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--mb-bg-hover);
        }
    `;

    const STORAGE_KEY = 'mb_theme_preference';
    const THEME_SYSTEM = 'system';
    const THEME_LIGHT = 'light';
    const THEME_DARK = 'dark';

    const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    function getThemePreference() {
        const saved = GM_getValue(STORAGE_KEY, THEME_SYSTEM);
        return [THEME_SYSTEM, THEME_LIGHT, THEME_DARK].includes(saved)
            ? saved
            : THEME_SYSTEM;
    }

    function setThemePreference(preference) {
        GM_setValue(STORAGE_KEY, preference);
        injectOrClearCSS();
        refreshToggleUI();
        refreshThemeMenu();
    }

    function isDarkThemeEnabled() {
        const preference = getThemePreference();

        if (preference === THEME_DARK) return true;
        if (preference === THEME_LIGHT) return false;

        return systemThemeQuery.matches;
    }

    function getThemeLabel() {
        const preference = getThemePreference();

        if (preference === THEME_DARK) return 'Dark';
        if (preference === THEME_LIGHT) return 'Light';
        return systemThemeQuery.matches ? 'System → Dark' : 'System → Light';
    }

    function injectOrClearCSS() {
        let node = document.getElementById(STYLE_ID);

        if (isDarkThemeEnabled()) {
            if (!node) {
                node = document.createElement('style');
                node.id = STYLE_ID;
                node.textContent = darkThemeStyles;
                document.head.appendChild(node);
            }
        } else {
            if (node) node.remove();
        }
    }

    function renderToggleButton() {
        if (document.getElementById('mb-darkmode-toggle')) return;

        const btn = document.createElement('button');
        btn.id = 'mb-darkmode-toggle';
        btn.type = 'button';
        btn.title = 'ManageBac theme';
        btn.setAttribute('aria-label', 'ManageBac theme');
        btn.style.cssText = 'position:fixed;right:70px;bottom:16px;z-index:2147483646;border:none;border-radius:10px;padding:9px 11px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,0.25);';

        btn.addEventListener('click', (event) => {
            event.stopPropagation();

            const menu = document.getElementById('mb-theme-menu');

            if (menu) {
                menu.style.display = menu.style.display === 'none'
                    ? 'block'
                    : 'none';
            }
        });

        document.body.appendChild(btn);

        createThemeMenu();
        refreshToggleUI();
    }

    function createThemeMenu() {
        if (document.getElementById('mb-theme-menu')) return;

        const menu = document.createElement('div');

        menu.id = 'mb-theme-menu';

        menu.style.cssText = [
            'position:fixed',
            'right:70px',
            'bottom:62px',
            'z-index:2147483647',
            'min-width:145px',
            'padding:6px',
            'border:1px solid #30363d',
            'border-radius:10px',
            'background:#161b22',
            'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
            'font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
            'display:none'
        ].join(';');

        [
            [THEME_SYSTEM, '🖥️  System'],
            [THEME_LIGHT, '☀️  Light'],
            [THEME_DARK, '🌙  Dark']
        ].forEach(([value, label]) => {
            const item = document.createElement('button');

            item.type = 'button';
            item.dataset.theme = value;
            item.textContent = label;

            item.style.cssText = [
                'display:block',
                'width:100%',
                'padding:8px 10px',
                'border:none',
                'border-radius:7px',
                'background:transparent',
                'color:#c9d1d9',
                'text-align:left',
                'font:inherit',
                'cursor:pointer'
            ].join(';');

            item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = '#21262d';
            });

            item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = 'transparent';
            });

            item.addEventListener('click', (event) => {
                event.stopPropagation();

                setThemePreference(value);

                menu.style.display = 'none';
            });

            menu.appendChild(item);
        });

        document.body.appendChild(menu);

        document.addEventListener('click', (event) => {
            const button = document.getElementById('mb-darkmode-toggle');

            if (
                !menu.contains(event.target) &&
                event.target !== button
            ) {
                menu.style.display = 'none';
            }
        });
    }

    function refreshThemeMenu() {
        const menu = document.getElementById('mb-theme-menu');

        if (!menu) return;

        const current = getThemePreference();

        menu.querySelectorAll('button[data-theme]').forEach((item) => {
            const selected = item.dataset.theme === current;

            item.style.fontWeight = selected ? '700' : '400';
            item.style.backgroundColor = selected
                ? '#21262d'
                : 'transparent';
        });
    }

    function refreshToggleUI() {
        const btn = document.getElementById('mb-darkmode-toggle');

        if (!btn) return;

        const preference = getThemePreference();

        if (preference === THEME_SYSTEM) {
            btn.textContent = systemThemeQuery.matches
                ? '☀️'
                : '🌙';
        } else if (preference === THEME_DARK) {
            btn.textContent = '🌙';
        } else {
            btn.textContent = '☀️';
        }

        btn.title = `ManageBac theme: ${getThemeLabel()}`;
        btn.setAttribute(
            'aria-label',
            `ManageBac theme: ${getThemeLabel()}`
        );

        if (isDarkThemeEnabled()) {
            btn.style.backgroundColor = '#ffffff';
            btn.style.color = '#000000';
        } else {
            btn.style.backgroundColor = '#161b22';
            btn.style.color = '#ffffff';
        }

        refreshThemeMenu();
    }

    // Run layout modifications immediately to intercept the rendering engine
    injectOrClearCSS();

    function initialize() {
        renderToggleButton();
    }

    const domObserver = new MutationObserver(() => {
        if (
            !document.getElementById('mb-darkmode-toggle') &&
            document.body
        ) {
            initialize();
        }

        // Fallback catch to verify CSS string presence on structural mutations
        injectOrClearCSS();
    });

    if (document.body) {
        initialize();

        domObserver.observe(
            document.body,
            {
                childList: true,
                subtree: true
            }
        );
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            initialize();

            domObserver.observe(
                document.body,
                {
                    childList: true,
                    subtree: true
                }
            );
        });
    }

    [
        'turbolinks:load',
        'turbolinks:render',
        'turbo:load',
        'turbo:render',
        'pjax:end',
        'popstate'
    ].forEach((event) => {
        document.addEventListener(event, () => {
            injectOrClearCSS();
            renderToggleButton();
        });
    });

    // Follow live OS/browser theme changes when "System" is selected.
    if (typeof systemThemeQuery.addEventListener === 'function') {
        systemThemeQuery.addEventListener('change', () => {
            if (getThemePreference() === THEME_SYSTEM) {
                injectOrClearCSS();
                refreshToggleUI();
            }
        });
    } else if (typeof systemThemeQuery.addListener === 'function') {
        // Older-browser fallback.
        systemThemeQuery.addListener(() => {
            if (getThemePreference() === THEME_SYSTEM) {
                injectOrClearCSS();
                refreshToggleUI();
            }
        });
    }

})();
