// Mode léger de la page À propos : pour les GPU modestes, l'océan WebGPU et le nuage de
// points animé cèdent la place à des images fixes tirées du même rendu.
//
// Le script en tête de page pose déjà la classe visuals-lite d'après le choix mémorisé,
// ?lite=1 / ?lite=0 et quelques indices matériels. Ce module complète :
//   - une mesure de fluidité au chargement, qui bascule en mode léger si la page peine ;
//   - un adaptateur WebGPU logiciel (sans vrai GPU), qui y bascule aussi.
// La bascule en cours de visite émet « visuals:lite » : l'océan, la trame et le récit
// arrêtent alors leurs boucles d'eux-mêmes.
const STORAGE_KEY = "attenna-visuals";
const MIN_FPS = 28;

const root = document.documentElement;
const isLite = () => root.classList.contains("visuals-lite");

function readChoice() {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

function saveChoice(value) {
    try {
        localStorage.setItem(STORAGE_KEY, value);
    } catch {
        // Stockage bloqué (navigation privée) : le choix vaut pour cette visite seulement.
    }
}

function enableLite(choice) {
    saveChoice(choice);
    if (isLite()) return;
    root.classList.add("visuals-lite");
    root.dataset.visuals = choice;
    document.dispatchEvent(new CustomEvent("visuals:lite"));
}

/**
 * Compte les images affichées pendant trois secondes, une fois le démarrage passé.
 * La mesure est abandonnée si la fenêtre perd le focus : le navigateur ralentit
 * alors lui-même les animations et fausserait le résultat.
 */
function measureSmoothness() {
    const duration = 3000;
    let start = 0;
    let frames = 0;

    const tick = (now) => {
        if (isLite() || document.hidden || !document.hasFocus()) return;
        if (!start) start = now;
        frames++;
        const elapsed = now - start;
        if (elapsed < duration) {
            requestAnimationFrame(tick);
        } else if ((frames - 1) / (elapsed / 1000) < MIN_FPS) {
            enableLite("lite-auto");
        }
    };

    const begin = () => setTimeout(() => requestAnimationFrame(tick), 1200);
    if (document.readyState === "complete") begin();
    else window.addEventListener("load", begin, { once: true });
}

/** Un adaptateur de repli signale un rendu logiciel : l'océan y serait saccadé. */
async function checkAdapter() {
    if (!navigator.gpu) return;
    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter?.info?.isFallbackAdapter || adapter?.isFallbackAdapter) {
            enableLite("lite-auto");
        }
    } catch {
        // Sans réponse de l'adaptateur, la mesure de fluidité tranchera.
    }
}

// Un mode complet forcé par ?lite=0 n'est pas remis en cause par la détection.
if (!isLite() && readChoice() !== "full") {
    checkAdapter();
    measureSmoothness();
}
