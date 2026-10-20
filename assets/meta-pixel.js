/* Meta Pixel: public landing and successful contact registration only.
 * No assessment answers, contact fields, account data or automatic matching.
 * The SDK is downloaded only after a separate advertising-consent choice.
 */
(function () {
  'use strict';
  if (window.BaseMetaPixel) return;

  const PIXEL_ID = '1669204944775144';
  const STORAGE_KEY = 'bc_marketing_consent_v1';
  const CONSENT_MAX_AGE = 180 * 24 * 60 * 60 * 1000;
  const QUERY_ALLOWLIST = /^(utm_(source|medium|campaign|term|content|id)|fbclid)$/;
  let screen = null;
  let initialized = false;
  let pageViewSent = false;
  let leadSent = false;
  let preferencesOpen = false;
  let sdkGranted = false;

  function readConsent() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && ['granted', 'denied'].includes(saved.choice)
          && Number.isFinite(saved.at) && Date.now() >= saved.at
          && Date.now() - saved.at < CONSENT_MAX_AGE) return saved.choice;
    } catch (_) { /* Storage unavailable: keep tracking off by default. */ }
    return null;
  }
  let consent = readConsent();

  function publicLocation() {
    if (!['basedocorre.com.br', 'www.basedocorre.com.br'].includes(location.hostname)) return false;
    if (!['/', '/index.html'].includes(location.pathname) || location.hash) return false;
    // Recovery links, payment redirects and arbitrary user-data parameters
    // must never be passed to Meta as the current page URL.
    return Array.from(new URLSearchParams(location.search).keys()).every(key => QUERY_ALLOWLIST.test(key));
  }

  function canTrack() {
    const gate = document.getElementById('gate-overlay');
    return consent === 'granted' && screen === 'lead' && publicLocation()
      && navigator.globalPrivacyControl !== true
      && (!gate || gate.style.display === 'none');
  }

  function pause() {
    if (!initialized || !sdkGranted) return;
    // If the SDK is still downloading, discard pending marketing events
    // before it can execute in an assessment or account screen.
    if (!window.fbq.callMethod && window.fbq.queue) {
      window.fbq.queue = window.fbq.queue.filter(args => args[0] !== 'trackSingle');
    }
    window.fbq('consent', 'revoke');
    sdkGranted = false;
  }

  function start() {
    if (!canTrack()) { pause(); return; }
    if (!initialized) {
      // Meta's standard loader, deferred until advertising consent.
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window,document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq.disablePushState = true;
      window.fbq('set', 'autoConfig', false, PIXEL_ID);
      window.fbq('consent', 'grant');
      window.fbq('init', PIXEL_ID);
      initialized = true;
      sdkGranted = true;
    } else if (!sdkGranted) {
      window.fbq('consent', 'grant');
      sdkGranted = true;
    }
    if (!pageViewSent) {
      window.fbq('trackSingle', PIXEL_ID, 'PageView');
      pageViewSent = true;
    }
  }

  function renderPreferences() {
    const notice = document.getElementById('marketing-consent');
    if (notice) notice.hidden = !(preferencesOpen || (!consent && screen === 'lead' && publicLocation()));
  }

  function clearMarketingCookies() {
    ['_fbp', '_fbc'].forEach(name => {
      document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax';
      document.cookie = name + '=; Max-Age=0; path=/; domain=.basedocorre.com.br; SameSite=Lax';
    });
  }

  function choose(choice) {
    consent = choice;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, at: Date.now() })); } catch (_) {}
    preferencesOpen = false;
    if (choice === 'denied') { pause(); clearMarketingCookies(); }
    else start();
    renderPreferences();
  }

  window.BaseMetaPixel = Object.freeze({
    setScreen: function (name) {
      screen = name;
      preferencesOpen = false;
      if (canTrack()) start(); else pause();
      renderPreferences();
    },
    trackLead: function () {
      if (!canTrack() || leadSent) return;
      start();
      window.fbq('trackSingle', PIXEL_ID, 'Lead');
      leadSent = true;
    },
    openPreferences: function () {
      preferencesOpen = true;
      renderPreferences();
      document.getElementById('marketing-reject')?.focus();
    }
  });

  function ready() {
    document.getElementById('marketing-accept')?.addEventListener('click', function () { choose('granted'); });
    document.getElementById('marketing-reject')?.addEventListener('click', function () { choose('denied'); });
    document.getElementById('marketing-preferences')?.addEventListener('click', window.BaseMetaPixel.openPreferences);
    const gate = document.getElementById('gate-overlay');
    const active = document.querySelector('.screen.active');
    window.BaseMetaPixel.setScreen(gate && gate.style.display !== 'none' ? null : active?.id.replace('screen-', ''));
  }
  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    consent = readConsent();
    if (canTrack()) start(); else pause();
    renderPreferences();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
}());
