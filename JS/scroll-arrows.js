// Les deux contrôles sont facultatifs : le script reste réutilisable sur chaque page.
const scrollHint = document.querySelector(".scroll-hint");
const scrollTopLink = document.querySelector(".scroll-top-link");

function getScrollTop() {
    // Les différents navigateurs exposent parfois la position de défilement ailleurs.
    const scrollingElement = document.scrollingElement || document.documentElement;

    return Math.max(
        window.scrollY || 0,
        window.pageYOffset || 0,
        scrollingElement.scrollTop || 0,
        document.documentElement.scrollTop || 0,
        document.body.scrollTop || 0,
    );
}

function getScrollableDistance() {
    // Distance totale que l'utilisateur peut encore parcourir verticalement.
    const scrollingElement = document.scrollingElement || document.documentElement;

    return Math.max(
        0,
        scrollingElement.scrollHeight - window.innerHeight,
    );
}

function updateScrollArrows() {
    // Aucun rendu à gérer si la page ne contient pas les liens concernés.
    if (!scrollHint || !scrollTopLink) {
        return;
    }

    // Une petite marge évite d'afficher les contrôles pour quelques pixels résiduels.
    const hasScrollablePage = getScrollableDistance() > 20;
    const hasScrolled = getScrollTop() > 20;

    scrollHint.classList.toggle("is-hidden", !hasScrollablePage || hasScrolled);
    scrollTopLink.classList.toggle("is-hidden", !hasScrolled);
}

function requestScrollArrowUpdate() {
    // Regroupe les mises à jour de scroll sur la prochaine image affichée.
    window.requestAnimationFrame(updateScrollArrows);
}

// Garde l'état juste lors du scroll, du redimensionnement et du retour dans l'historique.
window.addEventListener("scroll", requestScrollArrowUpdate, { passive: true });
window.addEventListener("resize", updateScrollArrows);
window.addEventListener("load", updateScrollArrows);
window.addEventListener("pageshow", updateScrollArrows);
updateScrollArrows();
