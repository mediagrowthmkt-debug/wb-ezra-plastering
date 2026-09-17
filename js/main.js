/* Ezra Plastering - front behavior (v3)
   navbar · mobile accordion menu · reveal · multi-step lead form
   · contact popup + call popup (phone-only, dials owner) -> GHL via https://mediagrowth.com.br/ezra-lead-api/api.php (token server-side)
*/
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initMobileMenu();
  initScrollReveal();
  initLeadForms();
  initPopups();
});

function initNavbar() {
  const header = document.getElementById('header');
  if (!header) return;
  const transparent = !header.classList.contains('header--solid');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  if (transparent) { onScroll(); window.addEventListener('scroll', onScroll, { passive: true }); }
}

/* ---- Mobile menu: full-screen navy drawer, accordion dropdowns, body lock ---- */
function initMobileMenu() {
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('navMenu');
  if (!toggle || !menu) return;
  let scrollY = 0;

  const lock = () => {
    scrollY = window.scrollY;
    document.body.style.cssText = `position:fixed;top:-${scrollY}px;left:0;right:0;width:100%;overflow:hidden;`;
    document.body.classList.add('menu-open');
  };
  const unlock = () => {
    document.body.style.cssText = '';
    document.body.classList.remove('menu-open');
    window.scrollTo(0, scrollY);
  };
  const open = () => { menu.classList.add('open'); toggle.classList.add('active'); lock(); };
  const close = () => {
    menu.classList.remove('open'); toggle.classList.remove('active'); unlock();
    menu.querySelectorAll('.nav__item--drop.is-open').forEach(d => d.classList.remove('is-open'));
  };

  toggle.addEventListener('click', () => { menu.classList.contains('open') ? close() : open(); });

  // close button injected inside the drawer head
  const closeBtn = document.getElementById('mobileMenuClose');
  if (closeBtn) closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('open')) close(); });

  const isMobile = () => window.matchMedia('(max-width: 992px)').matches;

  // Dropdown parents become accordions on mobile
  menu.querySelectorAll('.nav__link--drop').forEach(link => {
    link.addEventListener('click', (e) => {
      if (!isMobile()) return;            // desktop: let it navigate
      e.preventDefault();
      link.closest('.nav__item--drop').classList.toggle('is-open');
    });
  });

  // Real navigation links close the menu
  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      if (link.classList.contains('nav__link--drop') && isMobile()) return;
      if (menu.classList.contains('open')) close();
    });
  });
}

function initScrollReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  items.forEach(el => observer.observe(el));
}

/* ---------------------------------------------------------------
   Shared helpers: phone mask + page-context capture
--------------------------------------------------------------- */
function maskUSPhone(v) {
  const d = (v || '').replace(/\D/g, '').slice(0, 10);
  if (d.length === 0) return '';
  if (d.length < 4) return '(' + d;
  if (d.length < 7) return '(' + d.slice(0, 3) + ') ' + d.slice(3);
  return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
}
function attachPhoneMask(input) {
  if (!input) return;
  input.addEventListener('input', () => { input.value = maskUSPhone(input.value); });
}
function pageContext() {
  const body = document.body || {};
  return {
    pageUrl: window.location.href,
    pageTitle: document.title || '',
    pageService: body.dataset ? (body.dataset.service || '') : '',
    pageCity: body.dataset ? (body.dataset.city || '') : ''
  };
}

/* ---------------------------------------------------------------
   Multi-step lead form(s). Works for the page form (#leadForm) and
   any popup form. Supports .choice / .chip-choice selectors that
   feed a hidden input, native selects/inputs, progress, validation.
   Posts JSON to data-endpoint (absolute HTTPS proxy). Never sees the token.
--------------------------------------------------------------- */
function initLeadForms() {
  document.querySelectorAll('form.lead-form').forEach(setupLeadForm);
}

function setupLeadForm(form) {
  if (form.dataset.bound) return;
  form.dataset.bound = '1';

  const endpoint = form.dataset.endpoint || 'https://mediagrowth.com.br/ezra-lead-api/api.php';
  const leadType = form.dataset.leadType || 'Estimate form';
  const isCallForm = form.classList.contains('lead-form--call') || /call/i.test(leadType);
  const OWNER_TEL = 'tel:+16174617575';
  const steps = Array.from(form.querySelectorAll('.lead-step'));
  const bar = form.querySelector('.lead-form__bar');
  const labels = Array.from(form.querySelectorAll('.lead-form__steplabel'));
  const success = form.querySelector('.lead-form__success');
  const stepsWrap = form.querySelector('.lead-form__steps');
  const progress = form.querySelector('.lead-form__progress');
  let current = 0;
  const total = steps.length || 1;

  // choice cards / chips -> hidden input value
  form.querySelectorAll('[data-choice-group]').forEach(group => {
    const name = group.dataset.choiceGroup;
    const hidden = form.querySelector(`input[type="hidden"][name="${name}"]`);
    group.querySelectorAll('[data-choice]').forEach(opt => {
      opt.addEventListener('click', () => {
        group.querySelectorAll('[data-choice]').forEach(o => o.classList.remove('is-selected'));
        opt.classList.add('is-selected');
        if (hidden) { hidden.value = opt.dataset.choice; hidden.classList.remove('field-error'); }
        // auto-advance on single-select first step for snappier UX
        if (group.dataset.autoNext === '1' && steps.length > 1) setTimeout(() => go(current + 1), 180);
      });
    });
  });

  attachPhoneMask(form.querySelector('input[type="tel"]'));

  const setStep = (i) => {
    current = Math.max(0, Math.min(i, total - 1));
    steps.forEach((s, idx) => s.classList.toggle('is-active', idx === current));
    if (bar) bar.style.width = ((current + 1) / total * 100) + '%';
    labels.forEach((l, idx) => {
      l.classList.toggle('is-active', idx === current);
      l.classList.toggle('is-done', idx < current);
    });
    const active = steps[current];
    const firstField = active && active.querySelector('input:not([type=hidden]), select, textarea');
    if (firstField) setTimeout(() => firstField.focus({ preventScroll: true }), 60);
  };
  const go = (i) => setStep(i);

  const validateStep = () => {
    const active = steps[current];
    if (!active) return true;
    let ok = true;
    active.querySelectorAll('[required]').forEach(f => {
      f.classList.remove('field-error');
      const val = (f.value || '').trim();
      if (!val) {
        f.classList.add('field-error'); ok = false;
        const grp = f.closest('.form-group') || active;
        const cg = active.querySelector('[data-choice-group]');
        if (cg && f.type === 'hidden') cg.classList.add('field-error');
      }
      if (f.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { f.classList.add('field-error'); ok = false; }
      if (f.type === 'tel' && val && val.replace(/\D/g, '').length < 10) { f.classList.add('field-error'); ok = false; }
    });
    return ok;
  };

  form.querySelectorAll('[data-next]').forEach(btn => btn.addEventListener('click', () => { if (validateStep()) go(current + 1); }));
  form.querySelectorAll('[data-prev]').forEach(btn => btn.addEventListener('click', () => go(current - 1)));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep()) return;
    const btn = form.querySelector('button[type="submit"]');
    const orig = btn ? btn.textContent : '';
    if (btn) { btn.innerHTML = isCallForm ? 'Connecting...' : 'Sending...'; btn.disabled = true; }

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    Object.assign(payload, pageContext());
    payload.leadType = leadType;
    // The call popup captures only a phone number. The GHL proxy requires a name,
    // so we stamp a clear placeholder that reads well in the CRM.
    if (isCallForm && (!payload.firstName || !payload.firstName.trim())) {
      payload.firstName = 'Website caller';
    }

    let dialed = false;
    const dialOwner = () => {
      if (dialed) return;
      dialed = true;
      window.location.href = OWNER_TEL;
    };

    try {
      await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } catch (err) { /* proxy also logs a fallback copy; never block the call */ }
    finally {
      if (btn) { btn.innerHTML = orig; btn.disabled = false; }
      if (isCallForm) {
        // Lead is saved (or logged as fallback) either way; always place the call.
        showSuccess();
        dialOwner();
      } else {
        showSuccess();
      }
    }
  });

  function showSuccess() {
    if (stepsWrap) stepsWrap.style.display = 'none';
    if (progress) progress.style.display = 'none';
    const sl = form.querySelector('.lead-form__steplabels'); if (sl) sl.style.display = 'none';
    if (success) { success.hidden = false; success.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }

  setStep(0);
}

/* ---------------------------------------------------------------
   Popups: contact (estimate) + call-back. Injected once per page by
   the server template as <template>. Openers carry data-lead-popup
   or data-call-popup. Context (service/city/page) is captured on open.
--------------------------------------------------------------- */
function initPopups() {
  const contactModal = document.getElementById('ezContactModal');
  const callModal = document.getElementById('ezCallModal');

  const openModal = (modal, opener) => {
    if (!modal) return;
    // stamp context into the modal's hidden fields (in case data attrs on opener refine it)
    const ctx = pageContext();
    const svc = (opener && opener.dataset.service) || ctx.pageService || '';
    const city = (opener && opener.dataset.city) || ctx.pageCity || '';
    const setH = (name, v) => { const f = modal.querySelector(`input[name="${name}"]`); if (f && v) f.value = v; };
    if (svc) setH('service', svc);
    if (city) setH('city', city);
    modal.classList.add('is-open');
    document.body.classList.add('ezmodal-open');
    const first = modal.querySelector('[data-choice], input:not([type=hidden]), button');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 80);
  };
  const closeModal = (modal) => {
    if (!modal) return;
    modal.classList.remove('is-open');
    if (!document.querySelector('.ezmodal.is-open')) document.body.classList.remove('ezmodal-open');
  };

  // If the mobile menu is open, close it before opening a modal
  const closeMenuIfOpen = () => {
    const menu = document.getElementById('navMenu');
    const toggle = document.getElementById('navToggle');
    if (menu && menu.classList.contains('open')) {
      menu.classList.remove('open'); if (toggle) toggle.classList.remove('active');
      document.body.style.cssText = ''; document.body.classList.remove('menu-open');
    }
  };

  document.querySelectorAll('[data-lead-popup]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); closeMenuIfOpen(); openModal(contactModal, el); });
  });
  document.querySelectorAll('[data-call-popup]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); closeMenuIfOpen(); openModal(callModal, el); });
  });

  // Every phone link on the site opens the call popup first (capture the number
  // into the CRM as a Call Request, source site, before dialing). The final
  // owner-dial (data-direct-dial) and the JS dial in the form are exempt so we
  // never loop back into the popup.
  document.querySelectorAll('a[href^="tel:"]').forEach(el => {
    if (el.hasAttribute('data-direct-dial')) return;
    if (el.hasAttribute('data-call-popup')) return; // already bound above
    el.addEventListener('click', (e) => {
      e.preventDefault();
      closeMenuIfOpen();
      openModal(callModal, el);
    });
  });

  document.querySelectorAll('.ezmodal').forEach(modal => {
    modal.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', () => closeModal(modal)));
    const bd = modal.querySelector('.ezmodal__backdrop');
    if (bd) bd.addEventListener('click', () => closeModal(modal));
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.ezmodal.is-open').forEach(m => closeModal(m));
  });

  // bind the forms that live inside the popups
  document.querySelectorAll('.ezmodal form.lead-form').forEach(setupLeadForm);
}
