(() => {
  // node_modules/@duckduckgo/autoconsent/dist/autoconsent.esm.js
  var _Tools = class _Tools2 {
    static setBase(base) {
      _Tools2.base = base;
    }
    static findElement(options, parent = null, multiple = false) {
      let possibleTargets = null;
      if (parent != null) {
        possibleTargets = Array.from(parent.querySelectorAll(options.selector));
      } else {
        if (_Tools2.base != null) {
          possibleTargets = Array.from(
            _Tools2.base.querySelectorAll(options.selector)
          );
        } else {
          possibleTargets = Array.from(
            document.querySelectorAll(options.selector)
          );
        }
      }
      if (options.textFilter != null) {
        possibleTargets = possibleTargets.filter((possibleTarget) => {
          const textContent = possibleTarget.textContent.toLowerCase();
          if (Array.isArray(options.textFilter)) {
            let foundText = false;
            for (const text of options.textFilter) {
              if (textContent.indexOf(text.toLowerCase()) !== -1) {
                foundText = true;
                break;
              }
            }
            return foundText;
          } else if (options.textFilter != null) {
            return textContent.indexOf(options.textFilter.toLowerCase()) !== -1;
          }
          return false;
        });
      }
      if (options.styleFilters != null) {
        possibleTargets = possibleTargets.filter((possibleTarget) => {
          const styles = window.getComputedStyle(possibleTarget);
          let keep = true;
          for (const styleFilter of options.styleFilters) {
            const option = styles[styleFilter.option];
            if (styleFilter.negated) {
              keep = keep && option !== styleFilter.value;
            } else {
              keep = keep && option === styleFilter.value;
            }
          }
          return keep;
        });
      }
      if (options.displayFilter != null) {
        possibleTargets = possibleTargets.filter((possibleTarget) => {
          if (options.displayFilter) {
            return possibleTarget.offsetHeight !== 0;
          } else {
            return possibleTarget.offsetHeight === 0;
          }
        });
      }
      if (options.iframeFilter != null) {
        possibleTargets = possibleTargets.filter(() => {
          if (options.iframeFilter) {
            return window.location !== window.parent.location;
          } else {
            return window.location === window.parent.location;
          }
        });
      }
      if (options.childFilter != null) {
        possibleTargets = possibleTargets.filter((possibleTarget) => {
          const oldBase = _Tools2.base;
          _Tools2.setBase(possibleTarget);
          const childResults = _Tools2.find(options.childFilter);
          _Tools2.setBase(oldBase);
          return childResults.target != null;
        });
      }
      if (multiple) {
        return possibleTargets;
      } else {
        if (possibleTargets.length > 1) {
          console.warn(
            "Multiple possible targets: ",
            possibleTargets,
            options,
            parent
          );
        }
        return possibleTargets[0];
      }
    }
    static find(options, multiple = false) {
      const results = [];
      if (options.parent != null) {
        const parent = _Tools2.findElement(options.parent, null, multiple);
        if (parent != null) {
          if (parent instanceof Array) {
            parent.forEach((p) => {
              const targets = _Tools2.findElement(options.target, p, multiple);
              if (targets instanceof Array) {
                targets.forEach((target) => {
                  results.push({
                    parent: p,
                    target
                  });
                });
              } else {
                results.push({
                  parent: p,
                  target: targets
                });
              }
            });
            return results;
          } else {
            const targets = _Tools2.findElement(options.target, parent, multiple);
            if (targets instanceof Array) {
              targets.forEach((target) => {
                results.push({
                  parent,
                  target
                });
              });
            } else {
              results.push({
                parent,
                target: targets
              });
            }
          }
        }
      } else {
        const targets = _Tools2.findElement(options.target, null, multiple);
        if (targets instanceof Array) {
          targets.forEach((target) => {
            results.push({
              parent: null,
              target
            });
          });
        } else {
          results.push({
            parent: null,
            target: targets
          });
        }
      }
      if (results.length === 0) {
        results.push({
          parent: null,
          target: null
        });
      }
      if (multiple) {
        return results;
      } else {
        if (results.length !== 1) {
          console.warn(
            "Multiple results found, even though multiple false",
            results
          );
        }
        return results[0];
      }
    }
  };
  _Tools.base = null;
  var snippets = {
    // code-based rules
    EVAL_0: () => console.log(1),
    EVAL_DIDOMI_OPT_OUT: () => {
      if (window.Didomi) {
        window.Didomi.setUserDisagreeToAll();
        return true;
      }
      return false;
    },
    EVAL_DIDOMI_TEST: () => {
      const purposes = window.Didomi?.getCurrentUserStatus?.()?.purposes;
      if (purposes) {
        return Object.values(purposes).some((p) => !p.enabled);
      }
      const disabled = window.Didomi?.getUserConsentStatusForAll?.()?.purposes?.disabled;
      return Array.isArray(disabled) && disabled.length > 0;
    },
    EVAL_CONSENTMANAGER_1: () => window.__cmp && typeof __cmp("getCMPData") === "object",
    EVAL_CONSENTMANAGER_2: () => !__cmp("consentStatus").userChoiceExists,
    EVAL_CONSENTMANAGER_3: () => __cmp("setConsent", 0),
    EVAL_CONSENTMANAGER_4: () => __cmp("setConsent", 1),
    EVAL_CONSENTMANAGER_5: () => __cmp("consentStatus").userChoiceExists,
    EVAL_COOKIEBOT_1: () => !!window.Cookiebot,
    EVAL_COOKIEBOT_2: () => !window.Cookiebot.hasResponse && window.Cookiebot.dialog?.visible === true,
    EVAL_COOKIEBOT_3: () => window.Cookiebot.withdraw() || true,
    EVAL_COOKIEBOT_4: () => window.Cookiebot.hide() || true,
    EVAL_COOKIEBOT_5: () => window.Cookiebot.declined === true,
    EVAL_KLARO_1: () => {
      const config = globalThis.klaroConfig || globalThis.klaro?.getManager && globalThis.klaro.getManager().config;
      if (!config) {
        return true;
      }
      const optionalServices = (config.services || config.apps).filter((s) => !s.required).map((s) => s.name);
      if (klaro && klaro.getManager) {
        const manager = klaro.getManager();
        return optionalServices.every((name) => !manager.consents[name]);
      } else if (klaroConfig && klaroConfig.storageMethod === "cookie") {
        const cookieName = klaroConfig.cookieName || klaroConfig.storageName;
        const consents = JSON.parse(
          decodeURIComponent(
            document.cookie.split(";").find((c) => c.trim().startsWith(cookieName)).split("=")[1]
          )
        );
        return Object.keys(consents).filter((k) => optionalServices.includes(k)).every((k) => consents[k] === false);
      }
    },
    EVAL_KLARO_OPEN_POPUP: () => {
      klaro.show(void 0, true);
    },
    EVAL_KLARO_TRY_API_OPT_OUT: () => {
      if (window.klaro && typeof klaro.show === "function" && typeof klaro.getManager === "function") {
        try {
          klaro.getManager().changeAll(false);
          klaro.getManager().saveAndApplyConsents();
          return true;
        } catch (e) {
          console.warn(e);
          return false;
        }
      }
      return false;
    },
    EVAL_ONETRUST_1: () => window.OnetrustActiveGroups.split(",").filter((s) => s.length > 0).length <= 1,
    EVAL_TRUSTARC_TOP: () => window && window.truste && window.truste.eu.bindMap.prefCookie === "0",
    EVAL_TRUSTARC_FRAME_TEST: () => window && window.QueryString && window.QueryString.preferences === "0",
    EVAL_TRUSTARC_FRAME_GTM: () => window && window.QueryString && window.QueryString.gtm === "1",
    // declarative rules
    EVAL_ADOPT_TEST: () => !!localStorage.getItem("adoptConsentMode"),
    EVAL_ADULTFRIENDFINDER_TEST: () => !!localStorage.getItem("cookieConsent"),
    EVAL_BAHN_TEST: () => utag.gdpr.getSelectedCategories().length === 1,
    EVAL_BIGCOMMERCE_CONSENT_MANAGER_DETECT: () => !!(window.consentManager && window.consentManager.version),
    EVAL_BORLABS_0: () => !JSON.parse(
      decodeURIComponent(
        document.cookie.split(";").find((c) => c.indexOf("borlabs-cookie") !== -1).split("=", 2)[1]
      )
    ).consents.statistics,
    EVAL_CC_BANNER2_0: () => !!document.cookie.match(/sncc=[^;]+D%3Dtrue/),
    EVAL_COINBASE_0: () => JSON.parse(decodeURIComponent(document.cookie.match(/cm_(eu|default)_preferences=([0-9a-zA-Z\\{\\}\\[\\]%:]*);?/)[2])).consent.length <= 1,
    EVAL_COOKIE_LAW_INFO_0: () => {
      if (CLI.disableAllCookies) CLI.disableAllCookies();
      if (CLI.reject_close) CLI.reject_close();
      document.body.classList.remove("cli-barmodal-open");
      return true;
    },
    EVAL_COOKIE_LAW_INFO_DETECT: () => !!window.CLI,
    EVAL_COOKIE_MANAGER_POPUP_0: () => JSON.parse(
      document.cookie.split(";").find((c) => c.trim().startsWith("CookieLevel")).split("=")[1]
    ).social === false,
    EVAL_COOKIEALERT_0: () => document.querySelector("body").removeAttribute("style") || true,
    EVAL_COOKIEALERT_1: () => document.querySelector("body").removeAttribute("style") || true,
    EVAL_COOKIEALERT_2: () => window.CookieConsent.declined === true,
    EVAL_COOKIEFIRST_0: () => ((o) => o.performance === false && o.functional === false && o.advertising === false)(
      JSON.parse(
        decodeURIComponent(
          document.cookie.split(";").find((c) => c.indexOf("cookiefirst") !== -1).trim()
        ).split("=")[1]
      )
    ),
    EVAL_COOKIEFIRST_1: () => document.querySelectorAll("button[data-cookiefirst-accent-color=true][role=checkbox]:not([disabled])").forEach((i) => i.getAttribute("aria-checked") === "true" && i.click()) || true,
    EVAL_COOKIEINFORMATION_0: () => CookieInformation.declineAllCategories() || true,
    EVAL_COOKIEINFORMATION_1: () => CookieInformation.submitAllCategories() || true,
    EVAL_ETSY_0: () => document.querySelectorAll(".gdpr-overlay-body input").forEach((toggle) => {
      toggle.checked = false;
    }) || true,
    EVAL_ETSY_1: () => document.querySelector(".gdpr-overlay-view button[data-wt-overlay-close]").click() || true,
    EVAL_EZOIC_0: () => ezCMP.handleAcceptAllClick(),
    EVAL_FIDES_DETECT_POPUP: () => window.Fides?.initialized,
    EVAL_GDPR_LEGAL_COOKIE_DETECT_CMP: () => !!window.GDPR_LC,
    EVAL_GDPR_LEGAL_COOKIE_TEST: () => !!window.GDPR_LC?.userConsentSetting,
    EVAL_IUBENDA_0: () => document.querySelectorAll(".purposes-item input[type=checkbox]:not([disabled])").forEach((x) => {
      if (x.checked) x.click();
    }) || true,
    EVAL_IUBENDA_1: () => !!document.cookie.match(/_iub_cs-\d+=/),
    EVAL_MICROSOFT_0: () => Array.from(document.querySelectorAll("div > button")).filter((el) => el.innerText.match("Reject|Ablehnen"))[0].click() || true,
    EVAL_MICROSOFT_1: () => Array.from(document.querySelectorAll("div > button")).filter((el) => el.innerText.match("Accept|Annehmen"))[0].click() || true,
    EVAL_MICROSOFT_2: () => !!document.cookie.match("MSCC|GHCC"),
    EVAL_MOOVE_0: () => document.querySelectorAll("#moove_gdpr_cookie_modal input").forEach((i) => {
      if (!i.disabled) i.checked = i.name === "moove_gdpr_strict_cookies" || i.id === "moove_gdpr_strict_cookies";
    }) || true,
    EVAL_NHNIEUWS_TEST: () => !!localStorage.getItem("psh:cookies-seen"),
    EVAL_OSANO_DETECT: () => !!window.Osano?.cm?.dialogOpen,
    EVAL_PANDECTES_TEST: () => document.cookie.includes("_pandectes_gdpr=") && JSON.parse(
      atob(
        document.cookie.split(";").find((s) => s.trim().startsWith("_pandectes_gdpr")).split("=")[1]
      )
    ).status === "deny",
    EVAL_POVR_GOBACK: () => window.history.back() || true,
    EVAL_PUBTECH_0: () => document.cookie.includes("euconsent-v2") && (document.cookie.match(/.YAAAAAAAAAAA/) || document.cookie.match(/.aAAAAAAAAAAA/) || document.cookie.match(/.YAAACFgAAAAA/)),
    EVAL_SHOPIFY_TEST: () => document.cookie.includes("gdpr_cookie_consent=0") || document.cookie.includes("_tracking_consent=") && JSON.parse(
      decodeURIComponent(
        document.cookie.split(";").find((s) => s.trim().startsWith("_tracking_consent")).split("=")[1]
      )
    ).purposes.a === false,
    EVAL_SKYSCANNER_TEST: () => document.cookie.match(/gdpr=[^;]*adverts:::false/) && !document.cookie.match(/gdpr=[^;]*init:::true/),
    EVAL_SIRDATA_UNBLOCK_SCROLL: () => {
      document.documentElement.classList.forEach((cls) => {
        if (cls.startsWith("sd-cmp-")) document.documentElement.classList.remove(cls);
      });
      return true;
    },
    EVAL_STEAMPOWERED_0: () => JSON.parse(
      decodeURIComponent(
        document.cookie.split(";").find((s) => s.trim().startsWith("cookieSettings")).split("=")[1]
      )
    ).preference_state === 2,
    EVAL_TAKEALOT_0: () => document.body.classList.remove("freeze") || (document.body.style = "") || true,
    EVAL_TARTEAUCITRON_0: () => tarteaucitron.userInterface.respondAll(false) || true,
    EVAL_TARTEAUCITRON_1: () => tarteaucitron.userInterface.respondAll(true) || true,
    EVAL_TARTEAUCITRON_2: () => document.cookie.match(/tarteaucitron=[^;]*/)?.[0].includes("false"),
    EVAL_TEALIUM_0: () => typeof window.utag !== "undefined" && typeof utag.gdpr === "object",
    EVAL_TEALIUM_1: () => utag.gdpr.setConsentValue(false) || true,
    EVAL_TEALIUM_DONOTSELL: () => utag.gdpr.dns?.setDnsState(false) || true,
    EVAL_TEALIUM_2: () => utag.gdpr.setConsentValue(true) || true,
    EVAL_TEALIUM_3: () => utag.gdpr.getConsentState() !== 1,
    EVAL_TEALIUM_DONOTSELL_CHECK: () => utag.gdpr.dns?.getDnsState() !== 1,
    EVAL_TESTCMP_STEP: () => !!document.querySelector("#reject-all"),
    EVAL_TESTCMP_0: () => window.results.results[0] === "button_clicked",
    EVAL_TESTCMP_COSMETIC_0: () => window.results.results[0] === "banner_hidden",
    EVAL_THEFREEDICTIONARY_0: () => cmpUi.showPurposes() || cmpUi.rejectAll() || true,
    EVAL_THEFREEDICTIONARY_1: () => cmpUi.allowAll() || true,
    EVAL_USERCENTRICS_API_0: () => typeof UC_UI === "object",
    EVAL_USERCENTRICS_API_1: () => !!UC_UI.closeCMP(),
    EVAL_USERCENTRICS_API_2: () => !!UC_UI.denyAllConsents(),
    EVAL_USERCENTRICS_API_3: () => !!UC_UI.acceptAllConsents(),
    EVAL_USERCENTRICS_API_4: () => !!UC_UI.closeCMP(),
    EVAL_USERCENTRICS_API_5: () => UC_UI.areAllConsentsAccepted() === true,
    EVAL_USERCENTRICS_API_6: () => UC_UI.areAllConsentsAccepted() === false,
    EVAL_USERCENTRICS_BUTTON_0: () => JSON.parse(localStorage.getItem("usercentrics")).consents.every((c) => c.isEssential || !c.consentStatus),
    EVAL_WAITROSE_0: () => Array.from(document.querySelectorAll("label[id$=cookies-deny-label]")).forEach((e) => e.click()) || true
  };
  var REJECT_PATTERNS_ENGLISH = [
    // e.g. "i reject cookies", "reject all", "reject all cookies", "reject cookies", "deny all", "deny all cookies", "refuse", "refuse all", "refuse cookies", "refuse all cookies", "deny", "reject all and close", "deny all and close", "reject non-essential cookies", "reject all non-essential cookies and continue", "reject optional cookies", "reject additional cookies", "reject targeting cookies", "reject marketing cookies", "reject analytics cookies", "reject tracking cookies", "reject advertising cookies", "reject all and close", "deny all and close", "i reject all (except strictly necessary)"
    // note that "reject and subscribe" and "reject and pay" are excluded
    /^\s*(i)?\s*(reject|deny|refuse|decline|disable)\s*(all)?\s*(non-essential|optional|additional|targeting|analytics|marketing|unrequired|non-necessary|extra|tracking|advertising)?\s*(cookies)?\s*(\(?\s*except\s+(strictly\s+)?(necessary|essential)\s*\)?)?\s*$/is,
    // e.g. "i do not accept", "i do not accept cookies", "do not accept", "do not accept cookies"
    /^\s*(i)?\s*do\s+not\s+accept\s*(cookies)?\s*$/is,
    // e.g. "continue without accepting", "continue without agreeing", "continue without agreeing →"
    /^\s*(continue|proceed|continue\s+browsing)\s+without\s+(accepting|agreeing|consent|cookies|tracking)(\s*→)?\s*$/is,
    // e.g. "strictly necessary cookies only", "essential cookies only", "required only", "use necessary cookies only", "essentials only"
    // note that "only" is required
    /^\s*(use|accept|allow|continue\s+with)?\s*(strictly)?\s*(necessary|essentials?|required)?\s*(cookies)?\s*only\s*$/is,
    // e.g. "allow essential cookies", "allow necessary", "allow essentials", "allow essentials only"
    // note that "essential" is required
    /^\s*(use|accept|allow|continue\s+with)?\s*(strictly)?\s*(necessary|essentials?|required)\s*(cookies)?\s*$/is,
    // e.g. "accept only essential cookies", "use only necessary cookies", "allow only essential", "only essentials", "continue with only essential cookies"
    // note that "only" is required
    /^\s*(use|accept|allow|continue\s+with)?\s*only\s*(strictly)?\s*(necessary|essentials?|required)?\s*(cookies)?\s*$/is,
    // e.g. "do not sell or share my personal information", "do not sell my personal information"
    // often used in CCPA
    /^\s*do\s+not\s+sell(\s+or\s+share)?\s*my\s*personal\s*information\s*$/is,
    "allow selection",
    "disagree and close"
    // These are impactful, but look error-prone
    // // e.g. "i do not agree"
    // /^\s*(i\s+)?do\s+not\s+agree\s*$/i,
  ];
  var REJECT_PATTERNS_DUTCH = [
    "weigeren",
    "alles afwijzen",
    "alleen noodzakelijke cookies",
    "afwijzen",
    "alles weigeren",
    "cookies weigeren",
    "alleen noodzakelijk",
    "weiger",
    "weiger cookies",
    "selectie toestaan",
    "doorgaan zonder te accepteren",
    "alleen functionele cookies",
    "alleen functioneel",
    "alleen noodzakelijke",
    "alleen essenti\xEBle cookies",
    "functioneel",
    "alle cookies verwerpen",
    "doorgaan zonder akkoord te gaan",
    "weiger alles",
    "nee, bedankt",
    "alle cookies weigeren",
    "weiger alle cookies",
    "alleen noodzakelijke cookies accepteren",
    "alleen strikt noodzakelijk",
    "ik weiger",
    "optionele cookies weigeren",
    "alle weigeren",
    "accepteer alleen noodzakelijke cookies",
    "alleen functionele cookies accepteren",
    "enkel noodzakelijke cookies",
    "niet accepteren",
    "weiger niet-essenti\xEBle cookies",
    "weiger niet-noodzakelijke cookies",
    "wijs alles af",
    "alle cookies afwijzen",
    "alleen vereiste cookies",
    "cookies afwijzen",
    "doorgaan zonder accepteren",
    "hier weigeren",
    "weiger alle",
    "aanvaard enkel essenti\xEBle cookies",
    "aanvullende cookies weigeren",
    "accepteren weigeren",
    "alle afwijzen",
    "alle niet functionele afwijzen",
    "alle optionele weigeren",
    "alleen noodzakelijke accepteren",
    "alleen strikt noodzakelijke cookies",
    "allen afwijzen",
    "clear weigeren",
    "enkel functioneel",
    "enkel noodzakelijke cookies aanvaarden",
    "functioneel altijd actief",
    "nee, accepteer alleen de noodzakelijke",
    "nee, geen cookies a.u.b.",
    "nee, weiger cookies",
    "nee, weigeren",
    "niet-noodzakelijke cookies weigeren",
    "optioneel afwijzen",
    "tracking cookies weigeren",
    "weigeren cookies",
    "weigeren?",
    "weigeren.",
    "strikt noodzakelijk",
    "weiger optionele cookies",
    "noodzakelijke cookies",
    "essenti\xEBle cookies",
    "ga verder zonder aanvaarden",
    "doorgaan zonder cookies",
    "accepteer noodzakelijke cookies",
    "noodzakelijke",
    "indien je enkel technisch noodzakelijke cookies wenst te accepteren, klik dan hier",
    "weiger",
    "alleen de noodzakelijke cookies",
    "alleen noodzakelijk",
    "alleen verplichte cookies",
    "ik wil alleen minimale cookies",
    "doorgaan zonder te accepteren",
    "geen cookies toestaan",
    "liever geen cookies",
    "nee, geen persoonlijke cookies",
    "nee, liever geen cookies",
    "ga door zonder te accepteren",
    "verder zonder accepteren",
    "essenti\xEBle accepteren",
    "functionele cookies",
    "strikt noodzakelijke cookies",
    "alleen basic cookies",
    "alleen basiscookies",
    "alleen standaard cookies",
    "alle cookies verwerpen",
    "noodzakelijk",
    "noodzakelijk cookies accepteren",
    "noodzakelijke cookies accepteren",
    "accepteer alleen noodzakelijk",
    "enkel noodzakelijke toestaan",
    "enkel strikt noodzakelijke cookies",
    "ik wijs ze liever af",
    "ik weiger cookies",
    "ik weiger optionele cookies",
    "weiger alle cookies",
    "weiger alle niet-noodzakelijke cookies",
    "weiger alle onnodige cookies",
    "weiger alle optionele",
    "weiger alles",
    "weiger targeting en third party cookies."
  ];
  var REJECT_PATTERNS_FRENCH = [
    "continuer sans accepter",
    "tout refuser",
    "refuser",
    "refuser tous les cookies",
    "non merci",
    "interdire tous les cookies",
    "je refuse",
    "refuser tout",
    "tout rejeter",
    "refuser et continuer",
    "rejeter",
    "refuser les cookies",
    "cookies n\xE9cessaires uniquement",
    "seulement n\xE9cessaires",
    "rejeter tout",
    "refuser les cookies optionnels",
    "je d\xE9sactive les finalit\xE9s non essentielles",
    "refuser les cookies non n\xE9cessaires",
    "rejeter tous les cookies",
    "cookies essentiels uniquement",
    "n\xE9cessaires uniquement",
    "refuser les cookies non essentiels",
    "tout refuser et fermer",
    "tout refuser sauf les cookies techniques",
    "continuer sans accepter x",
    "je refuse lutilisation de cookies",
    "non merci, seulement des cookies techniques",
    "non, tout refuser",
    "refuser tous les cookies non n\xE9cessaires",
    "rejeter les cookies",
    "uniquement les essentiels",
    "refuser tous",
    "accepter uniquement les n\xE9cessaires",
    "allow anonymous analytics",
    "autoriser les cookies essentiels uniquement",
    "autoriser uniquement les n\xE9cessaires",
    "cookies essentiels seulement",
    "cookies n\xE9cessaires seulement",
    "cookies techniques uniquement",
    "je pr\xE9f\xE8re les rejeter",
    "je refuse :(",
    "je refuse les cookies",
    "je refuse tous les cookies",
    "je refuse tout",
    "ne pas accepter",
    "non, accepter les n\xE9cessaires uniquement",
    "refuser (sauf cookies n\xE9cessaires)",
    "refuser ce cookie",
    "refuser les coockies",
    "refuser les cookies facultatifs",
    "refuser tout, sauf les cookies techniques",
    "refuser toutes",
    "refuser toutes les options",
    "rejeter la banni\xE8re",
    "rejeter les cookies non essentiels",
    "rejeter les cookies optionnels",
    "rejeter tous les non fonctionnels",
    "rejeter tout optionnel",
    "tout refuser, sauf les cookies techniques",
    "uniquement n\xE9cessaires",
    "x continuer sans accepter",
    "strictement n\xE9cessaires",
    "utiliser uniquement les cookies n\xE9cessaires",
    "cookies n\xE9cessaires",
    "accepter uniquement les cookies essentiels",
    "accepter les cookies n\xE9cessaires",
    "uniquement les cookies n\xE9cessaires",
    "autoriser uniquement les cookies essentiels",
    "autoriser uniquement les cookies n\xE9cessaires",
    "si vous ne souhaitez pas accepter les cookies \xE0 lexception des cookies techniquement n\xE9cessaires, veuillez cliquer ici",
    "cookies strictement n\xE9cessaires",
    "accepter les cookies strictement n\xE9cessaires",
    "autoriser les cookies essentiels",
    "non, merci, uniquement les cookies n\xE9cessaires",
    "indispensable uniquement",
    "uniquement autoriser les cookies essentiels",
    "utiliser que les cookies n\xE9cessaires",
    "uniquement les sdk n\xE9cessaires",
    "uniquement n\xE9cessaire",
    "utiliser uniquement les cookies fonctionnels",
    "refus",
    "refusez",
    "naccepter que les cookies indispensables",
    "naccepter que les cookies n\xE9cessaires",
    "naccepter que les cookies techniques",
    "n\xE9cessaires seulement"
  ];
  var REJECT_PATTERNS_GERMAN = [
    "ablehnen",
    "alle ablehnen",
    "nur notwendige cookies",
    "nur essenzielle cookies akzeptieren",
    "nur notwendige cookies verwenden",
    "nur technisch notwendige",
    "nur essentielle cookies akzeptieren",
    "alles ablehnen",
    "nur notwendige",
    "alle cookies ablehnen",
    "weiter ohne einwilligung",
    "mit diesem button wird der dialog geschlossen. seine funktionalit\xE4t ist identisch mit der des buttons nur essenzielle cookies akzeptieren.",
    "cookies ablehnen",
    "optionale cookies ablehnen",
    "nur erforderliche cookies",
    "einwilligung ablehnen",
    "nur erforderliche",
    "nur notwendige cookies zulassen",
    "nur funktionale cookies akzeptieren",
    "nur notwendige cookies akzeptieren",
    "nur notwendige technologien",
    "verweigern",
    "webanalyse ablehnen",
    "weiter ohne zustimmung",
    "optionale ablehnen",
    "nur notwendige akzeptieren",
    "nur funktionale cookies",
    "mit diesem button wird der dialog geschlossen. seine funktionalit\xE4t ist identisch mit der des buttons ablehnen.",
    "nur notwendige cookies erlauben",
    "zustimmung verweigern",
    "nein, danke",
    "nur erforderliche cookies akzeptieren",
    "zus\xE4tzliche cookies ablehnen",
    "ablehnen und nur essenzielle cookies akzeptieren",
    "nicht erforderliche ablehnen",
    "nicht essenzielle cookies daten ablehnen",
    "nur technisch notwendige cookies",
    "nur technisch notwendige cookies akzeptieren",
    "ablehnen speichern",
    "alle funktionen ablehnen",
    "alle optionalen cookies ablehnen",
    "alles verweigern",
    "mit erforderlichen einstellungen fortfahren",
    "nicht notwendige ablehnen",
    "notwendige cookies akzeptieren",
    "nur erforderliche technologien",
    "nur essenzielle cookies",
    "nur essenzielle cookies erlauben",
    "technisch nicht notwendige cookies ablehnen",
    "tippen sie zum ablehnen bitte hier",
    "ablehnen deny",
    "fortfahren ohne zu akzeptieren",
    "nur erforderliche akzeptieren",
    "nur notwendige erlauben",
    "ablehnen ...nur technisch notwendige cookies verwendet werden",
    "ablehnen (au\xDFer notwendige cookies)",
    "ablehnen und fortfahren",
    "ablehnen und schlie\xDFen",
    "ablehnen: nur grundfunktionen",
    "akzeptieren nur notwendige cookies",
    "alle ablehnen (au\xDFer notwendige cookies)",
    "alle nicht essenziellen cookies ablehnen",
    "alle nicht notwendigen cookies ablehnen",
    "alle optionale ablehnen",
    "alle optionalen ablehnen",
    "alle verweigern",
    "analyse cookies ablehnen",
    "cookie einstellungenablehnen",
    "erforderliche cookies akzeptieren",
    "erforderliche cookies zulassen",
    "externe inhalte ablehnen",
    "mit diesem button wird der dialog geschlossen. seine funktionalit\xE4t ist identisch mit der des buttons ablehnen und nur essenzielle cookies akzeptieren.",
    "mit diesem button wird der dialog geschlossen. seine funktionalit\xE4t ist identisch mit der des buttons nicht-essenzielle cookies verweigern.",
    "mit diesem button wird der dialog geschlossen. seine funktionalit\xE4t ist identisch mit der des buttons nur essenzielle akzeptieren.",
    "mit erforderlichen cookies fortfahren",
    "mit notwendigen fortfahren",
    "nein, bitte nicht",
    "nein, ich stimme nicht zu",
    "nicht funktionale cookies ablehnen",
    "nicht notwendige cookies ablehnen",
    "nicht-essenzielle cookies ablehnen",
    "nicht-essenzielle cookies verweigern",
    "notwendige cookies zulassen",
    "nur erforderliche cookies erlauben",
    "nur erforderliche cookies setzen",
    "nur erforderliche cookies verwenden",
    "nur essenzielle akzeptieren",
    "nur notwendige cookies annehmen",
    "nur notwendige cookies speichern",
    "nur notwendige cookies verwenden.",
    "nur notwendige funktionscookies akzeptieren",
    "nur notwendigen cookies zustimmen",
    "nur notwendiges akzeptieren",
    "nur wesentliche cookies annehmen",
    "opt. cookies ablehnen",
    "optionale dienste ablehnen",
    "optionale tools ablehnen",
    "sie alle cookies ablehnen",
    "technisch notwendige annehmen",
    "nur essentielle cookies",
    "nur essentielle",
    "nur funktionale akzeptieren",
    "nur technisch notwendige akzeptieren",
    "nur technisch notwendige daten und cookies ...",
    "nur technisch notwendige zulassen",
    "nur wesentliche",
    "ohne einverst\xE4ndnis fortfahren",
    "ohne einwilligung",
    "ohne zustimmung fortfahren",
    "ohne zustimmung weiter",
    "weiter mit essentiellen cookies",
    "weiter ohne annahme",
    "weiter ohne statistische analyse-cookies",
    "weiter ohne statistische cookies",
    "wesentliche cookies",
    "fortfahren ohne zustimmung"
  ];
  var REJECT_PATTERNS_ITALIAN = [
    "rifiuta",
    "rifiuta cookies",
    "rifiuta i cookie",
    "rifiuta i cookies",
    "rifiuta tutti i cookie",
    "rifiuta tutti i cookies",
    "rifiuta cookie non necessari",
    "rifiuta i cookie non tecnici",
    "rifiuta non necessari",
    "rifiuta tutto",
    "rifiuta tutti",
    "rifiuta e chiudi",
    "chiudi rifiuta tutti i cookie",
    "chiudi e rifiuta tutti i cookie",
    "chiudi e rifiuta tutto",
    "nega",
    "nega tutti",
    "negare",
    "non accetto",
    "accetta solo i necessari",
    "usa solo i cookie necessari",
    "accetta solo necessari",
    "solo necessari",
    "continua senza accettare x",
    "continua senza accettare",
    "rifiutare",
    "rifiutare i cookie",
    "rifiutare tutti i cookie",
    "rifiutare tutti",
    "rifiutare e continuare",
    "installa solo i cookie strettamente necessari",
    "solo cookies tecnici",
    "accetta necessari",
    "solo cookie tecnici",
    "solo cookie necessari",
    "strettamente necessari",
    "tecnici",
    "accetta solo cookie di navigazione",
    "chiudi e prosegui solo con i cookies tecnici necessari",
    "consenti solo i cookie tecnici",
    "solo cookie essenziali",
    "blocca i cookie non essenziali",
    "accetta i cookie necessari",
    "accetta solo cookie tecnici",
    "accetta solo i cookie essenziali",
    "accetta solo i cookie necessari",
    "accetta solo i necessary",
    "accetta i cookie essenziali",
    "accetta cookie tecnici",
    "necessari",
    "usa solo i cookie tecnici",
    "usa solo i necessari",
    "rifiuto",
    "essenziali",
    "accetta cookie essenziali",
    "accetta cookie necessari",
    "accetta solo cookie essenziali",
    "accetta solo cookie necessari",
    "rifiuta cookie non necessari",
    "rifiuta cookie non essenziali",
    "rifiuta i cookie non necessari",
    "rifiuta i cookie non essenziali",
    "rifiuta tutti i cookie e chiudi",
    "rifiuta tutto e chiudi",
    "rifiuta tutti i cookie chiudi",
    "continuare senza accettare",
    "rifiutare cookies",
    "rifiutare i cookies",
    "rifiutare non necessari",
    "rifiutare tutto",
    "rifiutare e chiudere",
    "solo essenziali",
    "solo tecnici",
    "negare tutti"
  ];
  var REJECT_PATTERNS_BRAZILIAN_PORTUGUESE = [
    // (deny)
    /^\s*(rejeitar|recusar|desativar|bloquear|negar|não\s*aceito|não \s*aceitar)\s*$/is,
    // (proceed) (without accepting)
    /^\s*(continuar|prosseguir|seguir)\s*(sem\s*aceitar)\s*$/is,
    // (deny) (everything) (optional)
    /^\s*(rejeitar|recusar|desativar|bloquear|negar|não\s*aceito|não \s*aceitar)\s*(tudo|o)?\s*(opcional|(não[-\s](essencial|funcional|obrigatório|necessário)))?\s*$/is,
    // (deny) (all) (the) (optional) (cookies)
    /^\s*(rejeitar|recusar|desativar|bloquear|negar|não\s*aceito|não \s*aceitar)\s*(todos)?\s*(os)?\s*(cookies)?\s*(opcionais|(não[-\s](essenciais|funcionais|obrigatórios|necessários)))?\s*$/is,
    // (accept) (only) (the) (essential)
    /^\s*(aceitar|utilizar)?\s*(apenas|somente|só)?\s*(o)?\s*(essencial|funcional|obrigatório|necessário)\s*$/is,
    // (accept) (only) (the) (essential) (cookies)
    /^\s*(aceitar|utilizar)?\s*(apenas|somente|só)?\s*(os)?\s*(cookies)?\s*(essenciais|funcionais|obrigatórios|necessários)\s*$/is
  ];
  var REJECT_PATTERNS_SPANISH = [
    "rechazar",
    "rechazar todo",
    "rechazar todas",
    "denegar",
    "rechazar cookies",
    "rechazarlas todas",
    "no acepto",
    "rechazar todas las cookies",
    "rechazar y cerrar",
    "denegar todas",
    "solo necesarias",
    "rechazar cookies opcionales",
    "rechazar opcionales",
    "cookies estrictamente necesarias",
    "aceptar s\xF3lo necesarias",
    "continuar sin aceptar",
    "denegar todo",
    "clear rechazar cookies",
    "configurar rechazar cookies",
    "denegar cookies",
    "rechazar y continuar",
    "rechazar las cookies",
    "clear rechazar",
    "denegar todas las cookies",
    "rechazar cookies no esenciales",
    "rechazarlas",
    "no, no acepto",
    "permitir s\xF3lo necesarias",
    "rechazar cookies adicionales",
    "rechazar cookies anal\xEDticas",
    "rechazar no necesarias",
    "rechazar opcional",
    "rechazar todo lo opcional",
    "solo cookies estrictamente necesarias",
    "solo esenciales",
    "x rechazar todas las cookies",
    "solo usar cookies necesarias",
    "solo cookies necesarias",
    "declinar",
    "aceptar solo las cookies esenciales",
    "necesarias",
    "aceptar cookies opcionales",
    "aceptar solo lo necesario",
    "solo funcionales",
    "declinar y cerrar",
    "d\xE9clin",
    "declina",
    "declinar consentimiento",
    "declinar todas",
    "solo las cookies necesarias",
    "nom\xE9s sutilitzen cookies quan \xE9s necessari",
    "no, s\xF3lo las estrictamente necesarias",
    "solo las necesarias",
    "acceptar nom\xE9s les necess\xE0ries",
    "acepta solo las necesarias",
    "aceptar solo lo esencial",
    "aceptar las obligatorias",
    "permitir solo cookies t\xE9cnicas",
    "cookies t\xE9cnicas",
    "permitir solo cookies t\xE9cnicas",
    "usar solo cookies t\xE9cnicas",
    "aceptar solo las esenciales"
  ];
  var REJECT_PATTERNS_SWEDISH = [
    "avvisa",
    "endast n\xF6dv\xE4ndiga",
    "avvisa alla",
    "endast n\xF6dv\xE4ndiga cookies",
    "neka",
    "neka alla",
    "avvisa allt",
    "avvisa alla cookies",
    "till\xE5t bara n\xF6dv\xE4ndiga cookies",
    "bara n\xF6dv\xE4ndiga",
    "bara n\xF6dv\xE4ndiga cookies",
    "till\xE5t bara n\xF6dv\xE4ndiga kakor",
    "endast n\xF6dv\xE4ndiga kakor",
    "till\xE5t endast n\xF6dv\xE4ndiga",
    "forts\xE4tt utan att acceptera",
    "godk\xE4nn endast n\xF6dv\xE4ndiga",
    "acceptera endast n\xF6dv\xE4ndiga",
    "avvisa cookies",
    "till\xE5t endast n\xF6dv\xE4ndiga kakor",
    "acceptera endast n\xF6dv\xE4ndiga cookies",
    "neka kakor",
    "bara n\xF6dv\xE4ndiga kakor",
    "neka alla cookies",
    "anv\xE4nd endast n\xF6dv\xE4ndiga",
    "avvisa alla utom n\xF6dv\xE4ndiga",
    "hantera eller avvisa",
    "neka alla utom n\xF6dv\xE4ndiga kakor",
    "neka och st\xE4ng",
    "till\xE5t bara n\xF6dv\xE4ndiga tj\xE4nster",
    "avvisa alla utom n\xF6dv\xE4ndiga kakor",
    "avvisa alla valfria",
    "godk\xE4nn bara n\xF6dv\xE4ndiga cookies",
    "acceptera endast n\xF6dv\xE4ndiga kakor",
    "anv\xE4nd endast n\xF6dv\xE4ndiga cookies",
    "avvisa alla kakor",
    "avvisa alla valm\xF6jligheter",
    "avvisa ej n\xF6dv\xE4ndiga",
    "avvisa icke-n\xF6dv\xE4ndiga",
    "f\xF6rneka",
    "godk\xE4nn bara n\xF6dv\xE4ndiga",
    "godk\xE4nn bara n\xF6dv\xE4ndiga kakor",
    "godk\xE4nn endast n\xF6dv\xE4ndiga cookies",
    "godk\xE4nn endast n\xF6dv\xE4ndiga kakor",
    "godta endast n\xF6dv\xE4ndiga",
    "jag godk\xE4nner bara n\xF6dv\xE4ndiga kakor",
    "nej, avvisa alla",
    "nej, bara n\xF6dv\xE4ndiga",
    "nej, bara n\xF6dv\xE4ndiga cookies",
    "neka alla utom n\xF6dv\xE4ndiga",
    "neka alla.",
    "neka cookies",
    "neka samtliga",
    "ok, endast n\xF6dv\xE4ndiga",
    "spara endast n\xF6dv\xE4ndiga",
    "st\xE4ng och avvisa",
    "till\xE5t bara n\xF6dv\xE4ndiga",
    "godk\xE4nn n\xF6dv\xE4ndiga kakor",
    "godk\xE4nn n\xF6dv\xE4ndiga",
    "acceptera n\xF6dv\xE4ndiga",
    "strikt n\xF6dv\xE4ndigt",
    "till\xE5t n\xF6dv\xE4ndiga",
    "n\xF6dv\xE4ndiga",
    "enbart n\xF6dv\xE4ndiga",
    "jag godk\xE4nner n\xF6dv\xE4ndiga kakor",
    "acceptera n\xF6dv\xE4ndiga kakor",
    "godk\xE4nn enbart n\xF6dv\xE4ndiga kakor",
    "godk\xE4nn n\xF6dv\xE4ndiga cookies",
    "om du inte vill acceptera andra cookies \xE4n de som \xE4r tekniskt n\xF6dv\xE4ndiga klickar du h\xE4r",
    "acceptera enbart n\xF6dv\xE4ndiga",
    "n\xF6dv\xE4ndiga cookies",
    "jag godk\xE4nner enbart att ni anv\xE4nder n\xF6dv\xE4ndiga cookies",
    "+ strikt n\xF6dv\xE4ndiga cookies",
    "anv\xE4nd enbart n\xF6dv\xE4ndiga cookies",
    "enbart n\xF6dv\xE4ndiga cookies",
    "godk\xE4nn n\xF6dv\xE4ndiga kakor st\xE4ng",
    "ok till n\xF6dv\xE4ndiga",
    "strikt n\xF6dv\xE4ndiga",
    "forts\xE4tt utan att godk\xE4nna",
    "avb\xF6j alla cookies",
    "jag accepterar endast grundl\xE4ggande kakor",
    "nej, jag avb\xF6jer",
    "till\xE5t inte cookies"
  ];
  var REJECT_PATTERNS = [
    ...REJECT_PATTERNS_ENGLISH,
    ...REJECT_PATTERNS_DUTCH,
    ...REJECT_PATTERNS_FRENCH,
    ...REJECT_PATTERNS_GERMAN,
    ...REJECT_PATTERNS_ITALIAN,
    ...REJECT_PATTERNS_BRAZILIAN_PORTUGUESE,
    ...REJECT_PATTERNS_SPANISH,
    ...REJECT_PATTERNS_SWEDISH
  ];
  var compactedRuleSteps = [
    ["exists", "e"],
    ["visible", "v"],
    ["waitForThenClick", "c"],
    ["click", "k"],
    ["waitFor", "w"],
    ["waitForVisible", "wv"],
    ["hide", "h"],
    ["cookieContains", "cc"]
  ];
  function clearUnusedStrings(ruleset, ignoreBeforeIndex = 0) {
    const { v, s, r } = ruleset;
    const usedStringIds = /* @__PURE__ */ new Set();
    function addStringIdsFromRuleSteps(steps) {
      steps.forEach((step) => {
        for (const [, shortKey] of compactedRuleSteps) {
          if (step[shortKey] !== void 0) {
            usedStringIds.add(step[shortKey]);
          }
        }
        if (step.if) {
          addStringIdsFromRuleSteps([step.if]);
        }
        if (step.then) {
          addStringIdsFromRuleSteps(step.then);
        }
        if (step.else) {
          addStringIdsFromRuleSteps(step.else);
        }
        if (step.any) {
          addStringIdsFromRuleSteps(step.any);
        }
      });
    }
    ruleset.r.forEach((rule) => {
      addStringIdsFromRuleSteps(rule[6]);
      addStringIdsFromRuleSteps(rule[7]);
      addStringIdsFromRuleSteps(rule[8]);
      addStringIdsFromRuleSteps(rule[9]);
      rule[5].forEach((id) => usedStringIds.add(id));
    });
    return {
      v,
      r,
      s: s.slice(0, Math.max(...usedStringIds) + 1).map((str, idx) => {
        if (idx < ignoreBeforeIndex || usedStringIds.has(idx)) {
          return str;
        }
        return "";
      })
    };
  }
  function shouldRunRuleInContext(rule, mainFrame, url) {
    const runContext = rule[4];
    if (mainFrame && runContext === 1) {
      return false;
    }
    if (!mainFrame && [20, 22, 10, 12].includes(runContext)) {
      return false;
    }
    const urlPattern = rule[3];
    if (urlPattern && urlPattern !== "" && url.match(urlPattern) === null) {
      return false;
    }
    return true;
  }
  function filterCompactRules(rules, context) {
    const { v, s, r, index } = rules;
    const { url, mainFrame } = context;
    const shouldRunInContext = (rule) => shouldRunRuleInContext(rule, mainFrame, url);
    if (!mainFrame) {
      const ruleset = {
        v,
        s: s.slice(0, index.frameStringEnd),
        r: r.slice(index.frameRuleRange[0], index.frameRuleRange[1]).filter(shouldRunInContext)
      };
      return clearUnusedStrings(ruleset);
    }
    const genericRules = r.slice(index.genericRuleRange[0], index.genericRuleRange[1]);
    const specificRules = r.slice(index.specificRuleRange[0], index.specificRuleRange[1]).filter(shouldRunInContext);
    if (specificRules.length > 0) {
      const ruleset = {
        v,
        s,
        r: [...genericRules, ...specificRules]
      };
      return clearUnusedStrings(ruleset);
    }
    return {
      v,
      s: s.slice(0, index.genericStringEnd),
      r: genericRules
    };
  }
  var _config;
  _config = /* @__PURE__ */ new WeakMap();

  // src/autoconsent/background-helpers.entry.js
  self.autoconsentEvalSnippets = snippets;
  self.autoconsentFilterCompactRules = filterCompactRules;
})();
