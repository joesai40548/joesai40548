import { test } from 'node:test';
import assert from 'node:assert';
import { escapeHtml } from './utils.js';

test('escapeHtml escapes HTML special characters', (t) => {
  assert.strictEqual(
    escapeHtml('<script>alert("x")</script>'),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
  );
});

test('escapeHtml handles single quotes and ampersands', (t) => {
  assert.strictEqual(
    escapeHtml("it's a & 'thing'"),
    'it&#039;s a &amp; &#039;thing&#039;'
  );
});

test('escapeHtml returns empty string for null/undefined', (t) => {
  assert.strictEqual(escapeHtml(null), '');
  assert.strictEqual(escapeHtml(undefined), '');
});

test('escapeHtml leaves safe text unchanged', (t) => {
  assert.strictEqual(escapeHtml('safe text'), 'safe text');
});

test('escapeHtml escapes URLs in link attributes', (t) => {
  assert.strictEqual(
    escapeHtml('https://example.com?q=1&x=2'),
    'https://example.com?q=1&amp;x=2'
  );
});
