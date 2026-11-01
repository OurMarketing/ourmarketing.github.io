/* Our Marketing · multilingual navigation and validated enquiry delivery */
(() => {
  'use strict';
  const cfgNode = document.getElementById('page-config');
  if (!cfgNode) return;
  const cfg = JSON.parse(cfgNode.textContent);
  const words = cfg.form;
  const nav = document.getElementById('main-nav');
  const toggle = document.getElementById('menu-toggle');
  const language = document.querySelector('.language');
  const closeMenu = () => { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); };

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    if (open) language.open = false;
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  language.addEventListener('toggle', () => { if (language.open) closeMenu(); });
  document.addEventListener('click', event => {
    if (!language.contains(event.target)) language.open = false;
    if (!nav.contains(event.target) && !toggle.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (language.open) { language.open = false; language.querySelector('summary').focus(); }
    else if (nav.classList.contains('open')) { closeMenu(); toggle.focus(); }
  });

  let activeSection = location.hash;
  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) activeSection = '#' + entry.target.id;
    }, { rootMargin: '-15% 0px -55% 0px' });
    document.querySelectorAll('main section[id]').forEach(el => sectionObserver.observe(el));
  }
  document.querySelectorAll('[data-language]').forEach(link => link.addEventListener('click', () => {
    link.href = link.getAttribute('href').split('#')[0] + (activeSection && activeSection !== '#top' ? activeSection : '');
  }));
  document.querySelectorAll('[data-service]').forEach(link => link.addEventListener('click', () => {
    const select = document.getElementById('service-select');
    if ([...select.options].some(option => option.value === link.dataset.service)) select.value = link.dataset.service;
  }));

  const endpoint = 'https://tongzhi.wangxiansheng.com/api/notify.php';
  const form = document.getElementById('brief-form');
  const submit = form.querySelector('button[type=submit]');
  const submitText = form.querySelector('.submit-text');
  const status = document.getElementById('form-status');
  const input = name => form.elements.namedItem(name);
  const value = name => input(name).value.trim();
  const phonePattern = /^\+?[0-9()（）\s.\-]+$/;
  let sending = false;
  submit.disabled = false;

  const show = (message, state = '') => {
    status.textContent = message;
    status.dataset.state = state;
  };
  const pending = on => {
    sending = on;
    submit.disabled = on;
    form.setAttribute('aria-busy', String(on));
    submitText.textContent = on ? words.sending : words.submit;
  };
  const normalizeWebsite = () => {
    const item = input('website');
    const raw = item.value.trim();
    if (raw && !/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && /^[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+(?:[/?#].*)?$/u.test(raw)) item.value = 'https://' + raw;
  };
  input('website').addEventListener('blur', normalizeWebsite);
  form.querySelectorAll('input,select,textarea').forEach(el => {
    el.addEventListener('input', () => { el.setCustomValidity(''); if (status.textContent) show(''); });
    el.addEventListener('change', () => el.setCustomValidity(''));
  });
  const errorMessage = (httpStatus, response) => {
    const code = response && response.code;
    const errors = {
      origin_not_allowed: words.failure,
      invalid_api_key: words.failure,
      payload_too_large: words.invalid,
      save_failed: words.failure,
      invalid_json: words.failure,
      empty_payload: words.invalid
    };
    return errors[code] || (httpStatus === 429 ? (words.rate_limit || words.failure) : words.failure);
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    show('');
    normalizeWebsite();
    ['name','email','phone','message','website'].forEach(key => input(key).setCustomValidity(''));
    if (!value('name')) input('name').setCustomValidity(words.invalid);
    const phone = value('phone');
    const digits = phone.replace(/\D/g, '');
    if (!phonePattern.test(phone) || digits.length < 7 || digits.length > 20) input('phone').setCustomValidity(words.phone_invalid);
    if (value('message').length < 5) input('message').setCustomValidity(words.invalid);
    if (new TextEncoder().encode(value('message')).length > 16000) input('message').setCustomValidity(words.invalid);
    if (!form.reportValidity()) { show(words.invalid, 'error'); return; }
    // Bot trap: do not attempt submission for automated fills.
    if (value('fax')) { show(words.failure, 'error'); return; }

    const select = input('service');
    const serviceName = select.options[select.selectedIndex].text.trim();
    const cleanUrl = location.origin + location.pathname;
    const message = [
      'Interested service: ' + serviceName,
      'Company / organisation: ' + (value('company') || '-'),
      'Website: ' + (value('website') || '-'),
      'Preferred language: ' + cfg.lang,
      '',
      value('message')
    ].join('\n');
    // The supplied notify.php reference accepts multipart FormData and reports
    // receipt only when HTTP 2xx AND JSON {ok:true}; do not infer success from HTTP alone.
    const body = new FormData();
    Object.entries({
      site_name: 'Our Marketing',
      source_url: cleanUrl,
      subject: 'Our Marketing | ' + serviceName + ' enquiry',
      name: value('name'),
      email: value('email'),
      phone,
      service: select.value,
      company: value('company'),
      website: value('website'),
      message,
      ua: (navigator.userAgent || '').slice(0, 500)
    }).forEach(([key, val]) => body.append(key, val));

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 30000);
    pending(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', body, mode: 'cors', credentials: 'omit', signal: controller.signal
      });
      let result = null;
      try { result = await response.json(); } catch (_) { /* uncertain response; do not claim receipt */ }
      if (!response.ok || !result || result.ok !== true) {
        throw new Error(errorMessage(response.status, result));
      }
      form.reset();
      show(words.success, 'success');
      status.focus({ preventScroll: true });
    } catch (error) {
      show(error && error.name === 'AbortError' ? words.timeout :
        (error && error.message && error.message !== 'Failed to fetch' ? error.message : words.failure), 'error');
    } finally {
      window.clearTimeout(timer);
      pending(false);
    }
  });
})();
