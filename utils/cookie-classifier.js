'use strict';

// Global namespace for MV3 compatibility (importScripts / <script src>)
const CookieClassifier = (() => {

  const CATEGORIES = {
    necessary: {
      id: 'necessary', label: 'Necessary', icon: '🔒',
      color: '#4A7C4E', bgColor: '#EBF5EC',
      description: 'Essential for basic website functionality.',
      detail: 'These cookies are required for page navigation, secure areas, and form submission. Without them the website cannot operate properly.',
      lookout: 'Generally safe — but ensure the site is legitimate before trusting any cookie.',
      isOptional: false, group: 'necessary',
    },
    session: {
      id: 'session', label: 'Session', icon: '⏱️',
      color: '#2E6B99', bgColor: '#EBF3FA',
      description: 'Temporary; deleted when you close your browser.',
      detail: 'Session cookies store temporary info like your shopping cart or form progress during a single visit. They vanish when you close the tab.',
      lookout: 'Session IDs can be stolen if the site doesn\'t use HTTPS — look for the padlock in your browser.',
      isOptional: false, group: 'necessary',
    },
    authentication: {
      id: 'authentication', label: 'Authentication', icon: '🔑',
      color: '#6B3FA0', bgColor: '#F3EEF8',
      description: 'Keep you logged in and verify your identity.',
      detail: 'Auth cookies remember that you\'ve signed in so you don\'t re-enter your password on every page.',
      lookout: 'If stolen ("session hijacking"), attackers can access your account. Always log out on shared devices.',
      isOptional: false, group: 'necessary',
    },
    tracking: {
      id: 'tracking', label: 'Tracking', icon: '👁️',
      color: '#C0392B', bgColor: '#FDECEA',
      description: 'Monitor your behavior to build advertising profiles.',
      detail: 'Tracking cookies record which sites you visit, what you click, and how long you browse. This data is often sold to advertisers.',
      lookout: 'In 2025, 93.7 billion stolen tracking cookies were found on the dark web. Blocking these significantly reduces exposure.',
      isOptional: true, group: 'optional',
    },
    advertising: {
      id: 'advertising', label: 'Advertising', icon: '📢',
      color: '#E74C3C', bgColor: '#FDECEA',
      description: 'Target you with ads and measure ad performance.',
      detail: 'These cookies help ad networks deliver personalized ads based on your browsing history and measure ad conversions.',
      lookout: 'Advertising cookies are often shared across hundreds of sites, creating a detailed portrait of your interests.',
      isOptional: true, group: 'optional',
    },
    analytics: {
      id: 'analytics', label: 'Analytics', icon: '📊',
      color: '#D35400', bgColor: '#FDF0E8',
      description: 'Measure how visitors use the website.',
      detail: 'Analytics cookies help site owners understand traffic — which pages are popular, where people drop off, and time spent.',
      lookout: 'Often considered harmless, but analytics data can be aggregated with other info to identify individuals.',
      isOptional: true, group: 'optional',
    },
    functional: {
      id: 'functional', label: 'Functional', icon: '⚙️',
      color: '#16A085', bgColor: '#E8F8F5',
      description: 'Remember preferences like language or theme.',
      detail: 'Functional cookies save your settings — preferred language, font size, dark mode — so you don\'t reset them every visit.',
      lookout: 'Generally low-risk, but they can persist for a long time acting as a fingerprint.',
      isOptional: true, group: 'optional',
    },
    'third-party': {
      id: 'third-party', label: 'Third-party', icon: '🔗',
      color: '#E67E22', bgColor: '#FEF5E7',
      description: 'Set by a domain different from the site you\'re on.',
      detail: 'Third-party cookies come from embedded services — social buttons, videos, ad networks. They track you across many sites.',
      lookout: 'Major browsers are phasing these out, but many sites still use them for cross-site tracking.',
      isOptional: true, group: 'optional',
    },
    unknown: {
      id: 'unknown', label: 'Unknown', icon: '❓',
      color: '#7F8C8D', bgColor: '#F2F3F4',
      description: 'Purpose could not be automatically determined.',
      detail: 'These cookies don\'t match any known pattern — could be custom app cookies, proprietary tracking, or site-specific functionality.',
      lookout: 'When in doubt, consider blocking unknown cookies from sites you don\'t fully trust.',
      isOptional: true, group: 'optional',
    },
  };

  const PATTERNS = {
    necessary: [
      /^CookieConsent$/i, /^cookie_?consent$/i, /^cookiefirst-/i,
      /^CONSENT$/, /^euconsent(-v2)?$/, /^cmapi_cookie_privacy/,
      /^__Secure-/, /^__Host-/,
      /^cf_clearance$/, /^__cfduid$/, /^cf_ob_info$/, /^__cf_bm$/, /^_cfuvid$/, /^__cfruid$/,
      /^AWSALB$/, /^AWSALBCORS$/, /^AWSELBCORS$/,
      /^incap_ses_/, /^nlbi_/, /^visid_incap_/,
      /^OptanonConsent$/, /^OptanonAlertBoxClosed$/,
      /^gdpr/i, /^usprivacy$/, /^cc_cookie$/,
    ],
    authentication: [
      /^(auth|access|id|refresh|api|bearer|jwt)[-_]?token$/i,
      /^JSESSIONID$/, /^PHPSESSID$/, /^ASPSESSIONID/,
      /^laravel_session$/, /^laravel_token$/, /^rails_session$/, /^flask_session$/,
      /^django[-_]session$/i,
      /^remember[-_]?(me|token)$/i,
      /^(user|uid|account)[-_]?id$/i,
      /^(login|logged[-_]?in|signed[-_]?in)$/i,
      /^(csrf|xsrf)[-_]?token$/i, /^XSRF-TOKEN$/, /^_csrf$/,
      /^__Secure-next-auth/i, /^next-auth/i,
      /^supabase[-_]auth[-_]token$/i, /^sb-.*-auth-token/,
      /^wordpress_logged_in/, /^wp[-_]settings/,
      /^ASP\.NET_SessionId$/, /^__RequestVerificationToken$/,
      /^_session(_id)?$/i, /^session$/i,
    ],
    advertising: [
      /^IDE$/, /^DSID$/, /^test_cookie$/, /^__gads$/, /^__gpi$/,
      /^_ttp$/, /^ttcsid$/, /^_rdt_uuid$/, /^_rdt_cid$/,
      /^_gcl_aw$/, /^_gcl_dc$/, /^_gcl_gb$/,
    ],
    tracking: [
      /^_ga($|_)/, /^_gid$/, /^_gat($|_)/, /^_gac_/, /^_gcl_/,
      /^_fbp$/, /^_fbc$/, /^fr$/, /^datr$/, /^sb$/, /^c_user$/, /^xs$/, /^wd$/,
      /^__utma$/, /^__utmb$/, /^__utmc$/, /^__utmz$/, /^__utmt$/,
      /^_hjid$/, /^_hjSession/, /^_hjIncluded/, /^_hjFirstSeen/, /^_hjAbsoluteSession/,
      /^_pin_unauth$/, /^_pinterest_sess$/,
      /^MUID$/, /^MUIDB$/, /^WT_FPC$/, /^MC1$/,
      /^_clck$/, /^_clsk$/,
      /^_tt_enable_cookie$/,
      /^ajs_/, /^mp_/, /^amplitude_id/,
      /^__qca$/, /^_dc_gtm_/,
      /^intercom[-_]/, /^_intercom/,
      /^_mkto_trk$/, /^hubspotutk$/, /^__hstc$/, /^__hssc$/, /^__hssrc$/,
      /^ki_[ru]$/,
      /^_uetsid$/, /^_uetvid$/, /^_uetmsclkid$/,
    ],
    analytics: [
      /^_ga($|_)/, /^_gid$/, /^_gat($|_)/, /^__utm/,
      /^_hjid$/, /^_hjSession/,
      /^amplitude_id/, /^mp_/,
      /^__qca$/, /^_dc_gtm_/,
    ],
    functional: [
      /^lang$/i, /^language$/i, /^locale$/i, /^i18n$/i,
      /^theme$/i, /^dark[-_]?mode$/i,
      /^currency$/i, /^timezone$/i,
      /^(user[-_])?preferences$/i,
      /^font[-_]size$/i,
    ],
  };

  function matchesAny(name, patterns) {
    return patterns.some(p => p.test(name));
  }

  function classifyCookie(cookie, currentDomain) {
    const name = cookie.name;
    const rawDomain = (cookie.domain || '').replace(/^\./, '');
    const normCurrent = currentDomain.toLowerCase().replace(/^www\./, '');
    const normCookie = rawDomain.toLowerCase().replace(/^www\./, '');

    const isThirdParty = normCookie !== '' &&
      normCurrent !== normCookie &&
      !normCurrent.endsWith('.' + normCookie) &&
      !normCookie.endsWith('.' + normCurrent);

    const isSession = !cookie.expirationDate;

    if (matchesAny(name, PATTERNS.necessary))     return { category: 'necessary',       isThirdParty, isSession };
    if (matchesAny(name, PATTERNS.authentication)) return { category: 'authentication',  isThirdParty, isSession };
    if (matchesAny(name, PATTERNS.advertising))    return { category: 'advertising',     isThirdParty, isSession };
    if (matchesAny(name, PATTERNS.tracking))       return { category: 'tracking',        isThirdParty, isSession };
    if (matchesAny(name, PATTERNS.analytics))      return { category: 'analytics',       isThirdParty, isSession };
    if (matchesAny(name, PATTERNS.functional))     return { category: 'functional',      isThirdParty, isSession };

    if (isThirdParty) return { category: 'third-party', isThirdParty, isSession };
    if (isSession)    return { category: 'session',     isThirdParty, isSession };

    if (cookie.expirationDate) {
      const daysLeft = (cookie.expirationDate - Date.now() / 1000) / 86400;
      if (daysLeft > 365) return { category: 'tracking', isThirdParty, isSession: false };
    }

    return { category: 'unknown', isThirdParty, isSession };
  }

  function groupByCategory(cookies) {
    return cookies.reduce((acc, c) => {
      const cat = c.classification.category;
      (acc[cat] = acc[cat] || []).push(c);
      return acc;
    }, {});
  }

  function isNecessaryCategory(category) {
    return ['necessary', 'session', 'authentication'].includes(category);
  }

  function countByGroup(cookies) {
    let necessary = 0, optional = 0;
    for (const c of cookies) {
      if (isNecessaryCategory(c.classification.category)) necessary++;
      else optional++;
    }
    return { necessary, optional, total: cookies.length };
  }

  return { CATEGORIES, classifyCookie, groupByCategory, isNecessaryCategory, countByGroup };
})();
