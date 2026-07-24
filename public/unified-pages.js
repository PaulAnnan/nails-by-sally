(function () {
  const page = (location.pathname.split('/').pop() || 'home.html').toLowerCase();
  const links = [
    ['home.html', 'Home'],
    ['about.html', 'About'],
    ['services.html', 'Services'],
    ['gallery.html', 'Gallery'],
    ['contact.html', 'Contact']
  ];

  function linkMarkup(mobile) {
    const items = links.map(([href, label]) => {
      const active = page === href ? ' active' : '';
      return `<a class="nav-link${active}" href="${href}">${label}</a>`;
    });
    items.push('<a class="nav-link btn btn-primary nav-book-now" data-glow href="booking.html">Book Now</a>');
    return items.join('');
  }

  function closeMenu(button, menu) {
    menu.classList.remove('open');
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Open Menu');
  }

  function setupNavigation() {
    const nav = document.querySelector('.site-header .nav');
    const headerInner = document.querySelector('.site-header .header-inner');
    if (!nav || !headerInner) return;
    nav.innerHTML = linkMarkup(false);

    let button = document.getElementById('menuBtn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'menuBtn';
      button.className = 'menu-btn';
      button.type = 'button';
      button.textContent = '';
      button.setAttribute('aria-controls', 'mobileMenu');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Open Menu');
      headerInner.appendChild(button);
    }

    let menu = document.getElementById('mobileMenu');
    if (!menu) {
      menu = document.createElement('nav');
      menu.id = 'mobileMenu';
      menu.className = 'mobile-menu';
      menu.hidden = true;
      document.querySelector('.site-header').insertAdjacentElement('afterend', menu);
    }
    menu.innerHTML = linkMarkup(true);
    closeMenu(button, menu);

    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const opening = !menu.classList.contains('open');
      if (opening) {
        menu.classList.add('open');
        menu.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        button.setAttribute('aria-label', 'Close Menu');
      } else {
        closeMenu(button, menu);
      }
    }, true);

    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) closeMenu(button, menu);
    });
    document.addEventListener('click', function (event) {
      if (menu.classList.contains('open') && !menu.contains(event.target) && !button.contains(event.target)) closeMenu(button, menu);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menu.classList.contains('open')) {
        closeMenu(button, menu);
        button.focus();
      }
    });
  }

  function setupMotion() {
    const selectors = [
      '.page-header > *', '.title-wrap > *', '.story-section', '.stats-section',
      '.values-title', '.value-card', '.artist-profile', '.services-hero-copy',
      '.services-hero-collage', '.svc-tabs', '.svc-card', '.services-cta',
      '.controls', '.search', '.tools', '.masonry > *', '.hero-section > *',
      '.info-card', '.contact-form', '.cta-section', '.page-title > *',
      '#bookingForm > .form-section', '.submit-section'
    ];
    const targets = [];
    selectors.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (element, index) {
        if (targets.includes(element)) return;
        element.classList.add('unified-reveal');
        element.style.setProperty('--unified-delay', `${(index % 4) * 65}ms`);
        targets.push(element);
      });
    });

    document.documentElement.classList.add('unified-motion-ready');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      targets.forEach(element => element.classList.add('unified-visible'));
      return;
    }
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('unified-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .1, rootMargin: '0px 0px -7% 0px' });
    targets.forEach(element => observer.observe(element));
  }


  function setupMiniFooter() {
    document.querySelectorAll('footer.mini-site-footer').forEach(function (footer) {
      footer.remove();
    });

    const footer = document.createElement('footer');
    footer.className = 'mini-site-footer unified-reveal unified-visible';
    footer.setAttribute('aria-label', 'Nails By Sally footer');
    footer.innerHTML = `
      <div class="mini-footer-grid">
        <a class="mini-footer-brand brand" href="home.html" aria-label="Nails By Sally home">
          <span class="mini-footer-logo brand-logo"><img src="sffsfs.png" alt="Nails By Sally logo"></span>
          <span class="mini-footer-wordmark brand-text"><strong>Nails By Sally</strong><small>Nail Studio</small></span>
        </a>
        <div class="mini-footer-meta" aria-label="Studio essentials">
          <a href="tel:+15145460687">(514) 546-0687</a>
          <a href="mailto:NailsBySxlly@gmail.com">NailsBySxlly@gmail.com</a>
          <span>Montreal, Quebec</span>
          <span>By appointment</span>
        </div>
        <nav class="mini-footer-links" aria-label="Footer navigation">
          <a href="services.html">Services</a>
          <a href="gallery.html">Gallery</a>
          <a href="booking.html">Book Now</a>
          <a href="contact.html">Contact</a>
        </nav>
        <div class="mini-footer-socials" aria-label="Social media links">
          <a href="https://www.instagram.com/nails.by.sxlly" target="_blank" rel="noopener noreferrer" aria-label="Instagram">IG</a>
          <a href="https://www.tiktok.com/@nails.by.sxlly?lang=en" target="_blank" rel="noopener noreferrer" aria-label="TikTok">TK</a>
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">FB</a>
        </div>
      </div>
      <div class="mini-footer-bottom">
        <span>&copy; ${new Date().getFullYear()} Nails By Sally.</span>
        <span>Clean prep. Detailed artistry. Custom sets.</span>
      </div>
    `;
    document.body.appendChild(footer);
  }


  function init() {
    setupNavigation();
    setupMiniFooter();
    setupMotion();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

