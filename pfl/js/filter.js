/**
 * Pay For Layers — search and tag filtering.
 *
 * Both are enhancements. With JavaScript off:
 *   - every tag is an ordinary link to a real page in /tags/, generated at
 *     build time, with its own title, description and canonical
 *   - the search field submits as a GET form and reloads the page, which the
 *     ?q= handling at the bottom then reflects
 * Nothing here is required for the page to work.
 */
(function () {
  'use strict';

  var grid = document.getElementById('grid');
  var input = document.getElementById('q');
  var form = document.querySelector('.search-form');
  var countEl = document.getElementById('count');
  var emptyEl = document.getElementById('empty');
  var clearEl = document.getElementById('clear');
  var note = document.getElementById('empty-note');
  var links = Array.prototype.slice.call(document.querySelectorAll('.tagnav a'));

  if (!grid) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
  var counter = grid.querySelector('.counter');

  // On a tag page the grid only holds that tag's cards, so tag switching in
  // place would have nothing to switch to — those links stay real navigations.
  // Search still works, narrowing whatever the page happens to hold.
  var isIndex = !/\/tags\//.test(location.pathname);

  var state = { tag: null, q: '' };

  function slugOf(link) {
    var m = link.getAttribute('href').match(/tags\/([^.]+)\.html/);
    return m ? m[1] : null;
  }

  function apply() {
    var q = state.q.trim().toLowerCase();
    var shown = 0;

    cards.forEach(function (card) {
      var okTag = !state.tag || card.dataset.tags.split(' ').indexOf(state.tag) !== -1;
      var okQ = !q || card.dataset.search.indexOf(q) !== -1;
      var show = okTag && okQ;
      card.hidden = !show;
      if (show) shown++;
    });

    // The counter states how much of the pack is not on the page. That is only
    // true of the unfiltered grid, so it goes away as soon as anything narrows.
    if (counter) counter.hidden = !!state.tag || !!q;
    if (emptyEl) emptyEl.hidden = shown !== 0;
    if (note) note.hidden = shown === 0;
    if (countEl) countEl.textContent = shown + ' drawing' + (shown === 1 ? '' : 's');

    links.forEach(function (link) {
      if (slugOf(link) === state.tag) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  /* ------------------------------------------------------------- search */

  if (input) {
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); });

    input.addEventListener('input', function () {
      state.q = input.value;
      apply();
    });

    // Escape clears the field rather than leaving a filtered grid behind.
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && input.value) {
        input.value = '';
        state.q = '';
        apply();
      }
    });
  }

  if (clearEl) {
    clearEl.addEventListener('click', function () {
      if (input) { input.value = ''; input.focus(); }
      state.q = '';
      apply();
    });
  }

  /* --------------------------------------------------------------- tags */

  if (isIndex) {
    links.forEach(function (link) {
      link.addEventListener('click', function (e) {
        // Modified clicks open the real page in a new tab, as they should.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        state.tag = slugOf(link);
        apply();
        history.pushState({ tag: state.tag }, '', link.getAttribute('href'));
      });
    });

    window.addEventListener('popstate', function (e) {
      state.tag = (e.state && e.state.tag) || null;
      apply();
    });
  }

  // Reflect ?q= on load, so a no-JS search submit lands somewhere sensible.
  var initial = new URLSearchParams(location.search).get('q');
  if (initial && input) {
    input.value = initial;
    state.q = initial;
    apply();
  }
})();
