/**
 * LIFF HTML Generator - Modular Architecture
 * Assembles all module sections into the complete LIFF HTML page
 */
import { getInitCode } from './init.js';
import { getCalendarViewCode } from './calendar-view.js';
import { getTaskViewCode } from './task-view.js';
import { getMemoViewCode } from './memo-view.js';
import { getSharedViewCode } from './shared-view.js';
import { getModalsCode } from './modals.js';
import { getApiCallsCode } from './api-calls.js';
import { getAuthComponentsCode } from './auth-components.js';
import { getCommonCode } from './common.js';
import { getSettingsCode } from './settings.js';

export { generateLiffHtml } from '../liff.js';

// Note: The actual generateLiffHtml function remains in ../liff.js
// This modular split is for code organization and maintainability.
// Each module file contains the JS code for its respective section,
// making it easier to find and edit specific functionality.
//
// Module map:
//   init.js           - LIFF SDK init, data loading, auth check
//   calendar-view.js  - Month/week/day calendar rendering
//   task-view.js      - Task list rendering
//   memo-view.js      - Memo list/grid/compact rendering
//   shared-view.js    - Shared calendar UI
//   modals.js         - All modal dialogs
//   api-calls.js      - Event/task/memo API submission
//   auth-components.js - Google auth status
//   common.js         - Toast, escape, utilities
//   settings.js       - Event listeners, settings, init call
