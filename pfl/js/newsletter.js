/**
 * Pay For Layers — newsletter states.
 *
 * With JavaScript off the form posts to Mailchimp in a new tab exactly as it
 * has always done, and the subscription still works. With JavaScript on it goes
 * through Mailchimp's JSONP endpoint instead, so the outcome — subscribed,
 * already on the list, bad address — is reported inline on this page and the
 * reader is never sent somewhere else.
 */
(function () {
  'use strict';

  var form = document.getElementById('signup');
  var msg = document.getElementById('signup-msg');
  if (!form || !msg) return;

  var email = form.querySelector('input[type="email"]');
  var button = form.querySelector('button[type="submit"]');

  function say(text, ok) {
    msg.textContent = text;
    msg.className = 'signup__msg ' + (ok ? 'signup__msg--ok' : 'signup__msg--err');
    msg.hidden = false;
  }

  // Mailchimp returns messages containing markup ("you're already subscribed"
  // arrives with a link in it). Setting textContent keeps it as text; there is
  // no path from their response into this page's HTML.
  function plain(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }

  form.addEventListener('submit', function (e) {
    var value = email.value.trim();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      e.preventDefault();
      say('That address does not look right. Check it and try again.', false);
      email.focus();
      return;
    }

    e.preventDefault();
    button.disabled = true;
    say('Sending…', true);

    // JSONP: the classic endpoint refuses a cross-origin POST, but post-json
    // answers a GET wrapped in a callback of our choosing.
    var cb = 'pflmc' + Date.now();
    var url = form.action.replace('/post?', '/post-json?')
      + '&EMAIL=' + encodeURIComponent(value)
      + '&c=' + cb;

    var script = document.createElement('script');
    var done = false;

    function finish() {
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[cb];
      button.disabled = false;
    }

    window[cb] = function (data) {
      done = true;
      if (data && data.result === 'success') {
        say('Done — you are on the list. A few times a year, nothing else.', true);
        form.reset();
      } else {
        say(plain((data && data.msg) || 'That did not go through. Try again in a moment.'), false);
      }
      finish();
    };

    script.onerror = function () {
      if (done) return;
      say('Could not reach Mailchimp. Try again, or email carlos@carlospx.com.', false);
      finish();
    };

    script.src = url;
    document.head.appendChild(script);
  });

  email.addEventListener('input', function () {
    if (msg.classList.contains('signup__msg--err')) msg.hidden = true;
  });
})();
