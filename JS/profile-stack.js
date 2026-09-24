// Pile de compétences de la page profil : onglets verticaux, une couche par onglet.
// Clic, survol (pointeur fin) ou flèches du clavier choisissent la couche ; à son
// entrée dans l'écran, la pile s'assemble de la base vers le sommet.
const stack = document.querySelector(".stack");

if (stack) {
    const tabs = [...stack.querySelectorAll(".stack-layer")];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    const select = (tab, { focus = false } = {}) => {
        if (tab.getAttribute("aria-selected") === "true") return;

        for (const other of tabs) {
            const selected = other === tab;
            other.setAttribute("aria-selected", String(selected));
            other.tabIndex = selected ? 0 : -1;
            const panel = document.getElementById(other.getAttribute("aria-controls"));
            panel.hidden = !selected;
            if (selected) {
                panel.classList.remove("is-entering");
                void panel.offsetWidth; // Relance l'animation d'entrée à chaque changement.
                panel.classList.add("is-entering");
            }
        }
        if (focus) tab.focus();
    };

    for (const tab of tabs) {
        tab.addEventListener("click", () => select(tab));
        if (finePointer) {
            tab.addEventListener("pointerenter", () => select(tab));
        }
    }

    // Les couches sont empilées de haut en bas dans le DOM : ↑ monte vers les services.
    stack.querySelector(".stack-layers").addEventListener("keydown", (event) => {
        const index = tabs.indexOf(document.activeElement);
        if (index < 0) return;
        const moves = {
            ArrowUp: index - 1,
            ArrowLeft: index - 1,
            ArrowDown: index + 1,
            ArrowRight: index + 1,
            Home: 0,
            End: tabs.length - 1,
        };
        if (!(event.key in moves)) return;
        event.preventDefault();
        const next = (moves[event.key] + tabs.length) % tabs.length;
        select(tabs[next], { focus: true });
    });

    if (!reduceMotion && "IntersectionObserver" in window) {
        stack.classList.add("is-waiting");
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            stack.classList.replace("is-waiting", "is-built");
        }, { threshold: 0.35 });
        observer.observe(stack);
    }
}
