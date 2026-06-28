/* =====================================================
   SPACE DETAIL — facility-portal style detail view
   -----------------------------------------------------
   Loads full space info (image, prices, contacts, map,
   additional info) and binds the Availability button
   to start the multi-step reservation flow.
   ===================================================== */

(function () {
    if (typeof window === 'undefined') return;
    let currentSpace = null;

    async function apiGet(spaceId) {
        const res = await fetch(`../php/space_detail.php?action=get&space_id=${spaceId}`, { credentials: 'same-origin' });
        return (await res.json());
    }

    function rm(n) { return 'RM ' + parseFloat(n || 0).toFixed(2); }
    const $ = id => document.getElementById(id);

    function renderDetail(s) {
        currentSpace = s;
        $('sdSpaceName').textContent = s.space_name || '—';
        $('sdLocName').textContent = s.space_name || '—';

        // Image
        const img = $('sdImage');
        img.classList.remove('is-loaded');
        // SVG illustrations are shown whole (contain); photos fill the frame (cover).
        img.classList.toggle('sd-illustration', /\.svg(\?|$)/i.test(s.image_url || ''));
        if (s.image_url) {
            img.src = s.image_url;
            img.onload  = () => img.classList.add('is-loaded');
            img.onerror = () => img.classList.remove('is-loaded');
        }

        // Pricing
        const rate    = parseFloat(s.hourly_rate || 0);
        const rate4   = parseFloat(s.rate_4hour || rate * 4 * 0.85);
        const rateDay = parseFloat(s.rate_full_day || rate * 9 * 0.70);
        $('sdPrice1h').textContent  = rm(rate);
        $('sdPrice4h').textContent  = rm(rate4);
        $('sdPriceDay').textContent = rm(rateDay);
        $('sdOpTime').textContent   = s.operation_time || '08:00 - 18:00';

        // Contact block is a single static RBS department contact (in the HTML).

        // Additional info
        if (s.additional_info) {
            $('sdAdditionalSection').style.display = '';
            $('sdAdditional').textContent = s.additional_info;
        } else {
            $('sdAdditionalSection').style.display = 'none';
        }

        // Meta
        $('sdCategory').textContent = s.category || '—';
        $('sdCapacity').textContent = s.seating_capacity || '—';
        $('sdFacilities').textContent = s.facilities_list || 'Standard amenities';
    }

    /* ─── Public API: open the detail view for a space ─── */
    window.openSpaceDetail = async function (spaceId) {
        if (typeof switchToView !== 'function') return;
        switchToView('spaceDetailNew');
        $('sdSpaceName').textContent = 'Loading…';

        const j = await apiGet(spaceId);
        if (!j.success) {
            if (typeof showToast === 'function') showToast(j.message || 'Could not load space', 'error');
            return;
        }
        renderDetail(j.data);

        // Update breadcrumb
        const bc = document.getElementById('topBreadcrumb');
        if (bc) {
            bc.innerHTML = '<span>Home</span> <i class="fas fa-chevron-right"></i> ' +
                '<span style="cursor:pointer;" onclick="switchToView(\'browseSpaces\')">Book a Space</span> <i class="fas fa-chevron-right"></i> ' +
                `<span class="active-crumb">${(j.data.space_name || '').toUpperCase()}</span>`;
        }
    };

    /* ─── Availability button → start reservation flow ─── */
    document.addEventListener('DOMContentLoaded', () => {
        $('sdAvailabilityBtn')?.addEventListener('click', () => {
            if (!currentSpace) return;
            if (typeof window.startReservation === 'function') {
                window.startReservation(currentSpace);
            }
        });
    });
})();
