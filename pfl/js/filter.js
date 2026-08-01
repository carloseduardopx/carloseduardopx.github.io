/**
 * Pay For Layers — tag filtering.
 *
 * This is an enhancement and nothing more. With JavaScript off every tag is an
 * ordinary link to a real page in /tags/, generated at build time, with its own
 * title, description and canonical. All this does is skip the navigation when
 * the whole library is already in the document.
 */
(function () {
  'use strict';

  var grid = document.getElementById('grid');
  var countEl = document.getElementById('count');
  var links = Array.prototype.slice.call(document.querySelectorAll('.tagnav a'));

  if (!grid || !links.length) return;

  // On a tag page the grid only holds that tag's cards, so filtering in place
  // would have nothing to filter. Only the index carries every drawing.
  if (/\/tags\//.test(location.pathname)) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
  var counter = grid.querySelector('.counter');

  function slugOf(link) {
    var m = link.getAttribute('href').match(/tags\/([^.]+)\.html/);
    return m ? m[1] : null;
  }

  function apply(tag) {
    var shown = 0;
    cards.forEach(function (card) {
      var show = !tag || card.dataset.tags.split(' ').indexOf(tag) !== -1;
      card.hidden = !show;
      if (show) shown++;
    });

    // The counter states how much of the pack is not on the page. That is only
    // true of the unfiltered grid, so it goes away with any tag applied.
    if (counter) counter.hidden = !!tag;
    if (countEl) countEl.textContent = shown + ' drawing' + (shown === 1 ? '' : 's');

    links.forEach(function (link) {
      if (slugOf(link) === tag) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  links.forEach(function (link) {
    link.addEventListener('click', function (e) {
      // Modified clicks open the real page in a new tab, as they should.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      var tag = slugOf(link);
      apply(tag);
      history.pushState({ tag: tag }, '', link.getAttribute('href'));
    });
  });

  window.addEventListener('popstate', function (e) {
    apply((e.state && e.state.tag) || null);
  });
})();
