/* =====================================================
   BROWSE SPACES — facility-portal style facility browser
   -----------------------------------------------------
   Renders the bookable-spaces grid on the student dashboard.
   Tiers (1 Hour / 4 Hours / Full Day) are computed from
   each space's stored hourly_rate, with bulk discounts:
       1 hr   = hourly_rate
       4 hrs  = hourly_rate × 4 × 0.85   (15% bulk)
       1 day  = hourly_rate × 9 × 0.70   (30% off, ~9 working hrs)
   Clicking "Availability" pre-fills the existing New Space
   Booking form and switches the dashboard to it.
   ===================================================== */

(function () {
    if (typeof window === 'undefined') return;
    let bsCache = [];       // all loaded spaces
    let bsCatList = [];     // distinct categories

    /* ─── Icon + color per category (Malay seed categories) ─── */
    const CATEGORY_VISUAL = {
        'BILIK KULIAH':    { icon: 'fas fa-chalkboard-user', cls: 'bs-img-purple', label: 'Lecture' },
        'BILIK MESYUARAT': { icon: 'fas fa-people-group',    cls: 'bs-img-blue',   label: 'Meeting' },
        'DEWAN':           { icon: 'fas fa-microphone-lines',cls: 'bs-img-amber',  label: 'Hall'    },
        'GELANGGANG':      { icon: 'fas fa-basketball',      cls: 'bs-img-orange', label: 'Court'   },
        'MAKMAL KOMPUTER': { icon: 'fas fa-laptop-code',     cls: 'bs-img-cyan',   label: 'Lab'     },
        'GIMNASIUM':       { icon: 'fas fa-dumbbell',        cls: 'bs-img-green',  label: 'Gym'     },
        'SURAU':           { icon: 'fas fa-mosque',          cls: 'bs-img-violet', label: 'Surau'   },
        'PERPUSTAKAAN':    { icon: 'fas fa-book',            cls: 'bs-img-violet', label: 'Library' },
        // English fallbacks
        'Lecture Hall':    { icon: 'fas fa-chalkboard-user', cls: 'bs-img-purple', label: 'Lecture' },
        'Meeting Room':    { icon: 'fas fa-people-group',    cls: 'bs-img-blue',   label: 'Meeting' },
        'Computer Lab':    { icon: 'fas fa-laptop-code',     cls: 'bs-img-cyan',   label: 'Lab'     },
        'Auditorium':      { icon: 'fas fa-microphone-lines',cls: 'bs-img-amber',  label: 'Hall'    },
        'Sports Facility': { icon: 'fas fa-basketball',      cls: 'bs-img-orange', label: 'Court'   },
    };
    function visualFor(cat) {
        return CATEGORY_VISUAL[cat] || { icon: 'fas fa-door-open', cls: 'bs-img-violet', label: cat };
    }

    /* ─── Price tier calculator ─── */
    function priceTiers(rate) {
        const r = parseFloat(rate) || 0;
        if (r <= 0) return null;  // free space — no price block shown
        return {
            hour: r,
            fourHour: Math.round(r * 4 * 0.85 * 100) / 100,
            fullDay:  Math.round(r * 9 * 0.70 * 100) / 100,
        };
    }
    function rm(n) { return 'RM ' + parseFloat(n).toFixed(2); }

    /* ─── Synthetic facility list ─── */
    function facilitiesFor(cat, capacity) {
        const sets = {
            'BILIK KULIAH':    ['Whiteboard', 'Projector', 'Air-cond', `${capacity} chairs`],
            'BILIK MESYUARAT': ['Conference table', 'TV display', 'Air-cond', 'Whiteboard'],
            'DEWAN':           ['Stage', 'PA system', 'Air-cond', 'Lighting rig'],
            'GELANGGANG':      ['Court markings', 'Lighting', 'Net (where applicable)', 'Spectator seats'],
            'MAKMAL KOMPUTER': [`${capacity} workstations`, 'Air-cond', 'Projector', 'Whiteboard'],
            'GIMNASIUM':       ['Equipment', 'Mirrors', 'Air-cond', 'Lockers'],
        };
        return sets[cat] || ['Standard amenities', `Capacity ${capacity}`];
    }

    /* ─── API ─── */
    async function fetchSpaces() {
        const res = await fetch('../php/user_spaces.php?action=get_spaces', { credentials: 'same-origin' });
        return (await res.json()).data || [];
    }

    /* ─── DOM helpers ─── */
    const $ = id => document.getElementById(id);

    /* ─── Card rendering ─── */
    function cardHtml(s) {
        const v = visualFor(s.category);
        const tiers = priceTiers(s.hourly_rate);
        const facilities = facilitiesFor(s.category, s.seating_capacity || 0).join(', ');

        const prices = tiers ? `
            <div class="bs-prices">
                <div class="bs-price bs-price-1h">${rm(tiers.hour)}<small>/ 1 Hour</small></div>
                <div class="bs-price bs-price-4h">${rm(tiers.fourHour)}<small>/ 4 Hours</small></div>
                <div class="bs-price bs-price-day">${rm(tiers.fullDay)}<small>/ Full Day</small></div>
            </div>
            <div class="bs-price-meta">* Full Day duration is ${s.operation_time || '08:00 - 18:00'}</div>
        ` : `
            <div class="bs-prices">
                <div class="bs-price bs-price-free">FREE</div>
            </div>
        `;

        const location = (s.department || s.campus || 'UiTM Tapah').toUpperCase();

        // Real image if available, fallback to gradient + icon.
        // SVG illustrations are shown whole (contain); photos fill the cell (cover).
        const isSvg = /\.svg(\?|$)/i.test(s.image_url || '');
        const imgCls = 'bs-img-photo' + (isSvg ? ' bs-img-illustration' : '');
        const imgHtml = s.image_url
            ? `<img src="${s.image_url}" alt="${escapeHtml(s.space_name)}" class="${imgCls}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
               <div class="bs-img ${v.cls}" style="display:none;position:absolute;inset:0;"><i class="${v.icon}"></i></div>`
            : `<div class="bs-img ${v.cls}"><i class="${v.icon}"></i></div>`;

        return `
        <article class="bs-card" data-space-id="${s.id}" data-category="${s.category}">
            <div class="bs-img-cell">${imgHtml}</div>
            <div class="bs-body">
                <h3 class="bs-title" onclick="window.openSpaceDetail(${s.id})">${escapeHtml(s.space_name)}</h3>
                <div class="bs-info">
                    <div class="bs-info-row"><i class="fas fa-location-dot"></i> ${escapeHtml(location)}</div>
                    <div class="bs-info-row"><i class="fas fa-bookmark"></i> Category: ${escapeHtml(s.category)} &nbsp;·&nbsp; <i class="fas fa-users" style="color:#5F259F;"></i> Max. Capacity: ${s.seating_capacity || '—'} person</div>
                    <div class="bs-info-row"><i class="fas fa-couch"></i> Facilities: ${escapeHtml(facilities)}</div>
                </div>
                ${prices}
            </div>
            <div class="bs-action">
                <button class="bs-availability-btn" onclick="window.openSpaceDetail(${s.id})">
                    <i class="far fa-calendar-check"></i> Availability
                </button>
            </div>
        </article>`;
    }

    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[c]));
    }

    function renderList(list) {
        const el = $('bsCardList');
        if (!el) return;
        if (!list.length) {
            el.innerHTML = `<div class="bs-empty"><i class="fas fa-circle-info" style="color:#5F259F;"></i> No spaces match your filters. Try clearing them.</div>`;
            $('bsCount').textContent = '0';
            return;
        }
        el.innerHTML = list.map(cardHtml).join('');
        $('bsCount').textContent = list.length;
    }

    /* ─── Filter / search ─── */
    function applyFilters() {
        const event = ($('bsEvent')?.value || '').toLowerCase().trim();
        const cat   = $('bsCategory')?.value || '';
        let filtered = bsCache.filter(s => s.is_active != 0);
        if (cat)   filtered = filtered.filter(s => s.category === cat);
        if (event) filtered = filtered.filter(s =>
            (s.space_name + ' ' + s.category + ' ' + (s.department || '')).toLowerCase().includes(event)
        );
        renderList(filtered);
    }

    /* ─── Init: load on first activation ─── */
    let loaded = false;
    async function ensureLoaded() {
        if (loaded) return;
        try {
            const list = await fetchSpaces();
            bsCache = list || [];
            // Build distinct categories for the dropdown
            const cats = Array.from(new Set(bsCache.map(s => s.category))).sort();
            bsCatList = cats;
            const catSel = $('bsCategory');
            if (catSel && catSel.options.length <= 1) {
                cats.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c; opt.textContent = c;
                    catSel.appendChild(opt);
                });
            }
            applyFilters();
            loaded = true;
        } catch (e) {
            const el = $('bsCardList');
            if (el) el.innerHTML = `<div class="bs-empty">Could not load spaces. Please reload the page.</div>`;
        }
    }

    /* ─── Wire events ─── */
    document.addEventListener('DOMContentLoaded', () => {
        $('bsSearchBtn')?.addEventListener('click', applyFilters);
        $('bsEvent')?.addEventListener('input', applyFilters);
        $('bsCategory')?.addEventListener('change', applyFilters);
        // Quick mini-nav inside the search panel
        document.querySelectorAll('.bs-mini-link[data-view]').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                if (typeof switchToView === 'function') switchToView(link.dataset.view);
            });
        });
    });

    // Expose loader so view-switch can trigger it
    window.bsEnsureLoaded = ensureLoaded;
})();
