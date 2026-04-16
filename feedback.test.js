/**
 * Feedback Module Tests
 * Uses jsdom to simulate the browser DOM
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// ── Load the HTML ──────────────────────────────────────────────
const html = fs.readFileSync(
  path.join('/mnt/user-data/outputs/landing-page.html'), 'utf8'
);

// ── Test harness ───────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    results.push({ name, ok: true });
    passed++;
  } catch (e) {
    console.log(`  ✗  ${name}`);
    console.log(`       → ${e.message}`);
    results.push({ name, ok: false, error: e.message });
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ── Build a fresh DOM for each group ──────────────────────────
function makeDom() {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost',
    pretendToBeVisual: true,
  });
  // jsdom doesn't fire DOMContentLoaded for inline scripts, but
  // scripts run synchronously with runScripts:'dangerously'
  return dom;
}

// ─────────────────────────────────────────────────────────────
// SUITE 1 — DOM structure
// ─────────────────────────────────────────────────────────────
console.log('\n📋  Suite 1: DOM Structure\n');
{
  const { window } = makeDom();
  const { document } = window;

  test('Feedback FAB button exists', () => {
    const btn = document.getElementById('feedbackBtn');
    assert(btn !== null, '#feedbackBtn not found');
  });

  test('FAB button has accessible label', () => {
    const btn = document.getElementById('feedbackBtn');
    const label = btn.getAttribute('aria-label');
    assert(label && label.length > 0, 'aria-label missing on FAB');
  });

  test('Modal backdrop exists', () => {
    const backdrop = document.getElementById('feedbackBackdrop');
    assert(backdrop !== null, '#feedbackBackdrop not found');
  });

  test('Modal has role="dialog" and aria-modal="true"', () => {
    const backdrop = document.getElementById('feedbackBackdrop');
    assertEqual(backdrop.getAttribute('role'), 'dialog', 'role should be dialog');
    assertEqual(backdrop.getAttribute('aria-modal'), 'true', 'aria-modal should be true');
  });

  test('5 star buttons rendered', () => {
    const stars = document.querySelectorAll('.star-btn');
    assertEqual(stars.length, 5, `Expected 5 stars, got ${stars.length}`);
  });

  test('4 category chips rendered', () => {
    const chips = document.querySelectorAll('.chip');
    assertEqual(chips.length, 4, `Expected 4 chips, got ${chips.length}`);
  });

  test('Textarea exists', () => {
    const ta = document.getElementById('feedbackMessage');
    assert(ta !== null, '#feedbackMessage not found');
    assertEqual(ta.tagName.toLowerCase(), 'textarea', 'Should be a textarea');
  });

  test('Submit button exists', () => {
    const btn = document.getElementById('modalSubmit');
    assert(btn !== null, '#modalSubmit not found');
  });

  test('Close button exists', () => {
    const btn = document.getElementById('modalClose');
    assert(btn !== null, '#modalClose not found');
  });

  test('Success state hidden by default', () => {
    const success = document.getElementById('modalSuccess');
    assert(!success.classList.contains('visible'), 'Success pane should be hidden initially');
  });
}

// ─────────────────────────────────────────────────────────────
// SUITE 2 — Modal open / close behaviour
// ─────────────────────────────────────────────────────────────
console.log('\n📋  Suite 2: Modal Open / Close\n');
{
  const { window } = makeDom();
  const { document } = window;
  const FM = window.FeedbackModule;

  test('Modal is closed on load', () => {
    const backdrop = document.getElementById('feedbackBackdrop');
    assert(!backdrop.classList.contains('open'), 'Modal should start closed');
  });

  test('openModal() adds "open" class to backdrop', () => {
    FM.openModal();
    const backdrop = document.getElementById('feedbackBackdrop');
    assert(backdrop.classList.contains('open'), 'Modal should be open after openModal()');
  });

  test('closeModal() removes "open" class from backdrop', () => {
    FM.openModal();
    FM.closeModal();
    const backdrop = document.getElementById('feedbackBackdrop');
    assert(!backdrop.classList.contains('open'), 'Modal should be closed after closeModal()');
  });

  test('Clicking FAB opens modal', () => {
    const btn = document.getElementById('feedbackBtn');
    btn.click();
    const backdrop = document.getElementById('feedbackBackdrop');
    assert(backdrop.classList.contains('open'), 'Modal should open on FAB click');
    FM.closeModal();
  });

  test('Clicking close button closes modal', () => {
    FM.openModal();
    document.getElementById('modalClose').click();
    const backdrop = document.getElementById('feedbackBackdrop');
    assert(!backdrop.classList.contains('open'), 'Modal should close on close-btn click');
  });

  test('Pressing Escape closes modal', () => {
    FM.openModal();
    const event = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(event);
    const backdrop = document.getElementById('feedbackBackdrop');
    assert(!backdrop.classList.contains('open'), 'Modal should close on Escape key');
  });

  test('Clicking backdrop overlay closes modal', () => {
    FM.openModal();
    const backdrop = document.getElementById('feedbackBackdrop');
    // Simulate click directly on backdrop (not modal inner)
    const evt = new window.MouseEvent('click', { bubbles: true });
    Object.defineProperty(evt, 'target', { value: backdrop });
    backdrop.dispatchEvent(evt);
    assert(!backdrop.classList.contains('open'), 'Modal should close on backdrop click');
  });
}

// ─────────────────────────────────────────────────────────────
// SUITE 3 — Star rating
// ─────────────────────────────────────────────────────────────
console.log('\n📋  Suite 3: Star Rating\n');
{
  const { window } = makeDom();
  const FM = window.FeedbackModule;
  const { document } = window;

  test('Initial selectedRating is 0', () => {
    assertEqual(FM.getState().selectedRating, 0, 'Rating should start at 0');
  });

  test('setRating(3) updates state to 3', () => {
    FM.setRating(3);
    assertEqual(FM.getState().selectedRating, 3, 'Rating should be 3');
  });

  test('setRating(3) marks stars 1–3 active', () => {
    FM.setRating(3);
    const stars = document.querySelectorAll('.star-btn');
    const activeCount = [...stars].filter(s => s.classList.contains('active')).length;
    assertEqual(activeCount, 3, 'Exactly 3 stars should be active');
  });

  test('setRating(3) leaves stars 4–5 inactive', () => {
    FM.setRating(3);
    const stars = document.querySelectorAll('.star-btn');
    assert(!stars[3].classList.contains('active'), 'Star 4 should not be active');
    assert(!stars[4].classList.contains('active'), 'Star 5 should not be active');
  });

  test('setRating(5) marks all stars active', () => {
    FM.setRating(5);
    const stars = document.querySelectorAll('.star-btn');
    const allActive = [...stars].every(s => s.classList.contains('active'));
    assert(allActive, 'All 5 stars should be active');
  });

  test('setRating clears rating error', () => {
    const err = document.getElementById('ratingError');
    err.classList.add('visible');
    FM.setRating(1);
    assert(!err.classList.contains('visible'), 'Rating error should be cleared');
  });

  test('Clicking star button sets rating', () => {
    const stars = document.querySelectorAll('.star-btn');
    stars[4].click(); // 5th star → rating 5
    assertEqual(FM.getState().selectedRating, 5, 'Clicking 5th star should set rating to 5');
  });
}

// ─────────────────────────────────────────────────────────────
// SUITE 4 — Category chips
// ─────────────────────────────────────────────────────────────
console.log('\n📋  Suite 4: Category Chips\n');
{
  const { window } = makeDom();
  const FM = window.FeedbackModule;
  const { document } = window;

  test('Initial selectedCategory is null', () => {
    assertEqual(FM.getState().selectedCategory, null);
  });

  test('Clicking a chip selects it', () => {
    const chip = document.querySelector('.chip[data-cat="design"]');
    FM.toggleChip(chip);
    assertEqual(FM.getState().selectedCategory, 'design');
  });

  test('Only one chip can be selected at a time', () => {
    const d = document.querySelector('.chip[data-cat="design"]');
    const c = document.querySelector('.chip[data-cat="content"]');
    FM.toggleChip(d);
    FM.toggleChip(c);
    assertEqual(FM.getState().selectedCategory, 'content');
    assert(!d.classList.contains('selected'), 'First chip should be deselected');
    assert(c.classList.contains('selected'), 'Second chip should be selected');
  });

  test('Clicking selected chip deselects it', () => {
    const chip = document.querySelector('.chip[data-cat="performance"]');
    FM.toggleChip(chip);
    FM.toggleChip(chip);
    assertEqual(FM.getState().selectedCategory, null, 'Category should be null after re-click');
  });
}

// ─────────────────────────────────────────────────────────────
// SUITE 5 — Validation
// ─────────────────────────────────────────────────────────────
console.log('\n📋  Suite 5: Form Validation\n');
{
  const { window } = makeDom();
  const FM = window.FeedbackModule;
  const { document } = window;

  test('validate() fails with no rating and no message', () => {
    const result = FM.validate();
    assert(!result, 'validate() should return false when empty');
  });

  test('validate() shows rating error when rating is 0', () => {
    FM.validate();
    const err = document.getElementById('ratingError');
    assert(err.classList.contains('visible'), 'Rating error should be shown');
  });

  test('validate() shows message error when message is empty', () => {
    FM.validate();
    const err = document.getElementById('messageError');
    assert(err.classList.contains('visible'), 'Message error should be shown');
  });

  test('validate() fails with rating but short message (<10 chars)', () => {
    FM.setRating(4);
    document.getElementById('feedbackMessage').value = 'Short';
    const result = FM.validate();
    assert(!result, 'validate() should fail with short message');
  });

  test('validate() passes with rating and valid message', () => {
    FM.setRating(5);
    document.getElementById('feedbackMessage').value = 'This is a proper feedback message.';
    const result = FM.validate();
    assert(result, 'validate() should pass with rating + valid message');
  });

  test('validate() hides errors on success', () => {
    FM.setRating(5);
    document.getElementById('feedbackMessage').value = 'Great experience here.';
    FM.validate();
    assert(!document.getElementById('ratingError').classList.contains('visible'));
    assert(!document.getElementById('messageError').classList.contains('visible'));
  });

  test('validate() fails with message exactly 9 chars (boundary)', () => {
    FM.setRating(3);
    document.getElementById('feedbackMessage').value = '123456789'; // 9 chars
    const result = FM.validate();
    assert(!result, 'Exactly 9 chars should fail validation');
  });

  test('validate() passes with message exactly 10 chars (boundary)', () => {
    FM.setRating(3);
    document.getElementById('feedbackMessage').value = '1234567890'; // 10 chars
    const result = FM.validate();
    assert(result, 'Exactly 10 chars should pass validation');
  });
}

// ─────────────────────────────────────────────────────────────
// SUITE 6 — Submit flow
// ─────────────────────────────────────────────────────────────
console.log('\n📋  Suite 6: Submit Flow\n');
{
  const { window } = makeDom();
  const FM = window.FeedbackModule;
  const { document } = window;

  test('submit() does not show success when invalid', () => {
    FM.submit();
    const success = document.getElementById('modalSuccess');
    assert(!success.classList.contains('visible'), 'Success should not show on invalid submit');
  });

  test('submit() shows success pane on valid data', () => {
    FM.setRating(4);
    document.getElementById('feedbackMessage').value = 'Amazing design studio!';
    FM.submit();
    const success = document.getElementById('modalSuccess');
    assert(success.classList.contains('visible'), 'Success pane should be visible after valid submit');
  });

  test('submit() hides form on valid submission', () => {
    const dom2 = makeDom();
    const FM2 = dom2.window.FeedbackModule;
    const doc2 = dom2.window.document;
    FM2.setRating(5);
    doc2.getElementById('feedbackMessage').value = 'Wonderful experience overall.';
    FM2.submit();
    const form = doc2.getElementById('modalForm');
    assert(form.classList.contains('hidden'), 'Form should be hidden after submit');
  });
}

// ─────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  console.log('  Failed tests:');
  results.filter(r => !r.ok).forEach(r => console.log(`    ✗ ${r.name}`));
  console.log('');
  process.exit(1);
} else {
  console.log('  All tests passed! ✓\n');
}
