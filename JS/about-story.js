// Récit au défilement de la page À propos : un nuage de points, cousin de l'océan de
// l'accueil, se métamorphose d'une étape à l'autre (Proxmox, cloud, cadenas, houle).
// Le défilement pilote la forme, le pointeur repousse les points, et anime.js anime
// la typographie de chaque étape.
import { animate, scrambleText, splitText, stagger, utils } from "animejs";

const story = document.querySelector(".story");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Sans animation, les étapes restent empilées dans le flux normal de la page.
if (story && !reduceMotion) {
    startStory(story);
}
if (!reduceMotion) {
    introduceHero();
}

/** Accroche : lettres du titre et mots du sous-titre qui montent depuis un masque. */
function introduceHero() {
    const title = document.querySelector(".page-hero h1");
    const subtitle = document.querySelector(".page-hero .page-subtitle");

    if (title) {
        const { chars } = splitText(title, { words: true, chars: { wrap: "clip" } });
        animate(chars, { y: ["105%", "0%"], duration: 1100, delay: stagger(45), ease: "outExpo" });
    }

    if (subtitle) {
        const { words } = splitText(subtitle, { words: { wrap: "clip" } });
        animate(words, { y: ["110%", "0%"], duration: 1000, delay: stagger(70, { start: 350 }), ease: "outExpo" });
    }
}

function startStory(story) {
    const canvas = story.querySelector(".story-canvas");
    const context = canvas.getContext("2d", { alpha: true });
    const steps = [...story.querySelectorAll(".story-step")];
    const bars = [...story.querySelectorAll(".story-progress i")];
    const counter = story.querySelector(".story-count");
    // Mode léger : une image fixe par étape remplace le nuage de points, sans boucle d'animation.
    const images = [...story.querySelectorAll(".story-image")];
    let lite = document.documentElement.classList.contains("visuals-lite");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const compact = window.matchMedia("(max-width: 768px)").matches;

    const count = compact ? 900 : 1600;
    const dotSize = compact ? 2.2 : 2.6;
    const TAU = Math.PI * 2;

    story.classList.add("is-ready");
    story.classList.toggle("is-lite", lite);

    // Valeurs pseudo-aléatoires fixes par point : même chorégraphie à chaque visite.
    const random = seededRandom(20260924);
    const r1 = Float32Array.from({ length: count }, random);
    const r2 = Float32Array.from({ length: count }, random);
    const r3 = Float32Array.from({ length: count }, random);
    const r4 = Float32Array.from({ length: count }, random);
    const r5 = Float32Array.from({ length: count }, random);

    // Positions affichées (suivent leur cible avec inertie) et formes échantillonnées.
    const positionX = new Float32Array(count);
    const positionY = new Float32Array(count);
    const accentFlags = new Float32Array(count);
    const sizes = new Float32Array(count);
    let shapes = [];
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    const pointer = { x: -9999, y: -9999, presence: 0, inside: false };
    let targetProgress = 0;
    let progress = 0;
    let time = 0;
    let previousTime = performance.now();
    let frame = 0;
    let visible = false;
    let activeStep = -1;

    // Lecture ralentie jusqu'à l'arrêt quand la fenêtre perd le focus, comme l'océan.
    // hasFocus() est faux juste après une restauration depuis le bfcache : seule la
    // visibilité décide de l'état initial.
    let playbackSpeed = document.hidden ? 0 : 1;
    let playbackTarget = playbackSpeed;

    // Texte de chaque étape découpé une fois : lettres du titre, mots du paragraphe.
    const parts = steps.map((step) => ({
        eyebrow: step.querySelector(".eyebrow"),
        chars: splitText(step.querySelector("h2"), { words: true, chars: { wrap: "clip" } }).chars,
        words: [...step.querySelectorAll(".story-body")].flatMap((body) => splitText(body, { words: true }).words),
        link: step.querySelector(".text-link"),
    }));

    parts.forEach((part) => {
        utils.set(part.chars, { y: "110%" });
        utils.set(part.words, { opacity: 0 });
        if (part.link) utils.set(part.link, { opacity: 0 });
        if (part.eyebrow) utils.set(part.eyebrow, { opacity: 0 });
    });

    const resize = () => {
        const rect = canvas.getBoundingClientRect();
        width = Math.max(1, Math.round(rect.width));
        height = Math.max(1, Math.round(rect.height));
        pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);

        shapes = [
            scatterShape(),
            sampleShape(paintProxmox),
            sampleShape(paintCloud),
            sampleShape(paintLock),
            null, // La houle finale est calculée à chaque image.
        ];

        if (!positionX.some(Boolean)) {
            const scatter = shapes[0];
            for (let i = 0; i < count; i++) {
                positionX[i] = scatter[i * 3];
                positionY[i] = scatter[i * 3 + 1];
            }
        }
    };

    function scatterShape() {
        const points = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            points[i * 3] = r4[i] * width;
            points[i * 3 + 1] = r5[i] * height;
        }
        return points;
    }

    /**
     * Dessine une forme hors écran puis la relève sur une grille régulière : la forme
     * devient une trame de points. Le rouge marque les zones à teinter en orange.
     */
    function sampleShape(paint) {
        const offscreen = document.createElement("canvas");
        offscreen.width = width;
        offscreen.height = height;
        const painter = offscreen.getContext("2d", { willReadFrequently: true });
        paint(painter);
        const { data } = painter.getImageData(0, 0, width, height);

        let filled = 0;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 127) filled++;
        }

        const gap = Math.max(2, Math.sqrt(filled / count));
        const candidates = [];
        for (let y = gap / 2; y < height; y += gap) {
            for (let x = gap / 2; x < width; x += gap) {
                const index = (Math.floor(y) * width + Math.floor(x)) * 4;
                if (data[index + 3] > 127) {
                    candidates.push(x, y, data[index + 1] < 128 ? 1 : 0);
                }
            }
        }

        const available = Math.max(1, candidates.length / 3);
        const order = Array.from({ length: available }, (_, index) => index);
        const shuffle = seededRandom(available);
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(shuffle() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }

        const points = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const source = order[i % available] * 3;
            points[i * 3] = candidates[source] ?? width / 2;
            points[i * 3 + 1] = candidates[source + 1] ?? height / 2;
            points[i * 3 + 2] = candidates[source + 2] ?? 0;
        }
        return points;
    }

    // Place un tracé exprimé dans ses propres unités au centre du canvas.
    function fitPath(painter, [x, y, boxWidth, boxHeight], fill = 0.62) {
        const size = Math.min(width, height) * fill;
        const scale = size / Math.max(boxWidth, boxHeight);
        painter.setTransform(
            scale, 0, 0, scale,
            width / 2 - (x + boxWidth / 2) * scale,
            height / 2 - (y + boxHeight / 2) * scale,
        );
    }

    // Pictogramme PVE des boutons de l'accueil : un chevron orange, l'autre blanc.
    function paintProxmox(painter) {
        fitPath(painter, [4, 4, 56, 40], 0.7);
        painter.fillStyle = "#ff0000";
        painter.fill(new Path2D("M4 4h11l17 20-17 20H4l17-20z"));
        painter.fillStyle = "#ffffff";
        painter.fill(new Path2D("M60 4H49L32 24l17 20h11L43 24z"));
    }

    // Nuage plein, bordé d'un liseré orange.
    function paintCloud(painter) {
        const cloud = new Path2D("M7.2 18.5h10.2a4.1 4.1 0 0 0 .5-8.2A6 6 0 0 0 6.5 9a4.8 4.8 0 0 0 .7 9.5Z");
        fitPath(painter, [2, 3.4, 20, 15.3], 0.7);
        painter.fillStyle = "#ffffff";
        painter.fill(cloud);
        painter.strokeStyle = "#ff0000";
        painter.lineWidth = 1.1;
        painter.stroke(cloud);
    }

    // Cadenas : anse orange, corps blanc percé d'une serrure.
    function paintLock(painter) {
        fitPath(painter, [4, 2.5, 16, 19.5], 0.62);
        painter.strokeStyle = "#ff0000";
        painter.lineWidth = 2.4;
        painter.lineCap = "round";
        painter.stroke(new Path2D("M8 11.5V8a4 4 0 0 1 8 0v3.5"));
        painter.fillStyle = "#ffffff";
        painter.beginPath();
        painter.roundRect(5, 11, 14, 10, 2.5);
        painter.fill();
        painter.globalCompositeOperation = "destination-out";
        painter.beginPath();
        painter.arc(12, 15.2, 1.5, 0, TAU);
        painter.rect(11.35, 15.2, 1.3, 3);
        painter.fill();
        painter.globalCompositeOperation = "source-over";
    }

    // Finale : les points se couchent en une houle en perspective, comme l'océan du fond.
    const waveColumns = Math.ceil(Math.sqrt(count * 3.2));
    const waveRows = Math.ceil(count / waveColumns);

    function waveTarget(i, out) {
        const column = i % waveColumns;
        const row = Math.floor(i / waveColumns);
        const depth = row / Math.max(1, waveRows - 1);
        const spread = 0.62 + depth * 0.5;
        const elevation =
            Math.sin(column * 0.24 + depth * 6 - time * 1.4) * 0.55 +
            Math.sin(column * 0.08 - depth * 3.5 + time * 0.9) * 0.45;
        out.x = width / 2 + (column / (waveColumns - 1) - 0.5) * width * spread;
        out.y = height * 0.32 + depth ** 1.7 * height * 0.5 - elevation * (3 + depth * 26);
        out.accent = elevation > 0.72 && depth > 0.2 ? 1 : 0;
        // Bords et lointain estompés : une nappe d'océan plutôt qu'un plan découpé.
        const across = column / (waveColumns - 1);
        const edge = Math.sin(across * Math.PI) ** 0.8;
        const distance = 0.35 + 0.65 * Math.min(1, depth / 0.3);
        out.size = (0.45 + depth * 0.7) * edge * distance;
    }

    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    const smoothstep = (edge0, edge1, value) => {
        const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    };

    const from = { x: 0, y: 0, accent: 0, size: 1 };
    const to = { x: 0, y: 0, accent: 0, size: 1 };

    function pointOf(shapeIndex, i, out) {
        const shape = shapes[shapeIndex];
        if (!shape) {
            waveTarget(i, out);
            return;
        }
        out.x = shape[i * 3];
        out.y = shape[i * 3 + 1];
        out.accent = shape[i * 3 + 2];
        out.size = 1;
    }

    function draw(now) {
        frame = 0;
        if (lite) return;
        const deltaTime = Math.min(64, now - previousTime);
        previousTime = now;
        const step = deltaTime / 16.67;
        playbackSpeed += (playbackTarget - playbackSpeed) * (1 - Math.exp(-deltaTime / 460));
        if (playbackTarget === 0 && playbackSpeed < 0.01) playbackSpeed = 0;
        time += (deltaTime / 1000) * playbackSpeed;

        progress += (targetProgress - progress) * (1 - Math.pow(1 - 0.1, step));
        pointer.presence += ((pointer.inside ? 1 : 0) - pointer.presence) * (1 - Math.pow(1 - 0.1, step));

        // Segment courant : la forme tient un moment, puis se métamorphose en la suivante.
        const segment = Math.min(3, Math.floor(progress));
        const local = progress - segment;
        const morph = segment === 0 ? easeInOut(local) : smoothstep(0.3, 0.95, local);
        const follow = 1 - Math.pow(1 - 0.16, step);
        const dim = segment === 0 ? 0.3 + 0.7 * local : 1;

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, width, height);

        for (let i = 0; i < count; i++) {
            pointOf(segment, i, from);
            pointOf(segment + 1, i, to);

            // Départs échelonnés : chaque point quitte la forme à son propre moment.
            const own = Math.min(1, Math.max(0, morph * 1.4 - r3[i] * 0.4));
            const eased = easeInOut(own);
            const arc = Math.sin(own * Math.PI);
            const angle = r1[i] * TAU + eased * 2.4;
            const swirl = arc * (30 + r2[i] * 120);

            let x = from.x + (to.x - from.x) * eased + Math.cos(angle) * swirl;
            let y = from.y + (to.y - from.y) * eased + Math.sin(angle) * swirl;
            x += Math.sin(time * 1.1 + r1[i] * TAU) * 0.9;
            y += Math.cos(time * 0.9 + r2[i] * TAU) * 0.9;

            let heat = r2[i] > 0.6 ? arc : 0;

            if (pointer.presence > 0.01) {
                const dx = x - pointer.x;
                const dy = y - pointer.y;
                const distance = Math.hypot(dx, dy);
                const radius = 110;
                if (distance < radius) {
                    const force = (1 - distance / radius) ** 2 * pointer.presence;
                    x += (dx / Math.max(distance, 1)) * force * 48;
                    y += (dy / Math.max(distance, 1)) * force * 48;
                    heat = Math.max(heat, force * 1.6);
                }
            }

            positionX[i] += (x - positionX[i]) * follow;
            positionY[i] += (y - positionY[i]) * follow;
            accentFlags[i] = Math.max(from.accent + (to.accent - from.accent) * eased, heat);
            sizes[i] = dotSize * (from.size + (to.size - from.size) * eased);
        }

        // Deux passes de couleur : le blanc de la houle, puis l'orange des crêtes.
        context.globalAlpha = 0.88 * dim;
        context.fillStyle = "rgb(235, 240, 243)";
        for (let i = 0; i < count; i++) {
            if (accentFlags[i] < 0.5) {
                context.fillRect(positionX[i] - sizes[i] / 2, positionY[i] - sizes[i] / 2, sizes[i], sizes[i]);
            }
        }
        context.globalAlpha = dim;
        context.fillStyle = "rgb(255, 104, 18)";
        for (let i = 0; i < count; i++) {
            if (accentFlags[i] >= 0.5) {
                context.fillRect(positionX[i] - sizes[i] / 2, positionY[i] - sizes[i] / 2, sizes[i], sizes[i]);
            }
        }
        context.globalAlpha = 1;

        updateText();

        // La boucle s'arrête hors de l'écran, ou une fois la lecture complètement ralentie.
        if (visible && playbackSpeed > 0) {
            frame = window.requestAnimationFrame(draw);
        }
    }

    // Étape affichée et barres de progression, d'après la position lissée.
    function updateText() {
        const next = Math.min(3, Math.max(0, Math.floor(progress - 0.65)));
        if (next !== activeStep) {
            showStep(next, activeStep);
            activeStep = next;
        }

        bars.forEach((bar, index) => {
            const span = index === bars.length - 1 ? 0.35 : 1;
            const fill = Math.min(1, Math.max(0, (progress - index - 0.65) / span));
            bar.style.setProperty("--fill", (index === 0 ? Math.max(fill, 0.08) : fill).toFixed(3));
        });
    }

    // Animations en cours par étape : une entrée aux délais échelonnés finirait sinon
    // après la sortie qui l'interrompt, et ferait réapparaître le texte d'une étape
    // quittée en passant vite de l'une à l'autre.
    const running = parts.map(() => []);
    const play = (index, targets, params) => running[index].push(animate(targets, params));
    const interrupt = (index) => {
        running[index].forEach((animation) => animation.cancel());
        running[index] = [];
    };

    function showStep(next, previous) {
        const outgoing = parts[previous];
        const incoming = parts[next];

        if (outgoing) {
            interrupt(previous);
            steps[previous].classList.remove("is-active");
            play(previous, outgoing.chars, { y: "-110%", duration: 420, delay: stagger(6), ease: "inQuad" });
            play(previous, [...outgoing.words, outgoing.link, outgoing.eyebrow].filter(Boolean), {
                opacity: 0,
                duration: 280,
                ease: "outQuad",
            });
        }

        steps[next].classList.add("is-active");
        images.forEach((image, index) => image.classList.toggle("is-active", index === next));
        interrupt(next);
        play(next, incoming.chars, {
            y: ["110%", "0%"],
            duration: 900,
            delay: stagger(14, { start: 160 }),
            ease: "outExpo",
        });
        play(next, incoming.words, {
            opacity: [0, 1],
            y: [12, 0],
            filter: ["blur(6px)", "blur(0px)"],
            duration: 700,
            delay: stagger(9, { start: 320 }),
            ease: "outQuart",
        });
        if (incoming.link) {
            play(next, incoming.link, { opacity: [0, 1], y: [10, 0], duration: 600, delay: 600, ease: "outQuart" });
        }
        if (incoming.eyebrow) {
            utils.set(incoming.eyebrow, { opacity: 1 });
            play(next, incoming.eyebrow, {
                textContent: scrambleText({ chars: "A-Z", seed: next + 1 }),
                duration: 700,
            });
        }
        if (counter) {
            animate(counter, {
                textContent: scrambleText({ text: String(next + 1).padStart(2, "0"), chars: "0-9", seed: next + 7 }),
                duration: 500,
            });
        }
    }

    // Progression : 0 → 1 pendant l'arrivée de la section, puis 1 → 4 pendant qu'elle est épinglée.
    function readProgress() {
        const rect = story.getBoundingClientRect();
        const viewport = window.innerHeight;
        if (rect.top > 0) {
            targetProgress = Math.min(1, Math.max(0, 1 - rect.top / viewport));
        } else {
            const pinned = Math.max(1, rect.height - viewport);
            targetProgress = 1 + Math.min(1, -rect.top / pinned) * 3;
        }
    }

    const start = () => {
        if (!lite && !frame && visible && playbackTarget > 0) {
            previousTime = performance.now();
            frame = window.requestAnimationFrame(draw);
        }
    };

    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
    }, { rootMargin: "20% 0px" }).observe(story);

    // En mode léger, le défilement place directement l'étape : aucune inertie à simuler.
    const followScroll = () => {
        readProgress();
        if (lite) {
            progress = targetProgress;
            updateText();
        }
    };
    window.addEventListener("scroll", followScroll, { passive: true });

    document.addEventListener("visuals:lite", () => {
        lite = true;
        story.classList.add("is-lite");
        cancelAnimationFrame(frame);
        frame = 0;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        followScroll();
    }, { once: true });

    const setPaused = (paused) => {
        playbackTarget = paused ? 0 : 1;
        if (!paused) start();
    };
    window.addEventListener("blur", () => setPaused(true));
    window.addEventListener("focus", () => setPaused(document.hidden));
    document.addEventListener("visibilitychange", () => setPaused(document.hidden || !document.hasFocus()));
    // Retour arrière : aucun focus n'est émis et l'identifiant rAF gelé est périmé ;
    // on repart de la visibilité seule, avec une nouvelle boucle.
    window.addEventListener("pageshow", (event) => {
        if (!event.persisted) return;
        cancelAnimationFrame(frame);
        frame = 0;
        setPaused(document.hidden);
    });

    let resizeFrame = 0;
    window.addEventListener("resize", () => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
            if (!lite) resize();
            followScroll();
        });
    });

    if (finePointer) {
        window.addEventListener("pointermove", (event) => {
            const rect = canvas.getBoundingClientRect();
            pointer.x = event.clientX - rect.left;
            pointer.y = event.clientY - rect.top;
            pointer.inside =
                pointer.x > -40 && pointer.y > -40 && pointer.x < rect.width + 40 && pointer.y < rect.height + 40;
        }, { passive: true });
        document.documentElement.addEventListener("pointerleave", () => {
            pointer.inside = false;
        });
    }

    if (!lite) resize();
    readProgress();
    progress = targetProgress;
    updateText();
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
