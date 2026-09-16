// Références de l'interface ; l'opérateur optionnel permet au script d'être chargé ailleurs.
const serviceMonitor = document.querySelector(".status-monitor");
const serviceMonitorButton = serviceMonitor?.querySelector(".status-trigger");
const serviceStatusLabel = document.querySelector("#service-status-label");

// Sources testées par le navigateur et identifiants associés aux lignes du panneau.
const monitoredServices = [
    { id: "pve", name: "PVE", url: "https://pve.attenna.net" },
    { id: "cloud", name: "Cloud", url: "https://cloud.attenna.net" },
    { id: "pve2", name: "Mini PVE", url: "https://pve2.attenna.net" },
    {
        id: "vault",
        name: "Vault",
        url: "https://vault.attenna.net/#/login",
        imageProbe: "https://vault.attenna.net/favicon.ico",
    },
    { id: "wireguard", name: "WireGuard", url: "https://wg.attenna.net" },
    { id: "home-assistant", name: "Home Assistant", url: "https://maison.attenna.net" },
];

// Cadence de rafraîchissement et délai maximal d'une sonde réseau, en millisecondes.
const checkInterval = 60_000;
const requestTimeout = 6_500;
let checkInProgress = false;

async function checkService(service) {
    // Vault nécessite un test d'image : sa page de connexion ne répond pas comme les autres.
    if (service.imageProbe) {
        return checkServiceWithImage(service);
    }

    // L'AbortController empêche une requête suspendue de bloquer l'état du panneau.
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), requestTimeout);

    try {
        // no-cors permet de savoir qu'une réponse est atteignable sans lire son contenu.
        await fetch(service.url, {
            method: "GET",
            mode: "no-cors",
            cache: "no-store",
            credentials: "omit",
            redirect: "follow",
            referrerPolicy: "no-referrer",
            signal: controller.signal,
        });

        return { ...service, online: true };
    } catch {
        return { ...service, online: false };
    } finally {
        window.clearTimeout(timeout);
    }
}

function checkServiceWithImage(service) {
    // Une image chargée avec succès constitue une sonde compatible avec Vault.
    return new Promise((resolve) => {
        const probe = new Image();
        let finished = false;

        // Termine une seule fois, quelle que soit la course entre chargement et délai dépassé.
        const finish = (online) => {
            if (finished) {
                return;
            }

            finished = true;
            window.clearTimeout(timeout);
            probe.onload = null;
            probe.onerror = null;
            resolve({ ...service, online });
        };

        const timeout = window.setTimeout(() => finish(false), requestTimeout);
        // Le paramètre horodaté évite qu'un favicon servi depuis le cache fausse le test.
        const separator = service.imageProbe.includes("?") ? "&" : "?";

        probe.onload = () => finish(true);
        probe.onerror = () => finish(false);
        probe.referrerPolicy = "no-referrer";
        probe.src = `${service.imageProbe}${separator}status-check=${Date.now()}`;
    });
}

function updateServiceRow(result) {
    // Associe le résultat à sa ligne grâce à l'attribut data-service-row du HTML.
    const row = document.querySelector(`[data-service-row="${result.id}"]`);

    if (!row) {
        return;
    }

    row.dataset.state = result.online ? "online" : "offline";
    const statusText = row.querySelector("strong");

    if (statusText) {
        statusText.textContent = result.online ? "En ligne" : "Injoignable";
    }
}

function updateOverallStatus(results) {
    // Synthétise les tests pour l'indicateur global et son libellé accessible.
    if (!serviceMonitor || !serviceStatusLabel || !serviceMonitorButton) {
        return;
    }

    const onlineCount = results.filter((result) => result.online).length;
    let state = "offline";
    let label = "Services injoignables";

    if (onlineCount === monitoredServices.length) {
        state = "online";
        label = "Services en ligne";
    } else if (onlineCount > 0) {
        state = "degraded";
        label = `${onlineCount} services sur ${monitoredServices.length} en ligne`;
    }

    // Le détail est disponible au survol et aux lecteurs d'écran via aria-label.
    const detail = results
        .map((result) => `${result.name} : ${result.online ? "en ligne" : "injoignable"}`)
        .join(" · ");

    serviceMonitor.dataset.state = state;
    serviceStatusLabel.textContent = label;
    serviceMonitorButton.setAttribute("aria-label", `${label}. ${detail}`);
    serviceMonitorButton.title = detail;
}

async function refreshServiceStatus() {
    // Évite deux vagues de sondes si l'intervalle et un événement navigateur se croisent.
    if (checkInProgress || !serviceMonitor) {
        return;
    }

    checkInProgress = true;
    serviceMonitor.dataset.state = "checking";

    // Hors ligne, inutile de lancer des requêtes : tous les services sont marqués injoignables.
    const results = navigator.onLine === false
        ? monitoredServices.map((service) => ({ ...service, online: false }))
        : await Promise.all(monitoredServices.map(checkService));

    results.forEach(updateServiceRow);
    updateOverallStatus(results);
    checkInProgress = false;
}

function closeStatusPanel() {
    // Centralise la fermeture pour les clics extérieurs et la touche Échap.
    if (!serviceMonitor || !serviceMonitorButton) {
        return;
    }

    serviceMonitor.classList.remove("is-open");
    serviceMonitorButton.setAttribute("aria-expanded", "false");
}

// Ouvre ou replie le détail sans naviguer vers un autre écran.
serviceMonitorButton?.addEventListener("click", () => {
    const isOpen = serviceMonitor.classList.toggle("is-open");
    serviceMonitorButton.setAttribute("aria-expanded", String(isOpen));
});

// Ferme le panneau quand le clic est extérieur.
document.addEventListener("click", (event) => {
    if (serviceMonitor && !serviceMonitor.contains(event.target)) {
        closeStatusPanel();
    }
});

// Fournit une fermeture clavier standard.
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeStatusPanel();
    }
});

// Actualise les données au retour sur l'onglet ou à la reconnexion réseau.
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        refreshServiceStatus();
    }
});

window.addEventListener("online", refreshServiceStatus);
// Lance immédiatement le premier contrôle puis conserve l'état à jour.
window.setInterval(refreshServiceStatus, checkInterval);
refreshServiceStatus();
