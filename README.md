# Colorful-Managebac

A set of Tampermonkey userscripts that customize the ManageBac experience.

## Included scripts

### 1) `managebac-dark-mode.user.js`
Adds a theme layer for ManageBac with:
- **System / Light / Dark** theme modes
- A floating theme toggle button + menu
- Coverage across common pages (Home, Timetables, Calendar, Tasks, Task details, Class pages)
- Automatic re-apply on dynamic page/navigation updates

Matches:
- `https://*.managebac.cn/*`
- `https://managebac.cn/*`
- `https://*.managebac.com/*`
- `https://managebac.com/*`

---

### 2) `managebac-gradebars.user.js`
Themes assignment grade bars (1–50) with:
- Built-in palettes (rainbow, monochrome, pastel, neon, earth, plum, forest, ocean, sunset)
- Import custom palette JSON
- Import/export full settings JSON
- Global + class-scoped color state
- Clear-all settings option

Matches:
- `https://*.managebac.cn/*`
- `https://managebac.cn/*`

> If you use `.com`, update the script `@match` lines to `.com` before installing.

## Installation

1. Install **Tampermonkey** in your browser.
2. Open each `.user.js` file from this repo.
3. Create/install each script in Tampermonkey.
4. Reload ManageBac tabs after installation.

## Usage

- **Dark mode script:** click the floating button near the bottom-right to switch System/Light/Dark.
- **Grade bar script:** click the 🎨 button, choose or import a palette, then apply.
- If anything looks off after page transitions, refresh the page once.

## Notes

- Script settings are saved locally via Tampermonkey storage.
- This project is unofficial and not affiliated with ManageBac.
