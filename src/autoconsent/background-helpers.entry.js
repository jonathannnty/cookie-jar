// Bundled to an IIFE and importScripts-ed by the classic service worker.
// Exposes the two named exports background.js needs on the worker global.
import { evalSnippets, filterCompactRules } from '@duckduckgo/autoconsent';

self.autoconsentEvalSnippets = evalSnippets;
self.autoconsentFilterCompactRules = filterCompactRules;
