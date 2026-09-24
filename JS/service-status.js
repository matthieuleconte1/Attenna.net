// Moniteur de services de l'accueil : sonde chaque service depuis le navigateur, mesure
// sa latence, garde un court historique et met à jour la pastille et le panneau.
import { animate, createTimeline, createTimer } from "animejs";

const serviceMonitor = document.querySelector(".status-monitor");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Battement d'état (repère SVG 60 × 24) : un point par service, dans l'ordre de la liste.
// Ligne de base, onde P, pic R, creux S, onde T, retour à la base.
const pulseShape = {
    xs: [5, 15, 25, 35, 45, 55],
    beat: [12, 8, 2, 22, 8, 12],
    baseline: 12,
    // Carrés pleins pendant le premier contrôle, puis points fins une fois en place.
    waitingSize: 6,
    placedSize: 3.6,
};

// Sources testées par le navigateur ; host est le domaine affiché sous chaque nom.
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
].map((service) => ({ ...service, host: new URL(service.url).host }));

// Cadence de rafraîchissement et délai maximal d'une sonde réseau, en millisecondes.
const checkInterval = 60_000;
const requestTimeout = 6_500;
const historyLength = 12;
const historyKey = "attenna-status-history";

if (serviceMonitor) {
    startMonitor(serviceMonitor);
}

function startMonitor(monitor) {
    const trigger = monitor.querySelector(".status-trigger");
    const panel = monitor.querySelector(".service-status-panel");
    const label = monitor.querySelector("#service-status-label");
    const list = monitor.querySelector(".status-list");
    const count = monitor.querySelector(".status-count");
    const size = monitor.querySelector(".status-size");
    const summary = monitor.querySelector(".status-summary");
    const updated = monitor.querySelector(".status-updated");
    const refresh = monitor.querySelector(".status-refresh");

    // Celui de la pastille n'est que passager : il accompagne le premier contrôle puis se replie.
    const pulses = [...monitor.querySelectorAll(".status-pulse")].map((element) =>
        createPulse(element, { sweep: !element.closest(".status-trigger") }));

    // Un seul minuteur redessine les battements (ondulation pendant le premier contrôle).
    if (!reduceMotion) {
        createTimer({ onUpdate: () => pulses.forEach((pulse) => pulse.render()) });
    }

    const history = loadHistory();
    const rows = new Map();
    let checkInProgress = false;
    let lastChecked = 0;
    let updatedTimer = 0;

    // Lignes construites une fois : lien vers le service, point, nom, historique, latence.
    monitoredServices.forEach((service, index) => {
        const row = document.createElement("li");
        row.style.setProperty("--i", String(index));
        row.dataset.state = "checking";
        row.innerHTML = `
            <a href="${service.url}" target="_blank" rel="noopener noreferrer">
                <span class="status-row-dot" aria-hidden="true"></span>
                <span class="status-name"><strong></strong><span></span></span>
                <span class="status-history" aria-hidden="true"></span>
                <span class="status-latency">…</span>
            </a>`;
        row.querySelector("strong").textContent = service.name;
        row.querySelector(".status-name span").textContent = service.host;
        list.append(row);

        const bars = row.querySelector(".status-history");
        rows.set(service.id, { row, index, bars, latency: row.querySelector(".status-latency") });
        renderHistory(service.id);
    });

    size.textContent = String(monitoredServices.length);
    monitor.hidden = false;

    function renderHistory(id) {
        const { bars } = rows.get(id);
        const entries = history[id] ?? [];
        const padding = Array(Math.max(0, historyLength - entries.length)).fill(null);
        bars.replaceChildren(...[...padding, ...entries.slice(-historyLength)].map((entry) => {
            const bar = document.createElement("i");
            if (entry !== null) bar.dataset.state = entry ? "online" : "offline";
            return bar;
        }));
    }

    // Chaque service s'affiche dès que sa sonde répond, sans attendre les autres.
    function showResult(result) {
        const { row, index, latency } = rows.get(result.id);
        const state = result.online ? "online" : "offline";
        row.dataset.state = state;
        pulses.forEach((pulse) => pulse.setService(index, state));
        latency.textContent = result.online ? `${result.latency} ms` : "—";
        row.querySelector("a").title = result.online
            ? `${result.name} répond en ${result.latency} ms`
            : `${result.name} est injoignable`;

        history[result.id] = [...(history[result.id] ?? []), result.online ? 1 : 0].slice(-historyLength);
        renderHistory(result.id);
    }

    function showOverall(results) {
        const onlineCount = results.filter((result) => result.online).length;
        const total = monitoredServices.length;
        let state = "offline";
        let text = "Services injoignables";

        if (onlineCount === total) {
            state = "online";
            text = "Tous les services répondent";
        } else if (onlineCount > 0) {
            state = "degraded";
            text = `${total - onlineCount} service${total - onlineCount > 1 ? "s" : ""} injoignable${total - onlineCount > 1 ? "s" : ""}`;
        }

        const detail = results
            .map((result) => `${result.name} : ${result.online ? `en ligne, ${result.latency} ms` : "injoignable"}`)
            .join(" · ");

        monitor.dataset.state = state;
        pulses.forEach((pulse) => pulse.setOverall(state));
        count.textContent = String(onlineCount);
        summary.textContent = text;
        label.textContent = `${onlineCount}/${total} en ligne`;
        trigger.setAttribute("aria-label", `${onlineCount} services sur ${total} en ligne. ${detail}`);
    }

    function showUpdated() {
        if (!lastChecked) return;
        const seconds = Math.round((Date.now() - lastChecked) / 1000);
        updated.textContent = seconds < 5
            ? "Vérifié à l'instant"
            : seconds < 60
                ? `Vérifié il y a ${seconds} s`
                : `Vérifié il y a ${Math.floor(seconds / 60)} min`;
    }

    async function refreshServiceStatus() {
        // Évite deux vagues de sondes si l'intervalle et un événement navigateur se croisent.
        if (checkInProgress) return;
        checkInProgress = true;
        monitor.classList.add("is-checking");
        // Au premier passage seulement, tout passe en « vérification » ; ensuite le battement
        // et les lignes gardent leur état, seule l'icône de rafraîchissement tourne.
        if (!lastChecked) {
            monitor.dataset.state = "checking";
            rows.forEach(({ row }) => {
                row.dataset.state = "checking";
            });
        }

        const offline = navigator.onLine === false;
        const firstCheck = !lastChecked;
        const startedAt = performance.now();
        const results = await Promise.all(monitoredServices.map(async (service, index) => {
            const result = offline ? { ...service, online: false, latency: 0 } : await checkService(service);
            // Premier contrôle : chaque service reste en attente un minimum de temps, puis les
            // résultats arrivent un à un, pour que le passage de l'ambre au vert reste visible
            // même quand la sonde répond en quelques millisecondes.
            if (firstCheck && !reduceMotion) {
                await wait(startedAt + 650 + index * 170 - performance.now());
            }
            showResult(result);
            return result;
        }));

        showOverall(results);
        saveHistory(history);
        // Une fois le battement formé, la pastille ne garde que son texte.
        if (firstCheck) {
            window.setTimeout(() => monitor.classList.add("is-settled"), reduceMotion ? 0 : 1600);
        }
        lastChecked = Date.now();
        showUpdated();
        monitor.classList.remove("is-checking");
        checkInProgress = false;
    }

    function openPanel() {
        // Ouvre vers le haut quand la place manque sous la pastille.
        const rect = trigger.getBoundingClientRect();
        const needed = panel.offsetHeight + 24;
        const below = window.innerHeight - rect.bottom;
        monitor.classList.toggle("opens-up", below < needed && rect.top > below);
        monitor.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
        showUpdated();
        updatedTimer = window.setInterval(showUpdated, 1000);
    }

    function closePanel() {
        monitor.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
        window.clearInterval(updatedTimer);
    }

    trigger.addEventListener("click", () => {
        if (monitor.classList.contains("is-open")) {
            closePanel();
        } else {
            openPanel();
        }
    });

    refresh.addEventListener("click", refreshServiceStatus);

    // Ferme le panneau au clic extérieur et à la touche Échap, en rendant le focus.
    document.addEventListener("click", (event) => {
        if (!monitor.contains(event.target)) closePanel();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && monitor.classList.contains("is-open")) {
            closePanel();
            trigger.focus();
        }
    });

    // Actualise les données au retour sur l'onglet ou à la reconnexion réseau.
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) refreshServiceStatus();
    });
    window.addEventListener("online", refreshServiceStatus);

    window.setInterval(refreshServiceStatus, checkInterval);
    refreshServiceStatus();
}

/**
 * Battement d'état : six points reliés par une ligne. Chaque point suit son service
 * (place dans le battement s'il répond, ligne de base sinon) et un reflet parcourt la
 * ligne, en faisant briller chaque point à son passage.
 */
function createPulse(container, { sweep: hasSweep = true } = {}) {
    const namespace = "http://www.w3.org/2000/svg";
    const create = (tag, attributes) => {
        const element = document.createElementNS(namespace, tag);
        Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
        return element;
    };

    const { xs, beat, baseline, waitingSize, placedSize } = pulseShape;
    const svg = create("svg", { viewBox: "0 0 60 24" });
    const line = create("polyline", { class: "pulse-line", pathLength: 1 });
    const glow = create("polyline", { class: "pulse-glow", pathLength: 1 });
    const dots = xs.map(() => create("rect", { class: "pulse-dot", rx: 1 }));
    svg.append(line, glow, ...dots);
    container.replaceChildren(svg);

    // Position et taille de chaque point, animées par anime.js ; la ligne n'apparaît
    // qu'une fois les premiers résultats connus.
    const heights = xs.map(() => ({ y: baseline, size: waitingSize }));
    const trace = { opacity: 0 };
    const states = xs.map(() => "checking");
    let sweep = null;
    let overall = "";

    const render = () => {
        const now = performance.now();
        const points = heights.map((height, index) => {
            const { y, size } = height;
            dots[index].setAttribute("x", String(xs[index] - size / 2));
            dots[index].setAttribute("y", String(y - size / 2));
            dots[index].setAttribute("width", String(size));
            dots[index].setAttribute("height", String(size));

            // En attente, les carrés respirent l'un après l'autre.
            const breathing = states[index] === "checking" && !reduceMotion
                ? 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(now / 220 - index * 0.9))
                : 1;
            dots[index].style.opacity = String(breathing);
            return `${xs[index]},${y.toFixed(2)}`;
        }).join(" ");
        line.setAttribute("points", points);
        glow.setAttribute("points", points);
        line.style.opacity = String(trace.opacity);
        glow.style.opacity = String(trace.opacity);
    };

    // Moment où le reflet atteint chaque point : fraction de la longueur du battement, puis
    // inverse de l'easing inOutSine du reflet (cos(πt) = 1 - 2p).
    const arrivals = (() => {
        const lengths = [0];
        for (let index = 1; index < xs.length; index++) {
            const step = Math.hypot(xs[index] - xs[index - 1], beat[index] - beat[index - 1]);
            lengths.push(lengths[index - 1] + step);
        }
        return lengths.map((length) => Math.acos(1 - 2 * (length / lengths.at(-1))) / Math.PI);
    })();

    render();

    return {
        render,

        setService(index, state) {
            states[index] = state;
            dots[index].dataset.state = state;
            const target = state === "online" ? beat[index] : baseline;

            if (reduceMotion) {
                Object.assign(heights[index], { y: target, size: placedSize });
                trace.opacity = 1;
                render();
                return;
            }

            // Le carré rétrécit d'abord, puis bondit à sa place (ou retombe à plat s'il est injoignable).
            animate(heights[index], { size: placedSize, delay: 120, duration: 420, ease: "inOutQuad" });
            animate(heights[index], {
                y: target,
                delay: 260,
                duration: state === "online" ? 1300 : 600,
                ease: state === "online" ? "outElastic(1, .5)" : "inOutQuad",
            });
            animate(trace, { opacity: 1, delay: 300, duration: 700, ease: "outQuad" });
        },

        setOverall(state) {
            if (state === overall) return;
            overall = state;
            sweep?.revert();
            sweep = null;
            if (reduceMotion || !hasSweep) return;

            // Balayage lent et ample ; plus l'état se dégrade, plus il ralentit.
            const duration = { online: 5200, degraded: 6600, offline: 8600 }[state] ?? 5200;
            sweep = createTimeline({ loop: true, loopDelay: 2600 })
                .add(glow, { strokeDashoffset: [0.3, -1], duration, ease: "inOutSine" }, 0);
            dots.forEach((dot, index) => {
                // Au passage du reflet : le point grossit, se soulève et s'éclaircit.
                sweep.add(dot, {
                    scale: [
                        { from: 1, to: 2.3, duration: 700, ease: "outQuad" },
                        { to: 1, duration: 2200, ease: "inOutSine" },
                    ],
                    translateY: [
                        { from: 0, to: -2.5, duration: 700, ease: "outQuad" },
                        { to: 0, duration: 2200, ease: "inOutSine" },
                    ],
                    "--flash": [
                        { from: 0, to: 1, duration: 700, ease: "outQuad" },
                        { to: 0, duration: 2200, ease: "inOutSine" },
                    ],
                }, arrivals[index] * duration);
            });
        },
    };
}

async function checkService(service) {
    const started = performance.now();
    const online = service.imageProbe ? await probeImage(service.imageProbe) : await probeFetch(service.url);
    return { ...service, online, latency: Math.round(performance.now() - started) };
}

async function probeFetch(url) {
    // L'AbortController empêche une requête suspendue de bloquer l'état du panneau.
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), requestTimeout);

    try {
        // no-cors permet de savoir qu'une réponse est atteignable sans lire son contenu.
        await fetch(url, {
            method: "GET",
            mode: "no-cors",
            cache: "no-store",
            credentials: "omit",
            redirect: "follow",
            referrerPolicy: "no-referrer",
            signal: controller.signal,
        });
        return true;
    } catch {
        return false;
    } finally {
        window.clearTimeout(timeout);
    }
}

function probeImage(source) {
    // Vault ne répond pas comme les autres : une image chargée avec succès sert de sonde.
    return new Promise((resolve) => {
        const probe = new Image();
        let finished = false;

        // Termine une seule fois, quelle que soit la course entre chargement et délai dépassé.
        const finish = (online) => {
            if (finished) return;
            finished = true;
            window.clearTimeout(timeout);
            probe.onload = null;
            probe.onerror = null;
            resolve(online);
        };

        const timeout = window.setTimeout(() => finish(false), requestTimeout);
        // Le paramètre horodaté évite qu'un favicon servi depuis le cache fausse le test.
        const separator = source.includes("?") ? "&" : "?";

        probe.onload = () => finish(true);
        probe.onerror = () => finish(false);
        probe.referrerPolicy = "no-referrer";
        probe.src = `${source}${separator}status-check=${Date.now()}`;
    });
}

function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, milliseconds)));
}

// L'historique n'est qu'un confort local : un stockage indisponible le rend simplement vide.
function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(historyKey) ?? "{}") ?? {};
    } catch {
        return {};
    }
}

function saveHistory(history) {
    try {
        localStorage.setItem(historyKey, JSON.stringify(history));
    } catch {
        // Navigation privée ou stockage bloqué : l'historique repartira de zéro.
    }
}
