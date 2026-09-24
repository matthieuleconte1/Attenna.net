/**
 * Suivi du défilement pour l'océan : position lissée dans la page et vitesse
 * amortie. Le rendu WebGPU et le repli Canvas 2D s'en servent pour déplacer la
 * caméra et agiter la houle ; sur une page sans défilement, tout reste à zéro.
 */
export interface ScrollMotion {
  /** Position lissée dans la page, de 0 (haut) à 1 (bas). */
  progress: number;
  /** Vitesse lissée et signée, de -1 à 1 ; positive quand on descend. */
  velocity: number;
}

/** Vitesse, en pixels par seconde, qui correspond à une agitation maximale. */
const FULL_SPEED = 2400;

export function createScrollMotion() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const state: ScrollMotion = { progress: 0, velocity: 0 };
  let lastScrollY = window.scrollY;
  let publishedRise = "";

  const readProgress = () => {
    const scrolling = document.scrollingElement ?? root;
    const distance = scrolling.scrollHeight - window.innerHeight;
    return distance > 1 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0;
  };

  // Sans animation, l'océan garde simplement le cadrage correspondant à la position de départ.
  state.progress = readProgress();

  /** Avance le suivi de `deltaTime` secondes et renvoie l'état courant. */
  const update = (deltaTime: number): ScrollMotion => {
    if (reducedMotion || deltaTime <= 0) return state;

    const scrollY = window.scrollY;
    let delta = scrollY - lastScrollY;
    lastScrollY = scrollY;
    // Un saut d'ancre ou un retour après une pause n'est pas un geste de défilement.
    if (Math.abs(delta) > window.innerHeight) delta = 0;

    const targetVelocity = Math.max(-1, Math.min(1, delta / deltaTime / FULL_SPEED));
    state.velocity += (targetVelocity - state.velocity) * (1 - Math.exp(-deltaTime * 6));
    state.progress += (readProgress() - state.progress) * (1 - Math.exp(-deltaTime * 3));

    // Exposé au CSS pour faire monter le canvas vers le bas de la page.
    const rise = state.progress.toFixed(3);
    if (rise !== publishedRise) {
      publishedRise = rise;
      root.style.setProperty("--ocean-rise", rise);
    }
    return state;
  };

  return { update };
}
