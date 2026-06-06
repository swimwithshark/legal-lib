let sections = [];
let topics = [];

const searchInput = document.getElementById("searchInput");
const resultsList = document.getElementById("resultsList");
const detailView = document.getElementById("detailView");

async function loadData() {
  const [sectionsResponse, topicsResponse] = await Promise.all([
    fetch("data/mvp-sections-enriched.json"),
    fetch("data/mvp-topics.json")
  ]);

  sections = await sectionsResponse.json();
  topics = await topicsResponse.json();

  renderResults(sections);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sectionMatchesQuery(section, query) {
  const q = normalize(query);

  if (!q) return true;

  const searchableText = normalize([
    section.sectionNo,
    section.title,
    section.plainEnglish,
    ...(section.keywords || []),
    ...(section.commonSearchTerms || []),
    ...(section.searchTokens || [])
  ].join(" "));

  return searchableText.includes(q);
}

function topicMatchesQuery(topic, query) {
  const q = normalize(query);

  if (!q) return false;

  const searchableText = normalize([
    topic.title,
    topic.summary,
    ...(topic.commonTerms || [])
  ].join(" "));

  return searchableText.includes(q);
}

function search(query) {
  const directSectionResults = sections.filter(section =>
    sectionMatchesQuery(section, query)
  );

  const matchingTopics = topics.filter(topic =>
    topicMatchesQuery(topic, query)
  );

  const topicSectionIds = new Set();

  matchingTopics.forEach(topic => {
    (topic.relatedSections || []).forEach(sectionId => {
      topicSectionIds.add(sectionId);
    });
  });

  const topicSectionResults = sections.filter(section =>
    topicSectionIds.has(section.id)
  );

  const combined = [...directSectionResults];

  topicSectionResults.forEach(section => {
    if (!combined.some(item => item.id === section.id)) {
      combined.push(section);
    }
  });

  renderResults(combined, matchingTopics);
}

function renderResults(sectionResults, topicResults = []) {
  resultsList.innerHTML = "";

  if (topicResults.length > 0) {
    const topicHeader = document.createElement("div");
    topicHeader.innerHTML = `<h3>Matching topics</h3>`;
    resultsList.appendChild(topicHeader);

    topicResults.forEach(topic => {
      const card = document.createElement("div");
      card.className = "result-card";
      card.innerHTML = `
        <strong>${escapeHtml(topic.title)}</strong>
        <div>${escapeHtml(topic.summary)}</div>
        <div>
          ${(topic.commonTerms || [])
            .slice(0, 5)
            .map(term => `<span class="badge">${escapeHtml(term)}</span>`)
            .join("")}
        </div>
      `;

      card.addEventListener("click", () => renderTopic(topic));
      resultsList.appendChild(card);
    });

    const sectionHeader = document.createElement("div");
    sectionHeader.innerHTML = `<h3>Related sections</h3>`;
    resultsList.appendChild(sectionHeader);
  }

  if (sectionResults.length === 0) {
    resultsList.innerHTML += `<p>No results found.</p>`;
    return;
  }

  sectionResults.forEach(section => {
    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <strong>Section ${escapeHtml(section.sectionNo)} — ${escapeHtml(section.title)}</strong>
      <div>${escapeHtml(section.plainEnglish || "")}</div>
      <div>
        ${(section.keywords || [])
          .slice(0, 4)
          .map(keyword => `<span class="badge">${escapeHtml(keyword)}</span>`)
          .join("")}
      </div>
    `;

    card.addEventListener("click", () => renderSection(section));
    resultsList.appendChild(card);
  });
}

function renderTopic(topic) {
  const related = (topic.relatedSections || [])
    .map(sectionId => sections.find(section => section.id === sectionId))
    .filter(Boolean);

  // Clear the ?section=... URL when a topic is selected.
  window.history.pushState({}, "", window.location.pathname);

  detailView.className = "";
  detailView.innerHTML = `
    <h2 class="section-title">${escapeHtml(topic.title)}</h2>
    <p>${escapeHtml(topic.summary)}</p>

    <h3>Common search terms</h3>
    <div>
      ${(topic.commonTerms || [])
        .map(term => `<span class="badge">${escapeHtml(term)}</span>`)
        .join("")}
    </div>

    <h3>Related sections</h3>
    <div class="related-list">
      ${related.map(section => `
        <button data-section-id="${escapeHtml(section.id)}">
          Section ${escapeHtml(section.sectionNo)}
        </button>
      `).join("")}
    </div>

    <p class="disclaimer">
      This app provides general legal information only. It is not legal advice.
      Please verify the latest official law text or consult a qualified lawyer for legal matters.
    </p>
  `;

  detailView.querySelectorAll("[data-section-id]").forEach(button => {
    button.addEventListener("click", () => {
      const section = sections.find(item => item.id === button.dataset.sectionId);
      if (section) renderSection(section);
    });
  });
}

function renderSection(section) {
  // Update the browser URL so every section can be shared directly.
  window.history.pushState(
    {},
    "",
    `?section=${encodeURIComponent(section.sectionNo)}`
  );

  const related = (section.relatedSections || [])
    .map(sectionNo => sections.find(item => item.sectionNo === sectionNo))
    .filter(Boolean);

  detailView.className = "";
  detailView.innerHTML = `
    <h2 class="section-title">Section ${escapeHtml(section.sectionNo)} — ${escapeHtml(section.title)}</h2>

    <div class="meta">
      Penal Code Act 574 · Source version: ${escapeHtml(section.sourceVersionDate || "Unknown")}
    </div>

    <h3>Plain-English explanation</h3>
    <div class="explanation">
      ${escapeHtml(section.plainEnglish || "No explanation available yet.")}
    </div>

    <h3>Related sections</h3>
    <div class="related-list">
      ${
        related.length
          ? related.map(item => `
              <button data-section-id="${escapeHtml(item.id)}">
                Section ${escapeHtml(item.sectionNo)} — ${escapeHtml(item.title)}
              </button>
            `).join("")
          : "<p>No related sections added yet.</p>"
      }
    </div>

    <h3>Official text</h3>
    <div class="raw-text">${escapeHtml(section.rawText || "")}</div>

    <p class="disclaimer">
      This app provides general legal information only. It is not legal advice.
      Please verify the latest official law text or consult a qualified lawyer for legal matters.
    </p>
  `;

  detailView.querySelectorAll("[data-section-id]").forEach(button => {
    button.addEventListener("click", () => {
      const relatedSection = sections.find(item => item.id === button.dataset.sectionId);
      if (relatedSection) renderSection(relatedSection);
    });
  });
}

function openSectionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const sectionNo = params.get("section");

  if (!sectionNo) return;

  const section = sections.find(item =>
    String(item.sectionNo || "").toLowerCase() === sectionNo.toLowerCase()
  );

  if (section) {
    searchInput.value = sectionNo;
    search(sectionNo);
    renderSection(section);
  } else {
    detailView.className = "empty-state";
    detailView.innerHTML = `
      Section ${escapeHtml(sectionNo)} was not found in this MVP dataset.
    `;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

searchInput.addEventListener("input", event => {
  search(event.target.value);
});

document.querySelectorAll("[data-search]").forEach(button => {
  button.addEventListener("click", () => {
    searchInput.value = button.dataset.search;
    search(button.dataset.search);
  });
});

// Support browser Back/Forward buttons for direct section links.
window.addEventListener("popstate", () => {
  openSectionFromUrl();

  if (!window.location.search) {
    detailView.className = "empty-state";
    detailView.innerHTML = "Search or select a section to begin.";
    search(searchInput.value);
  }
});

loadData()
  .then(() => {
    openSectionFromUrl();
  })
  .catch(error => {
    console.error(error);
    detailView.innerHTML = `
      <div class="empty-state">
        Failed to load data. Make sure you are running this through a local server, not opening the HTML file directly.
      </div>
    `;
  });
