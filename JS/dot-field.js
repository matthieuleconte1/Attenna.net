// Trame de points réactive, dans l'esprit de l'océan de l'accueil : le pointeur l'éclaire
// et repousse les points, un clic y lance une onde. Le défilement anime l'océan, pas la trame.
const canvas = document.getElementById("dot-field");

if (canvas) {
    const context = canvas.getContext("2d", { alpha: true });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    // Mode léger : la trame est dessinée une fois, sans halo ni onde.
    let still = document.documentElement.classList.contains("visuals-lite");

    const spacing = 26;
    const radius = 210;
    const neutral = "rgb(235, 240, 243)";
    const orange = "rgb(255, 104, 18)";

    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, presence: 0, inside: false };
    const ripples = [];
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let previousTime = performance.now();
    let frame = 0;

    const resize = () => {
        pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
    };

    const draw = (time) => {
        frame = 0;
        const deltaTime = Math.min(64, time - previousTime);
        previousTime = time;
        const step = deltaTime / 16.67;

        // Pointeur amorti ; sa présence s'allume et s'éteint en fondu à l'entrée et à la sortie.
        const easing = 1 - Math.pow(1 - 0.2, step);
        pointer.x += (pointer.targetX - pointer.x) * easing;
        pointer.y += (pointer.targetY - pointer.y) * easing;
        const targetPresence = pointer.inside ? 1 : 0;
        pointer.presence += (targetPresence - pointer.presence) * (1 - Math.pow(1 - 0.08, step));

        for (const ripple of ripples) {
            ripple.radius += deltaTime * 0.9;
            ripple.strength = Math.max(0, 1 - ripple.radius / ripple.max);
        }
        while (ripples.length && ripples[0].strength <= 0) {
            ripples.shift();
        }

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, width, height);

        const offsetX = (width % spacing) / 2;
        const offsetY = (height % spacing) / 2;

        for (let y = offsetY; y < height; y += spacing) {
            for (let x = offsetX; x < width; x += spacing) {
                let alpha = 0.07;
                let size = 1.6;
                let heat = 0;
                let drawX = x;
                let drawY = y;

                if (pointer.presence > 0.01) {
                    const dx = x - pointer.x;
                    const dy = y - pointer.y;
                    const distance = Math.hypot(dx, dy);

                    if (distance < radius) {
                        const falloff = (1 - distance / radius) ** 2 * pointer.presence;
                        const push = falloff * 8 / Math.max(distance, 1);
                        drawX += dx * push;
                        drawY += dy * push;
                        alpha += falloff * 0.85;
                        size += falloff * 3.4;
                        heat = Math.max(0, 1 - distance / (radius * 0.5)) * pointer.presence;
                    }
                }

                for (const ripple of ripples) {
                    const band = 1 - Math.abs(Math.hypot(x - ripple.x, y - ripple.y) - ripple.radius) / 30;

                    if (band > 0) {
                        alpha += band * ripple.strength * 0.7;
                        size += band * ripple.strength * 2.2;
                        heat = Math.max(heat, band * ripple.strength);
                    }
                }

                context.globalAlpha = Math.min(0.95, alpha);
                context.fillStyle = heat > 0.35 ? orange : neutral;
                context.fillRect(drawX - size / 2, drawY - size / 2, size, size);
            }
        }

        context.globalAlpha = 1;

        // La boucle s'arrête dès que plus rien ne bouge ; la trame reste affichée, figée.
        const moving =
            Math.abs(targetPresence - pointer.presence) > 0.005 ||
            ripples.length > 0 ||
            Math.abs(pointer.targetX - pointer.x) > 0.3 ||
            Math.abs(pointer.targetY - pointer.y) > 0.3;

        if (moving && !reduceMotion && !still) {
            requestDraw();
        }
    };

    const requestDraw = () => {
        frame ||= window.requestAnimationFrame(draw);
    };

    resize();
    requestDraw();

    window.addEventListener("resize", () => {
        resize();
        requestDraw();
    });

    // Bascule en cours de visite : halo et ondes s'éteignent d'un coup, sur une trame au repos.
    document.addEventListener("visuals:lite", () => {
        still = true;
        pointer.inside = false;
        pointer.presence = 0;
        ripples.length = 0;
        requestDraw();
    }, { once: true });

    if (!reduceMotion) {
        if (finePointer) {
            window.addEventListener("pointermove", (event) => {
                if (still) return;
                // Premier mouvement : le halo apparaît sous le pointeur, sans traverser l'écran.
                if (pointer.presence < 0.01) {
                    pointer.x = event.clientX;
                    pointer.y = event.clientY;
                }
                pointer.targetX = event.clientX;
                pointer.targetY = event.clientY;
                // Au-dessus du récit, c'est son nuage de points qui réagit : la trame s'efface.
                pointer.inside = !event.target.closest?.(".story-visual, .story.is-ready .story-stage");
                requestDraw();
            }, { passive: true });

            document.documentElement.addEventListener("pointerleave", () => {
                pointer.inside = false;
                requestDraw();
            });

            // Fenêtre inactive : le halo s'éteint et la boucle s'arrête d'elle-même.
            window.addEventListener("blur", () => {
                pointer.inside = false;
                requestDraw();
            });
        }

        window.addEventListener("pointerdown", (event) => {
            if (still) return;
            ripples.push({
                x: event.clientX,
                y: event.clientY,
                radius: 0,
                strength: 1,
                max: Math.max(width, height) * 0.7,
            });
            requestDraw();
        }, { passive: true });
    }
}
