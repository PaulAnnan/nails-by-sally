(function () {
  const main = document.querySelector('main');
  if (!main) return;

  main.className = 'about-page';
  main.innerHTML = `
    <section class="page-header about-hero">
      <div class="container about-hero-grid">
        <div class="about-hero-copy">
          <span class="hero-spark" aria-hidden="true">✦</span>
          <h1 class="page-title">
            <span class="about-script">About ♡</span>
            <span class="about-nails">NAILS</span>
            <span class="about-signature">By Sally</span>
          </h1>
          <p class="page-subtitle">We're passionate about creating beautiful nails that reflect your unique style. Our nail studio combines artistry with expertise to deliver exceptional results in a relaxing, welcoming environment.</p>
          <a class="about-cta" href="booking.html">Book Appointment <span aria-hidden="true">✦</span></a>
        </div>

        <div class="about-hero-media" aria-label="Sally and featured nail designs">
          <span class="orbit orbit-one" aria-hidden="true"></span>
          <span class="orbit-spark orbit-spark-one" aria-hidden="true">✦</span>
          <span class="orbit-spark orbit-spark-two" aria-hidden="true">✦</span>
          <figure class="hero-photo hero-photo-main"><img src="Images/Sally.jpg" alt="Sally, owner and nail artist"></figure>
          <figure class="hero-photo hero-photo-small"><img src="Images/Nails4.png" alt="Black and blush nail set"></figure>
          <figure class="hero-photo hero-photo-years">
            <img src="Images/Nails2.png" alt="Detailed nail art">
            <figcaption><strong>3+</strong><span>Years of passion<br>&amp; dedication</span></figcaption>
          </figure>
        </div>
      </div>
    </section>

    <section class="section story-wrap">
      <div class="container">
        <div class="story-section">
          <div class="story-visual">
            <figure class="story-shot story-shot-one"><img src="Images/Nails4.png" alt="Black and pink sculpted nails" loading="lazy"></figure>
            <figure class="story-shot story-shot-two"><img src="Images/Nails8.png" alt="Soft pink nail set" loading="lazy"></figure>
            <div class="client-seal"><small>Happy Clients</small><strong>300+</strong><small>Happy Clients</small></div>
          </div>
          <div class="story-content">
            <h2>Our <em>Story</em> <span aria-hidden="true">✦</span></h2>
            <p>Founded with a passion for nail artistry, Nails By Sally has been creating beautiful nails for over three years. What started as a love for nail design has grown into a premier nail studio dedicated to bringing out the beauty in every client.</p>
            <p>We believe that beautiful nails are more than just an accessory. They're a form of self-expression. Whether you prefer classic elegance or bold artistic designs, our talented team works with you to create nails that perfectly reflect your personality and style.</p>
            <p>Today, we're proud to have served <strong>over 300 clients</strong>, building lasting relationships based on trust, creativity, and exceptional nail care. Every client leaves feeling <strong>confident and beautifully polished.</strong></p>
          </div>
          <span class="story-word" aria-hidden="true">STORY</span>
        </div>
      </div>
    </section>

    <section class="section stats-wrap">
      <div class="container">
        <div class="stats-section">
          <div class="stat-card"><div class="stat-icon">♟</div><div class="stat-number">300+</div><div class="stat-label">Happy Clients</div></div>
          <div class="stat-card"><div class="stat-icon">♛</div><div class="stat-number">3</div><div class="stat-label">Years Experience</div></div>
          <div class="stat-card"><div class="stat-icon">★</div><div class="stat-number">4.9</div><div class="stat-label">Average Rating</div></div>
          <div class="stat-card stat-card-featured"><div class="stat-icon">♥</div><div class="stat-number">100%</div><div class="stat-label">Satisfaction Rate</div></div>
        </div>
      </div>
    </section>

    <section class="section values-wrap">
      <div class="container">
        <h2 class="values-title">What We <em>Stand For</em> <span aria-hidden="true">✦</span></h2>
        <div class="values-grid">
          <article class="value-card">
            <div class="value-icon">◇</div>
            <img class="value-image" src="Images/Nails8.png" alt="Pink artistic nail design" loading="lazy">
            <div class="value-copy"><h3 class="value-title">Artistic Excellence</h3><p class="value-desc">Every nail design is crafted with precision and artistic flair to create stunning results that exceed expectations.</p></div>
          </article>
          <article class="value-card">
            <div class="value-icon">♛</div>
            <img class="value-image" src="Images/Nails2.png" alt="Professional black nail design" loading="lazy">
            <div class="value-copy"><h3 class="value-title">Professional Expertise</h3><p class="value-desc">Our certified nail technician stays current with the latest trends and techniques to deliver the highest quality service.</p></div>
          </article>
          <article class="value-card">
            <div class="value-icon">♥</div>
            <img class="value-image" src="Images/Nails5.png" alt="Premium detailed nail set" loading="lazy">
            <div class="value-copy"><h3 class="value-title">Quality Products</h3><p class="value-desc">We use only premium nail products and tools for long-lasting, beautiful results that prioritize nail health.</p></div>
          </article>
        </div>
      </div>
    </section>

    <section class="section artist-wrap">
      <div class="container">
        <div class="artist-section">
          <div class="artist-content">
            <div class="artist-intro">
              <h2 class="artist-title">Meet Your<br><em>Nail Artist</em> ♡</h2>
              <p class="artist-subtitle">Our certified nail technician is a passionate artist who brings creativity and expertise to every appointment. We stay current with the latest trends and techniques to give you the most beautiful, long-lasting results.</p>
            </div>
            <div class="artist-profile">
              <div class="artist-photo"><img src="Images/Sally.jpg" alt="Sally - Owner &amp; Nail Artist" loading="lazy"></div>
              <div class="artist-info">
                <h3 class="artist-name">Sally Azba</h3>
                <p class="artist-role">Owner &amp; Master Nail Artist</p>
                <p class="artist-bio">With over 3 years of passion for nail artistry, Sally combines technical expertise with creative vision to deliver exceptional results. Specializing in custom nail art, gel applications, and nail health, she's dedicated to making every client feel confident and beautiful.</p>
                <div class="artist-badges"><span class="artist-badge">Licensed Technician</span><span class="artist-badge">Trend Specialist</span><span class="artist-badge">Nail Art Expert</span></div>
              </div>
            </div>
            <span class="artist-spark" aria-hidden="true">✦</span>
          </div>
        </div>
      </div>
    </section>`;

  const footerBrand = document.querySelector('.footer-brand');
  if (footerBrand && !footerBrand.querySelector('.footer-socials')) {
    footerBrand.insertAdjacentHTML('beforeend', '<div class="footer-socials" aria-label="Social media"><a href="#" aria-label="Instagram">◎</a><a href="#" aria-label="TikTok">♪</a><a href="#" aria-label="Facebook">f</a></div>');
  }

  const quickList = document.querySelector('.site-footer .foot-list');
  if (quickList) {
    quickList.innerHTML = '<li><a href="home.html">Home</a></li><li><a href="about.html">About</a></li><li><a href="services.html">Services</a></li><li><a href="gallery.html">Gallery</a></li><li><a href="booking.html">Book Appointment</a></li><li><a href="contact.html">Contact</a></li>';
  }

  const footerLists = document.querySelectorAll('.site-footer .foot-list');
  if (footerLists[1] && !footerLists[1].textContent.includes('Montreal')) {
    footerLists[1].insertAdjacentHTML('beforeend', '<li>Montreal, Quebec</li>');
  }
})();
