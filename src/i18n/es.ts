/**
 * ES — Spanish (scaffold, NOT yet translated).
 *
 * Aliases the English resource so `es` is a first-class, selectable locale today
 * and the key STRUCTURE can never drift (the parity test enforces it). Selecting
 * "Español" shows English placeholder copy — never an empty string or raw key.
 *
 * To translate: replace this with a hand-authored `export const es = {…}` literal
 * copied from en.ts, then translate each leaf. The parity test flags any drift.
 */

import { en } from './en';

export const es = en;
