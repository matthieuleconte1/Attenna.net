import { createRenderer } from "../fft-ocean/renderer";
import { createScrollMotion } from "../fft-ocean/scroll-motion";

const canvas = document.querySelector<HTMLCanvasElement>("#fft-ocean-background");

/**
 * Largeur sur laquelle la houle est projetée. Sur un écran en portrait, étaler les
 * colonnes sur la seule largeur visible tasserait points et vagues à l'horizontale :
 * la scène garde donc au moins les proportions d'un écran paysage, et ses bords
 * débordent simplement de l'écran.
 */
const MIN_SCENE_ASPECT = 1.5;

/**
 * Réglages du repli sur mobile. Une scène aussi large qu'en paysage n'y montrerait
 * que son centre, avec de gros points : elle est moins élargie, les points et la
 * houle sont plus fins, et le canvas suit la densité de l'écran pour rester net.
 */
const MOBILE_OCEAN = {
  sceneAspect: 1.1,
  pointScale: 0.68,
  amplitudeScale: 0.85,
  columnSpacing: 6.5,
  maxPixelRatio: 2,
};

const isCompactViewport = () => window.matchMedia("(max-width: 768px)").matches;

function sceneWidth(width: number, height: number, compact = false) {
  return Math.max(width, height * (compact ? MOBILE_OCEAN.sceneAspect : MIN_SCENE_ASPECT));
}

function startParticleFallback(sourceCanvas: HTMLCanvasElement): () => void {
  const fallbackCanvas = sourceCanvas.cloneNode(false) as HTMLCanvasElement;
  fallbackCanvas.dataset.renderer = "canvas-2d";
  fallbackCanvas.dataset.fpsCap = "30";
  sourceCanvas.replaceWith(fallbackCanvas);

  const context = fallbackCanvas.getContext("2d", { alpha: true });
  if (!context) return () => undefined;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollMotion = createScrollMotion();
  let animationFrame = 0;
  let pixelRatio = 1;
  let compact = false;
  let rows = 0;
  let columns = 0;
  let visibilityNoise = new Float32Array();
  let lastFrame = Number.NEGATIVE_INFINITY;
  let previousTimestamp = performance.now();
  let animationTime = 0;
  let loopToken = 0;
  // hasFocus() est faux juste après une restauration depuis le bfcache, alors
  // que la page est bien visible : seule la visibilité décide de l'état initial.
  const initiallyPaused = document.hidden;
  let playbackSpeed = initiallyPaused ? 0 : 1;
  let playbackTarget = playbackSpeed;
  const frameInterval = 1000 / 30;
  const bucketCount = 6;

  const resize = () => {
    compact = isCompactViewport();
    pixelRatio = Math.min(window.devicePixelRatio || 1, compact ? MOBILE_OCEAN.maxPixelRatio : 1);
    fallbackCanvas.width = Math.max(1, Math.round(window.innerWidth * pixelRatio));
    fallbackCanvas.height = Math.max(1, Math.round(window.innerHeight * pixelRatio));
    rows = Math.min(72, Math.max(44, Math.round(window.innerHeight / 13)));
    const spacing = compact ? MOBILE_OCEAN.columnSpacing : 12;
    columns = Math.min(160, Math.max(96, Math.round(sceneWidth(window.innerWidth, window.innerHeight, compact) / spacing)));
    visibilityNoise = new Float32Array(rows * columns);

    for (let index = 0; index < visibilityNoise.length; index++) {
      const random = Math.sin(index * 127.1 + Math.floor(index / columns) * 184.6) * 43758.5453;
      visibilityNoise[index] = random - Math.floor(random);
    }

    fallbackCanvas.dataset.points = String(rows * columns);
  };

  const draw = (timestamp: number) => {
    // Une boucle relancée après restauration rend la précédente caduque : le
    // jeton garantit qu'une seule survit, même si l'identifiant rAF gelé par le
    // bfcache n'a pas pu être annulé.
    const token = loopToken;
    const schedule = () => {
      if (token !== loopToken) return;
      animationFrame = window.requestAnimationFrame(draw);
    };

    if (!reducedMotion && timestamp - lastFrame < frameInterval) {
      schedule();
      return;
    }
    lastFrame = timestamp;

    const width = fallbackCanvas.width / pixelRatio;
    const height = fallbackCanvas.height / pixelRatio;
    const deltaTime = Math.min(100, Math.max(0, timestamp - previousTimestamp));
    previousTimestamp = timestamp;
    const easing = 1 - Math.exp(-deltaTime / 460);
    playbackSpeed += (playbackTarget - playbackSpeed) * easing;

    if (playbackTarget === 0 && playbackSpeed < 0.01) {
      playbackSpeed = 0;
      fallbackCanvas.dataset.animationState = "paused";
    } else if (playbackTarget === 1 && playbackSpeed > 0.99) {
      playbackSpeed = 1;
      fallbackCanvas.dataset.animationState = "running";
    }
    fallbackCanvas.dataset.playbackSpeed = playbackSpeed.toFixed(3);
    // Même réaction au défilement que le rendu WebGPU : la vitesse agite la houle et
    // incline la vue, la position dans la page fait avancer sur l'eau.
    const motion = scrollMotion.update(deltaTime * 0.001);
    const agitation = Math.abs(motion.velocity);
    animationTime += deltaTime * 0.001 * playbackSpeed * (1 + agitation * 1.6);
    const time = animationTime;
    const travel = motion.progress * 0.9;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = "lighter";

    const horizon = height * (0.48 - motion.velocity * 0.05);
    const centerX = width * 0.5;
    const spanX = sceneWidth(width, height, compact);
    const pointScale = compact ? MOBILE_OCEAN.pointScale : 1;
    const amplitudeScale = compact ? MOBILE_OCEAN.amplitudeScale : 1;
    const neutralPaths = Array.from({ length: bucketCount }, () => new Path2D());
    const orangePaths = Array.from({ length: bucketCount }, () => new Path2D());

    for (let row = 0; row < rows; row++) {
      const z = row / (rows - 1);
      const depth = z ** 1.62;
      const widthScale = 0.68 + depth * 0.9;
      const yBase = horizon + depth * (height - horizon) * 1.12;
      const pointSize = (3.2 + depth * 3.8) * pointScale;
      const middleLight = Math.exp(-(((z - 0.34) / 0.31) ** 2));
      const foregroundFade = 1 - Math.max(0, (z - 0.52) / 0.48) * 0.88;

      for (let column = 0; column < columns; column++) {
        const x = column / (columns - 1) * 2 - 1;
        const zt = z - travel;
        const phase1 = x * 4.2 + zt * 7.0 - time * 0.24;
        const phase2 = x * 9.7 - zt * 4.1 + time * 0.17;
        const phase3 = x * 18.2 + zt * 12.3 - time * 0.46;
        const phase4 = x * -6.3 + zt * 19.1 + time * 0.31;
        const s1 = Math.sin(phase1);
        const s2 = Math.sin(phase2);
        const s3 = Math.sin(phase3);
        const s4 = Math.sin(phase4);
        const rightBias = (x + 1) * 0.5;
        const ridge = (1 - Math.abs(s3)) ** 3 * (0.035 + rightBias * 0.085);
        const elevation = s1 * 0.46 + s2 * 0.23 + s3 * 0.1 + s4 * 0.06 + ridge;
        const curvature = Math.max(
          0,
          s1 * 22.5 + s2 * 3.9 + s3 * 15.1 + s4 * 21.9 + ridge * 32,
        );
        const crest = Math.min(1, curvature / 24);
        const noise = visibilityNoise[row * columns + column]!;
        const dropout = 0.03 + Math.max(0, z - 0.48) * 0.72;

        if (noise < dropout) continue;

        const projectedX =
          centerX +
          x * spanX * 0.8 * widthScale +
          Math.sin(z * 8.5 + time * 0.09) * depth * 12;
        const projectedY =
          yBase - elevation * (28 + depth * 90) * amplitudeScale * (1 + agitation * 0.45);
        const alpha = Math.min(
          0.82,
          (0.05 + middleLight * 0.4) *
            (0.32 + crest * 2 + Math.max(0, elevation) * 0.32) *
            foregroundFade *
            (0.78 + noise * 0.34),
        );

        if (alpha < 0.012) continue;

        const orangeAccent = crest > 0.85 && noise > 0.93 - agitation * 0.12;
        const bucket = Math.min(bucketCount - 1, Math.floor(alpha / 0.82 * bucketCount));
        const path = orangeAccent ? orangePaths[bucket]! : neutralPaths[bucket]!;
        path.rect(projectedX, projectedY, pointSize, pointSize);
      }
    }

    for (let bucket = 0; bucket < bucketCount; bucket++) {
      const alpha = 0.07 + bucket / (bucketCount - 1) * 0.75;
      context.fillStyle = `rgba(235, 240, 243, ${alpha})`;
      context.fill(neutralPaths[bucket]!);
      context.fillStyle = `rgba(255, 104, 18, ${alpha * 0.9})`;
      context.fill(orangePaths[bucket]!);
    }

    context.globalCompositeOperation = "source-over";
    if (!reducedMotion && (playbackTarget > 0 || playbackSpeed > 0)) {
      schedule();
    } else {
      animationFrame = 0;
    }
  };

  resize();
  fallbackCanvas.dataset.animationState = initiallyPaused ? "paused" : "running";
  fallbackCanvas.dataset.playbackSpeed = String(playbackSpeed);
  draw(performance.now());
  const handleResize = () => {
    resize();
    if (reducedMotion) draw(performance.now());
  };
  window.addEventListener("resize", handleResize);

  const setPlaybackPaused = (nextPaused: boolean) => {
    const nextTarget = nextPaused ? 0 : 1;
    if (nextTarget === playbackTarget) return;
    const now = performance.now();
    playbackTarget = nextTarget;
    fallbackCanvas.dataset.animationState = nextPaused ? "pausing" : "resuming";
    previousTimestamp = now;
    lastFrame = Number.NEGATIVE_INFINITY;
    if (!reducedMotion && !animationFrame) {
      animationFrame = window.requestAnimationFrame(draw);
    }
  };
  const handleBlur = () => setPlaybackPaused(true);
  const handleFocus = () => setPlaybackPaused(document.hidden);
  const handleVisibility = () => {
    setPlaybackPaused(document.hidden || !document.hasFocus());
  };

  // Un retour arrière restaure la page depuis le bfcache. Deux pièges s'y
  // cumulent : aucun évènement focus n'est émis après la restauration, et
  // document.hasFocus() est encore faux quand pageshow se déclenche. On se fie
  // donc à la seule visibilité, et on abandonne l'id d'animation gelé, périmé
  // mais non nul, qui empêcherait la boucle d'être replanifiée.
  const handlePageShow = () => {
    playbackTarget = document.hidden ? 0 : 1;
    previousTimestamp = performance.now();
    lastFrame = Number.NEGATIVE_INFINITY;

    if (playbackTarget === 1 && playbackSpeed < 1) {
      fallbackCanvas.dataset.animationState = "resuming";
    }

    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }

    // Invalide toute boucle survivante avant d'en planifier une nouvelle.
    loopToken++;

    if (!reducedMotion && (playbackTarget > 0 || playbackSpeed > 0)) {
      animationFrame = window.requestAnimationFrame(draw);
    }
  };

  window.addEventListener("blur", handleBlur);
  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("pageshow", handlePageShow);

  return () => {
    loopToken++;
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("blur", handleBlur);
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("pageshow", handlePageShow);
  };
}

if (canvas) {
  let stopped = false;
  let dispose: () => void = () => undefined;

  const start = () => {
    if (!navigator.gpu) {
      useFallback();
      return;
    }

    const renderer = createRenderer({ canvas });
    dispose = () => renderer.dispose();

    void renderer.ready.then(() => {
      canvas.dataset.renderer = "webgpu";
      document.documentElement.classList.add("webgpu-active");
    }).catch((error: unknown) => {
      console.warn("WebGPU indisponible, utilisation du fond Canvas 2D.", error);
      useFallback();
    });
  };

  const useFallback = () => {
    if (stopped) return;
    document.documentElement.classList.add("webgpu-fallback");
    dispose();
    dispose = startParticleFallback(canvas);
  };

  // Mode léger (page À propos) : le canvas reste vide et le CSS affiche une image
  // fixe de l'océan à sa place. Une bascule en cours de visite arrête le rendu et
  // remplace le canvas par un clone vierge, pour effacer la dernière image dessinée.
  const liteMode = () => document.documentElement.classList.contains("visuals-lite");

  if (liteMode()) {
    stopped = true;
    canvas.dataset.renderer = "image";
  } else {
    start();
    document.addEventListener("visuals:lite", () => {
      stopped = true;
      dispose();
      dispose = () => undefined;
      const current = document.querySelector<HTMLCanvasElement>("#fft-ocean-background");
      if (!current) return;
      const blank = current.cloneNode(false) as HTMLCanvasElement;
      blank.dataset.renderer = "image";
      current.replaceWith(blank);
    }, { once: true });
  }

  // pagehide sert deux cas distincts : un départ définitif, où le GPU doit être
  // libéré, et une mise en bfcache, où la page sera restaurée telle quelle. Dans
  // ce second cas détruire le rendu le ramènerait figé au retour arrière, donc
  // on le laisse intact et handlePageShow relance simplement sa boucle.
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    stopped = true;
    dispose();
    dispose = () => undefined;
  });
}
