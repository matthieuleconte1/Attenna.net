// IIFE : toutes les variables de l'animation restent privées au script WireGuard.
(() => {
    const canvas = document.getElementById("wg-particle-field");

    if (!canvas) {
        return;
    }

    // Le canvas transparent se superpose aux autres calques du décor.
    const context = canvas.getContext("2d", { alpha: true });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const particles = [];
    const isCompactScreen = window.matchMedia("(max-width: 768px)");
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const targetFps = isCompactScreen.matches ? 24 : 30;
    const frameInterval = 1000 / targetFps;
    let frame = 0;
    let lastFrameTime = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;

    // Pseudo-aléatoire déterministe : le nuage conserve sa forme après chaque redimensionnement.
    function seededRandom(index) {
        const value = Math.sin(index * 127.1 + 311.7) * 43758.5453123;
        return value - Math.floor(value);
    }

    // Construit les paramètres d'un tore de particules et de leurs variations lumineuses.
    function buildParticles() {
        particles.length = 0;
        const particleCount = isCompactScreen.matches ? 900 : 1800;

        for (let index = 0; index < particleCount; index += 1) {
            const angle = seededRandom(index) * Math.PI * 2;
            const tubeAngle = seededRandom(index + 7000) * Math.PI * 2;
            const scatter = Math.pow(seededRandom(index + 14000), 2.1);

            particles.push({
                angle,
                tubeAngle,
                radiusNoise: (seededRandom(index + 21000) - 0.5) * 0.22,
                scatter,
                size: 0.7 + seededRandom(index + 28000) * 1.45,
                alpha: 0.32 + seededRandom(index + 35000) * 0.62,
                speed: 0.45 + seededRandom(index + 42000) * 1.3,
                hue: seededRandom(index + 49000)
            });
        }
    }

    // Aligne la définition interne du canvas sur sa taille CSS en limitant le coût Retina.
    function resizeCanvas() {
        const bounds = canvas.getBoundingClientRect();
        pixelRatio = 1;
        width = Math.max(1, Math.round(bounds.width));
        height = Math.max(1, Math.round(bounds.height));
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    // Applique les rotations 3D avant la projection en coordonnées 2D.
    function rotatePoint(x, y, z, rotationX, rotationY) {
        const cosY = Math.cos(rotationY);
        const sinY = Math.sin(rotationY);
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const cosX = Math.cos(rotationX);
        const sinX = Math.sin(rotationX);

        return {
            x: x1,
            y: y * cosX - z1 * sinX,
            z: y * sinX + z1 * cosX
        };
    }

    // Dessine une image, puis programme la suivante tant que la page est visible.
    function draw(time = 0) {
        frame = window.requestAnimationFrame(draw);

        if (time - lastFrameTime < frameInterval) {
            return;
        }

        lastFrameTime = time - ((time - lastFrameTime) % frameInterval);
        context.clearRect(0, 0, width, height);

        // Lissage du pointeur pour un mouvement de caméra souple.
        pointer.x += (pointer.targetX - pointer.x) * 0.035;
        pointer.y += (pointer.targetY - pointer.y) * 0.035;

        const seconds = time * 0.001;
        const scale = Math.min(width, height) * 0.37;
        const centerX = width * 0.5;
        const centerY = height * 0.49;
        const rotationX = -0.3 + pointer.y * 0.18 + Math.sin(seconds * 0.22) * 0.1;
        const rotationY = pointer.x * 0.22 + seconds * 0.12;
        const focalLength = 3.2;

        for (const particle of particles) {
            // L'accessibilité reduced-motion stoppe la dérive sans supprimer le visuel.
            const flow = reduceMotion.matches ? 0 : seconds * 0.075 * particle.speed;
            const majorAngle = particle.angle + flow;
            const minorAngle = particle.tubeAngle - flow * 1.7;
            const tubeRadius = 0.4 + particle.radiusNoise + particle.scatter * 0.16;
            const breathing = reduceMotion.matches ? 0 : Math.sin(seconds * 0.48 + particle.angle * 2) * 0.045;
            const ripple = Math.sin(majorAngle * 3 - seconds * 0.62) * 0.06
                + Math.sin(minorAngle * 2 + seconds * 0.34) * 0.025;
            const majorRadius = 0.94 + breathing + ripple;
            const rawX = (majorRadius + tubeRadius * Math.cos(minorAngle)) * Math.cos(majorAngle);
            const rawY = (majorRadius + tubeRadius * Math.cos(minorAngle)) * Math.sin(majorAngle);
            const rawZ = tubeRadius * Math.sin(minorAngle);
            const point = rotatePoint(rawX, rawY, rawZ, rotationX, rotationY);
            // Projection en perspective : les particules proches paraissent légèrement plus grandes.
            const perspective = focalLength / (focalLength + point.z + 0.55);
            const x = centerX + point.x * scale * perspective;
            const y = centerY + point.y * scale * perspective;

            if (x < -4 || x > width + 4 || y < -4 || y > height + 4) {
                continue;
            }

            // La profondeur module l'opacité ; les bords reçoivent une couleur néon ponctuelle.
            const depth = Math.max(0.28, Math.min(1, (point.z + 1.5) / 2.7));
            const edgeGlow = Math.max(0, Math.abs(point.x) - 0.64);
            let red = 218;
            let green = 221;
            let blue = 230;

            if (particle.hue > 0.91 && edgeGlow > 0.04) {
                if (point.x < 0) {
                    red = 255;
                    green = 58;
                    blue = 133;
                } else {
                    red = 74;
                    green = 222;
                    blue = 255;
                }
            }

            context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${particle.alpha * depth * (0.52 + edgeGlow)})`;
            context.fillRect(x, y, particle.size * perspective, particle.size * perspective);
        }

    }

    // Convertit le pointeur écran en coordonnées normalisées pour incliner l'animation.
    function handlePointer(event) {
        pointer.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
        pointer.targetY = (event.clientY / window.innerHeight - 0.5) * 2;
    }

    // Économise le processeur lorsque l'onglet n'est plus affiché.
    function handleVisibility() {
        window.cancelAnimationFrame(frame);

        if (!document.hidden) {
            frame = window.requestAnimationFrame(draw);
        }
    }

    // Initialise la scène puis branche les événements qui la maintiennent synchronisée.
    buildParticles();
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });
    if (!reduceMotion.matches) {
        window.addEventListener("pointermove", handlePointer, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibility);

    if (reduceMotion.matches) {
        draw(0);
        window.cancelAnimationFrame(frame);
    } else {
        frame = window.requestAnimationFrame(draw);
    }
})();
