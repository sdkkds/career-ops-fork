import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl } from '../lib/url-identity.mjs';

test('strips tracking params, hash, trailing slash, www', () => {
  assert.equal(
    normalizeUrl('https://www.job-boards.greenhouse.io/acme/jobs/12345/?utm_source=li&utm_campaign=x#apply'),
    'https://job-boards.greenhouse.io/acme/jobs/12345');
});

test('keeps gh_jid when the path has no job id', () => {
  assert.equal(
    normalizeUrl('https://boards.greenhouse.io/acme?gh_jid=4002508008&gh_src=abc'),
    'https://boards.greenhouse.io/acme?gh_jid=4002508008');
});

test('drops gh_jid when the path already carries the job id', () => {
  assert.equal(
    normalizeUrl('https://job-boards.greenhouse.io/acme/jobs/12345?gh_jid=12345'),
    'https://job-boards.greenhouse.io/acme/jobs/12345');
});

test('upgrades scheme, lowercases host, preserves path case', () => {
  assert.equal(normalizeUrl('http://Jobs.Lever.co/Acme/AB-12'), 'https://jobs.lever.co/Acme/AB-12');
});

test('param order does not create a second identity', () => {
  assert.equal(normalizeUrl('https://x.test/j?b=2&a=1'), normalizeUrl('https://x.test/j?a=1&b=2'));
});

test('junk returns null rather than throwing or inventing a key', () => {
  for (const bad of ['', '   ', 'not a url', null, undefined, 'ftp://x.test/j']) {
    assert.equal(normalizeUrl(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});
