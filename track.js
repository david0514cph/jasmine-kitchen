// GA4 section analytics: which sections people see, how long they stay, and what they click.
// Events: section_view (first time a section is half on screen), section_time (seconds on screen,
// sent when the visitor leaves or switches tab), element_click (any link or button).
(function () {
	if (typeof gtag !== 'function') return;

	const sections = Array.from(document.querySelectorAll('main section, section[id]'))
		.filter((el, i, all) => all.indexOf(el) === i);

	function nameOf(el) {
		if (!el) return '(none)';
		if (el.id) return el.id;
		const label = el.getAttribute('aria-label');
		if (label) return label;
		const heading = el.querySelector('h1, h2, h3');
		return heading ? heading.textContent.trim().slice(0, 40) : '(untitled)';
	}

	const state = new Map(sections.map((el) => [el, { seen: false, since: null, ms: 0 }]));

	function stop(s) {
		if (s.since !== null) { s.ms += performance.now() - s.since; s.since = null; }
	}

	const observer = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			const s = state.get(entry.target);
			// Count a section as viewed when half of it, or half the screen, is filled by it.
			const visible = entry.intersectionRatio >= 0.5 ||
				entry.intersectionRect.height >= window.innerHeight * 0.5;
			if (visible && document.visibilityState === 'visible') {
				if (!s.seen) { s.seen = true; gtag('event', 'section_view', { section_name: nameOf(entry.target) }); }
				if (s.since === null) s.since = performance.now();
			} else {
				stop(s);
			}
		});
	}, { threshold: [0, 0.25, 0.5, 0.75, 1] });
	sections.forEach((el) => observer.observe(el));

	function flush() {
		state.forEach((s, el) => {
			stop(s);
			const seconds = Math.round(s.ms / 1000);
			if (seconds >= 1) gtag('event', 'section_time', { section_name: nameOf(el), seconds: seconds, transport_type: 'beacon' });
			s.ms = 0;
		});
	}

	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			flush();
		} else {
			// Back on the tab: restart timers for sections that are still on screen.
			sections.forEach((el) => {
				const r = el.getBoundingClientRect();
				const shown = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
				if (shown >= Math.min(r.height, window.innerHeight) * 0.5) state.get(el).since = performance.now();
			});
		}
	});
	window.addEventListener('pagehide', flush);

	document.addEventListener('click', (event) => {
		const el = event.target.closest('a, button, summary, [role="button"]');
		if (!el) return;
		const text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
		gtag('event', 'element_click', {
			click_text: text || '(no text)',
			click_url: el.getAttribute('href') || '',
			section_name: nameOf(el.closest('section') || el.closest('header, footer, nav, dialog, [id]')),
		});
	}, true);
})();
