/* =====================================================
   RBS 3D Landing Page Interactions
   Three.js scene + scroll-driven Figma-style flow
   ===================================================== */
(function () {
    "use strict";

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const escapeHtml = (value) => String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const lerp = (a, b, t) => a + (b - a) * t;
    const formatDate = (value) => {
        if (!value) return "";
        const [year, month, day] = value.split("-");
        return `${day}/${month}/${year}`;
    };
    const formatTime = (value) => {
        if (!value) return "Any time";
        return value.slice(0, 5);
    };
    const useSrgbTexture = (texture) => {
        if (!window.THREE || !texture) return texture;

        if ("colorSpace" in texture && window.THREE.SRGBColorSpace) {
            texture.colorSpace = window.THREE.SRGBColorSpace;
        } else if ("encoding" in texture && window.THREE.sRGBEncoding) {
            texture.encoding = window.THREE.sRGBEncoding;
        }

        return texture;
    };

    document.addEventListener("DOMContentLoaded", () => {
        setupNavigation();
        setupBooking();
        setupFooterYear();
        setupWelcomeBack();
        setupScrollProgress();
        setupStageScroll();
        setupThreeScene();
    });

    function setupNavigation() {
        const nav = document.getElementById("nav");
        const navLinks = document.getElementById("navLinks");
        const burger = document.getElementById("navBurger");

        const setScrolled = () => {
            nav?.classList.toggle("is-scrolled", window.scrollY > 18);
        };

        setScrolled();
        window.addEventListener("scroll", setScrolled, { passive: true });

        burger?.addEventListener("click", () => {
            const open = navLinks?.classList.toggle("open");
            burger.setAttribute("aria-expanded", open ? "true" : "false");
        });

        navLinks?.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                navLinks.classList.remove("open");
                burger?.setAttribute("aria-expanded", "false");
            });
        });
    }

    function setupBooking() {
        const dateEl = document.getElementById("bkDate");
        const searchBtn = document.getElementById("bkSearch");
        const today = new Date().toISOString().slice(0, 10);
        if (dateEl) {
            dateEl.min = today;
            dateEl.value = today;
        }

        searchBtn?.addEventListener("click", async () => {
            const params = new URLSearchParams();
            const time = document.getElementById("bkTime")?.value;
            const category = document.getElementById("bkCat")?.value;

            if (dateEl?.value) params.set("date", dateEl.value);
            if (time) params.set("time", time);
            if (category) params.set("category", category);

            setAvailabilityState("loading", "Checking availability", "Looking at active and pending bookings for your selected slot.");
            searchBtn.disabled = true;
            searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching';

            try {
                const res = await fetch(`../php/public_availability.php?${params.toString()}`, {
                    credentials: "same-origin"
                });
                const json = await res.json();

                if (!json?.success) {
                    throw new Error(json?.message || "Could not check availability.");
                }

                renderAvailability(json.data);
                document.getElementById("availability")?.scrollIntoView({ behavior: "smooth", block: "start" });
            } catch (error) {
                setAvailabilityState("error", "Availability unavailable", error.message || "Please try again.");
            } finally {
                searchBtn.disabled = false;
                searchBtn.innerHTML = '<i class="fas fa-magnifying-glass"></i> Search';
            }
        });
    }

    function setAvailabilityState(type, title, message) {
        const box = document.getElementById("availabilityState");
        const results = document.getElementById("availabilityResults");

        if (!box) return;
        const icon = type === "loading" ? "fa-spinner fa-spin"
            : type === "error" ? "fa-circle-exclamation"
            : "fa-calendar-check";

        box.hidden = false;
        box.className = `r3-availability-state is-${type}`;
        box.innerHTML = `
            <i class="fas ${icon}"></i>
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(message)}</span>
        `;

        if (results) {
            results.hidden = true;
            results.innerHTML = "";
        }
    }

    function renderAvailability(data) {
        const summaryEl = document.getElementById("availabilitySummary");
        const stateEl = document.getElementById("availabilityState");
        const resultsEl = document.getElementById("availabilityResults");

        if (!data || !resultsEl) return;

        const query = data.query || {};
        const summary = data.summary || {};
        const spaces = Array.isArray(data.spaces) ? data.spaces : [];
        const slot = query.start_time
            ? `${formatTime(query.start_time)} - ${formatTime(query.end_time)}`
            : "any time";
        const category = query.category || "all spaces";

        if (summaryEl) {
            summaryEl.textContent = `${summary.available || 0} available, ${summary.pending || 0} pending and ${summary.booked || 0} booked for ${formatDate(query.date)} at ${slot} in ${category}.`;
        }

        if (!spaces.length) {
            setAvailabilityState("empty", "No matching spaces", "Try another category or date.");
            return;
        }

        if (stateEl) stateEl.hidden = true;

        resultsEl.hidden = false;
        resultsEl.innerHTML = spaces.map((space) => availabilityCard(space, query)).join("");
    }

    function availabilityCard(space, query) {
        const status = space.status || "Available";
        const statusKey = status.toLowerCase().replace(/\s+/g, "-");
        const reservations = Array.isArray(space.reservations) ? space.reservations : [];
        const rate = Number(space.hourly_rate || 0);
        const price = rate > 0 ? `RM ${rate.toFixed(2)} / hour` : "Free";
        const bookingParams = new URLSearchParams();

        if (query?.date) bookingParams.set("date", query.date);
        if (query?.start_time) bookingParams.set("time", formatTime(query.start_time));
        if (space.category) bookingParams.set("category", space.category);

        const conflictHtml = reservations.length
            ? `<ul>${reservations.slice(0, 2).map((reservation) => `
                <li>${formatDate(reservation.start_date)} ${formatTime(reservation.start_time)} - ${formatTime(reservation.end_time)} · ${escapeHtml(reservation.status)}</li>
            `).join("")}</ul>`
            : `<p>No reservation conflicts for this search.</p>`;

        return `
            <article class="r3-availability-card is-${statusKey}">
                <div>
                    <span class="r3-availability-badge">${escapeHtml(status)}</span>
                    <h3>${escapeHtml(space.space_name)}</h3>
                    <p>${escapeHtml(space.space_code || "")} · ${escapeHtml(space.category || "")}</p>
                </div>
                <dl>
                    <div><dt>Capacity</dt><dd>${space.seating_capacity || "N/A"}</dd></div>
                    <div><dt>Rate</dt><dd>${price}</dd></div>
                </dl>
                <div class="r3-conflict-list">${conflictHtml}</div>
                <a class="r3-card-book" href="login_page.html?${bookingParams.toString()}">
                    ${status === "Available" ? "Book this space" : "Log in to choose another slot"}
                    <i class="fas fa-arrow-right"></i>
                </a>
            </article>
        `;
    }

    function setupFooterYear() {
        const year = document.getElementById("yr");
        if (year) year.textContent = new Date().getFullYear();
    }

    function setupWelcomeBack() {
        fetch("../php/auth.php?action=session", { credentials: "same-origin" })
            .then((res) => res.json())
            .then((json) => {
                if (!json?.success || !json.data) return;

                const role = json.data.role;
                const target = role === "Student" ? "user_dashboard.html" : "admin_dashboard.html";
                const name = escapeHtml((json.data.full_name || "there").split(" ")[0]);
                const bar = document.getElementById("welcomeBar");

                if (!bar) return;
                bar.innerHTML = `Welcome back, ${name}. <a href="${target}">Go to dashboard</a>`;
                bar.hidden = false;
            })
            .catch(() => {
                /* Local static previews may not have the PHP session endpoint ready. */
            });
    }

    function setupScrollProgress() {
        const progress = document.getElementById("r3Progress");
        if (!progress) return;

        const update = () => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const amount = max > 0 ? (window.scrollY / max) * 100 : 0;
            progress.style.width = `${amount}%`;
        };

        update();
        window.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);
    }

    function setupStageScroll() {
        const stage = document.querySelector(".r3-stage");
        const board = document.querySelector(".r3-figma-board");
        const title = document.getElementById("stageTitle");
        const desc = document.getElementById("stageDesc");
        const cards = Array.from(document.querySelectorAll("[data-step-card]"));

        if (!stage || !board || !cards.length) return;

        const copy = [
            {
                title: "Browse spaces in a visual canvas",
                desc: "Users start with a clear catalog of rooms, labs, courts and special facilities."
            },
            {
                title: "The timetable becomes the interface",
                desc: "Available, pending and blocked slots are easier to understand when the schedule feels visual."
            },
            {
                title: "Payment stays connected to the booking",
                desc: "Students can see the cost before continuing through ToyyibPay, while staff bookings stay free."
            },
            {
                title: "Approval closes the loop",
                desc: "Moderators approve or reject requests, then the dashboard keeps the status visible."
            }
        ];

        let current = -1;
        let ticking = false;

        const update = () => {
            ticking = false;
            const rect = stage.getBoundingClientRect();
            const scrollable = Math.max(1, stage.offsetHeight - window.innerHeight);
            const progress = clamp(-rect.top / scrollable, 0, 1);
            const idx = Math.min(cards.length - 1, Math.floor(progress * cards.length));

            if (!reduceMotion) {
                board.style.setProperty("--board-rx", `${lerp(10, -4, progress).toFixed(2)}deg`);
                board.style.setProperty("--board-ry", `${lerp(-14, 13, progress).toFixed(2)}deg`);
                board.style.setProperty("--board-y", `${lerp(0, -18, progress).toFixed(1)}px`);
            }

            if (idx === current) return;
            current = idx;

            cards.forEach((card, index) => card.classList.toggle("is-active", index === idx));
            if (title) title.textContent = copy[idx].title;
            if (desc) desc.textContent = copy[idx].desc;
        };

        const queue = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(update);
        };

        update();
        window.addEventListener("scroll", queue, { passive: true });
        window.addEventListener("resize", queue);
    }

    function setupThreeScene() {
        const canvas = document.getElementById("r3Scene");
        if (!canvas || reduceMotion || !window.THREE) {
            document.body.classList.add("no-webgl");
            if (canvas) canvas.dataset.sceneStatus = "fallback";
            return;
        }

        const THREE = window.THREE;
        let renderer;

        try {
            renderer = new THREE.WebGLRenderer({
                canvas,
                antialias: true,
                alpha: true,
                powerPreference: "high-performance"
            });
        } catch (error) {
            document.body.classList.add("no-webgl");
            canvas.dataset.sceneStatus = "fallback";
            return;
        }

        document.body.classList.add("three-ready");
        canvas.dataset.sceneStatus = "ready";
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
        camera.position.set(0, 0.6, 9);

        const root = new THREE.Group();
        scene.add(root);

        const ambient = new THREE.AmbientLight(0xffffff, 1.1);
        scene.add(ambient);

        const point = new THREE.PointLight(0xffd37d, 1.6, 24);
        point.position.set(3, 5, 6);
        scene.add(point);

        const purpleLight = new THREE.PointLight(0x7c3aed, 2.4, 20);
        purpleLight.position.set(-4, -1, 5);
        scene.add(purpleLight);

        const textureLoader = new THREE.TextureLoader();
        const roomPanels = [
            { label: "Bilik Kuliah", src: "../assets/rooms/bilik_kuliah.jpg" },
            { label: "Bilik Mesyuarat", src: "../assets/rooms/bilik_mesyuarat.jpg" },
            { label: "Bilik Seminar", src: "../assets/rooms/bilik_seminar.jpg" },
            { label: "Dewan", src: "../assets/rooms/dewan.jpg" }
        ].map((panel) => ({
            ...panel,
            texture: textureLoader.load(panel.src, useSrgbTexture)
        }));

        const panelGroup = new THREE.Group();
        root.add(panelGroup);

        const cardGeometry = new THREE.PlaneGeometry(2.45, 1.58, 1, 1);
        const labelGeometry = new THREE.PlaneGeometry(2.45, 0.42, 1, 1);
        roomPanels.forEach((panel, index) => {
            const texture = useSrgbTexture(panel.texture);
            const card = new THREE.Group();
            const angle = (index / roomPanels.length) * Math.PI * 2;
            const radius = 3.25;

            const imagePlane = new THREE.Mesh(
                cardGeometry,
                new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.96 })
            );
            imagePlane.position.z = 0.02;
            card.add(imagePlane);

            const label = new THREE.Mesh(
                labelGeometry,
                new THREE.MeshBasicMaterial({ map: makeLabelTexture(panel.label), transparent: true })
            );
            label.position.set(0, -0.98, 0.05);
            card.add(label);

            const frame = new THREE.Mesh(
                new THREE.BoxGeometry(2.58, 1.72, 0.045),
                new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    metalness: 0.08,
                    roughness: 0.38,
                    transparent: true,
                    opacity: 0.17
                })
            );
            frame.position.z = -0.04;
            card.add(frame);

            card.position.set(Math.cos(angle) * radius, Math.sin(angle) * 1.12, Math.sin(angle) * radius * 0.42);
            card.rotation.y = -angle + Math.PI / 2;
            card.rotation.x = Math.sin(angle) * 0.12;
            card.userData = { angle, radius };
            panelGroup.add(card);
        });

        const core = new THREE.Group();
        root.add(core);

        const cube = new THREE.Mesh(
            new THREE.BoxGeometry(1.55, 1.55, 1.55),
            new THREE.MeshStandardMaterial({
                color: 0x5f259f,
                metalness: 0.24,
                roughness: 0.28,
                emissive: 0x210638,
                emissiveIntensity: 0.25
            })
        );
        core.add(cube);

        const ring1 = new THREE.Mesh(
            new THREE.TorusGeometry(2.25, 0.015, 16, 128),
            new THREE.MeshBasicMaterial({ color: 0xffb81c, transparent: true, opacity: 0.72 })
        );
        ring1.rotation.x = Math.PI / 2.8;
        core.add(ring1);

        const ring2 = new THREE.Mesh(
            new THREE.TorusGeometry(3.55, 0.012, 16, 128),
            new THREE.MeshBasicMaterial({ color: 0x9f7aea, transparent: true, opacity: 0.42 })
        );
        ring2.rotation.x = Math.PI / 2;
        ring2.rotation.y = Math.PI / 8;
        core.add(ring2);

        const particles = new THREE.Group();
        root.add(particles);

        const particleGeometry = new THREE.SphereGeometry(0.035, 12, 12);
        const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.85 });
        for (let i = 0; i < 90; i += 1) {
            const p = new THREE.Mesh(particleGeometry, particleMaterial);
            p.position.set(
                (Math.random() - 0.5) * 13,
                (Math.random() - 0.5) * 7,
                (Math.random() - 0.5) * 7
            );
            p.userData.speed = 0.25 + Math.random() * 0.75;
            particles.add(p);
        }

        let mouseX = 0;
        let mouseY = 0;
        let scrollProgress = 0;
        let width = 0;
        let height = 0;

        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            root.scale.setScalar(width < 700 ? 0.72 : 1);
            root.position.x = width < 700 ? 0.7 : 1.65;
        };

        const updateScroll = () => {
            const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
            scrollProgress = clamp(window.scrollY / max, 0, 1);
        };

        window.addEventListener("resize", resize);
        window.addEventListener("scroll", updateScroll, { passive: true });
        window.addEventListener("pointermove", (event) => {
            mouseX = (event.clientX / window.innerWidth - 0.5) * 2;
            mouseY = (event.clientY / window.innerHeight - 0.5) * 2;
        }, { passive: true });

        resize();
        updateScroll();

        const clock = new THREE.Clock();

        const animate = () => {
            const time = clock.getElapsedTime();
            const targetRotY = scrollProgress * Math.PI * 2.2 + mouseX * 0.12;
            const targetRotX = -0.08 + mouseY * 0.05;

            root.rotation.y += (targetRotY - root.rotation.y) * 0.035;
            root.rotation.x += (targetRotX - root.rotation.x) * 0.04;
            root.position.x += ((width < 700 ? 0.7 : 1.65) - root.position.x) * 0.08;
            root.position.y = lerp(0.15, -1.1, scrollProgress);

            core.rotation.x = time * 0.18;
            core.rotation.y = time * 0.28;
            ring1.rotation.z = time * 0.24;
            ring2.rotation.z = -time * 0.16;
            panelGroup.rotation.y = time * 0.055;

            panelGroup.children.forEach((card, index) => {
                card.position.y += (Math.sin(time * 0.8 + index) * 0.008);
            });

            particles.children.forEach((p) => {
                p.position.y += Math.sin(time * p.userData.speed + p.position.x) * 0.0015;
            });

            camera.position.z = lerp(9, 6.6, Math.min(scrollProgress * 1.45, 1));
            camera.position.x += (mouseX * 0.22 - camera.position.x) * 0.03;
            camera.position.y += (0.65 - mouseY * 0.12 - camera.position.y) * 0.03;
            camera.lookAt(0, 0, 0);

            renderer.render(scene, camera);
            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }

    function makeLabelTexture(text) {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(8, 7, 11, 0.82)";
        roundRect(ctx, 0, 0, canvas.width, canvas.height, 28);
        ctx.fill();
        ctx.fillStyle = "#FFB81C";
        ctx.font = "700 24px Inter, sans-serif";
        ctx.fillText("ROOM POV", 28, 42);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "800 38px Inter, sans-serif";
        ctx.fillText(text, 28, 88);

        return useSrgbTexture(new window.THREE.CanvasTexture(canvas));
    }

    function roundRect(ctx, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + width, y, x + width, y + height, r);
        ctx.arcTo(x + width, y + height, x, y + height, r);
        ctx.arcTo(x, y + height, x, y, r);
        ctx.arcTo(x, y, x + width, y, r);
        ctx.closePath();
    }
})();
