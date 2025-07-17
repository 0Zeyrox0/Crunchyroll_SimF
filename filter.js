// Hilfsfunktion: wartet bis ein Element im DOM vorhanden ist
function waitForElement(selector) {
    return new Promise((resolve) => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

// Neue Version von filter.js mit Sprachfilter und Spracheinstellungsspeicherung

let userLanguage = "german"; // Fallback

async function loadLanguageSetting() {
    const data = await browser.storage.local.get("language");
    userLanguage = data.language || "german";
}

async function saveLanguageSetting(lang) {
    await browser.storage.local.set({ language: lang });
}

function extractLanguageFromSeasonName(seasonName) {
    const match = seasonName.match(/\(([^)]+?) Dub\)/i);
    return match ? match[1].toLowerCase() : null;
}

async function getLanguageFromEntry(entry) {
    const article = entry.closest("li")?.querySelector("[data-popover-url]");
    if (!article) {
        //console.warn("Kein data-popover-url gefunden für Eintrag:", entry);
        return null;
    }

    const popoverUrl = article.getAttribute("data-popover-url");
    if (!popoverUrl) return null;

    const fullUrl = "https://www.crunchyroll.com/de" + popoverUrl;

    try {
        const res = await fetch(fullUrl, { credentials: "same-origin" });
        const json = await res.json();
        const seasonName = json?.seasonName || "";
        //console.log("SeasonName:", seasonName);
        return extractLanguageFromSeasonName(seasonName);
    } catch (e) {
        console.error("Fehler beim Laden des JSON-Popovers:", e);
        return null;
    }
}

function shouldHide(entry, queueOnly, languageOnly, languageMap) {
    const queued = entry.querySelector(".queue-flag.queued") !== null;
    const lang = languageMap.get(entry);
    const matchesLanguage = lang === userLanguage;

    if (queueOnly && !queued) return true;
    if (languageOnly && !matchesLanguage) return true;
    return false;
}

async function applyFilter() {
    const queueOnly = document.getElementById("watchlist-filter")?.checked;
    const languageOnly = document.getElementById("language-filter")?.checked;

    const entries = Array.from(document.querySelectorAll(".js-release"));
    const languageMap = new Map();

    const results = await Promise.all(
        entries.map(async (entry) => {
            const lang = await getLanguageFromEntry(entry);
            return { entry, lang };
        })
    );

    for (const { entry, lang } of results) {
        languageMap.set(entry, lang);
    }

    for (const entry of entries) {
        const hide = shouldHide(entry, queueOnly, languageOnly, languageMap);
        entry.style.display = hide ? "none" : "";
    }
}

async function insertCheckboxes() {
    await loadLanguageSetting();

    const container = document.querySelector("#filter_toggle_form");
    if (!container || document.getElementById("language-filter")) return;

    const languageCheckbox = document.createElement("label");
    languageCheckbox.innerHTML = `
        <input type="checkbox" id="language-filter"> Nur Sprache
    `;
    languageCheckbox.style.marginLeft = "2rem";

    const listCheckbox = document.createElement("label");
    listCheckbox.innerHTML = `
        <input type="checkbox" id="watchlist-filter"> Nur gemerkt
    `;
    listCheckbox.style.marginLeft = "2rem";

    const langSelectLabel = document.createElement("label");
    langSelectLabel.innerHTML = `
        Sprache:
        <select id="language-select">
            <option value="japanese">Japanese</option>
            <option value="german">German</option>
            <option value="french">French</option>
            <option value="english">English</option>
            <option value="spanish">Spanish</option>
            <option value="italian">Italian</option>
            <option value="portuguese">Portuguese</option>
            <option value="russian">Russian</option>

        </select>
    `;
    langSelectLabel.style.marginLeft = "2rem";

    container.appendChild(languageCheckbox);
    container.appendChild(listCheckbox);
    container.appendChild(langSelectLabel);

    document.getElementById("language-filter").addEventListener("change", applyFilter);
    document.getElementById("watchlist-filter").addEventListener("change", applyFilter);

    const select = document.getElementById("language-select");
    select.value = userLanguage;
    select.addEventListener("change", async () => {
        userLanguage = select.value;
        await saveLanguageSetting(userLanguage);
        applyFilter();
    });
}

waitForElement("#filter_toggle_form").then(insertCheckboxes);
