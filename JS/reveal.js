// Révélation au défilement et halo des tuiles qui suit le pointeur.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (reduceMotion || !("IntersectionObserver" in window)) {
    // Sans animation : le contenu est déjà visible.
    document.documentElement.classList.remove("js-reveal");
} else {
    // Chaque élément n'est révélé qu'une fois, à son entrée dans l'écran.
    const revealObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) {
                continue;
            }

            const element = entry.target;
            element.classList.add("is-visible");
            revealObserver.unobserve(element);

            // Apparition finie : is-settled retire le décalage pour que le survol réagisse aussitôt.
            const settle = (event) => {
                if (event.target !== element || event.propertyName !== "transform") {
                    return;
                }

                element.classList.add("is-settled");
                element.removeEventListener("transitionend", settle);
            };
            element.addEventListener("transitionend", settle);
        }
    }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });

    document.querySelectorAll(".reveal").forEach((element) => {
        revealObserver.observe(element);
    });
}

// Le halo orange des tuiles suit le pointeur.
document.querySelectorAll(".feature-tile").forEach((tile) => {
    tile.addEventListener("pointermove", (event) => {
        const rect = tile.getBoundingClientRect();
        tile.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        tile.style.setProperty("--my", `${event.clientY - rect.top}px`);
    });
});
