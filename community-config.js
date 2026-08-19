window.JJKCECommunityConfig = Object.freeze({
  // Public values only. Never place ADMIN_TOKEN, TURNSTILE_SECRET_KEY,
  // RATE_LIMIT_SALT, or any other secret in this file.
  apiBaseUrl: "https://jjkce-community.pbcristi-jjkce.workers.dev",
  turnstileSiteKey: "0x4AAAAAAEULrqaCzxDmb2Sz"
});

// Public roadmap release-state synchronization.
// This intentionally changes presentation text only; Community Ideas API,
// Turnstile, worker, moderation, and submission behavior are untouched.
document.addEventListener("DOMContentLoaded", function () {
  function findByText(selector, needle) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      if ((nodes[i].textContent || "").indexOf(needle) !== -1) return nodes[i];
    }
    return null;
  }

  var statusBoxes = document.querySelectorAll(".status .box strong");
  if (statusBoxes.length >= 3) {
    statusBoxes[0].textContent = "v0.22.1";
    statusBoxes[1].textContent = "v0.23 Basic Curse Ecosystem";
    statusBoxes[2].textContent = "v0.22.1 published · v0.23 planned";
  }

  var currentBlocks = document.querySelectorAll(".current");
  if (currentBlocks.length >= 1) {
    var releaseVersion = currentBlocks[0].querySelector(".version");
    var releaseTitle = currentBlocks[0].querySelector("h3");
    var releaseText = currentBlocks[0].querySelector("p");
    if (releaseVersion) releaseVersion.textContent = "Current public release · v0.22.1";
    if (releaseTitle) releaseTitle.textContent = "Technical Hotfix & Cursed Damage Foundation";
    if (releaseText) releaseText.textContent = "v0.22.1 is the current downloadable public release. It includes the established Sorcerer progression systems, generated-Sorcerer Tier stabilization, tactical panel/hotbar refresh fixes, targeted Legends armor compatibility, and the Cursed Damage Framework foundation required by future curse enemies.";
  }

  if (currentBlocks.length >= 2) {
    var frameworkVersion = currentBlocks[1].querySelector(".version");
    var frameworkTitle = currentBlocks[1].querySelector("h3");
    var frameworkText = currentBlocks[1].querySelector("p");
    if (frameworkVersion) frameworkVersion.textContent = "Published framework · v0.22";
    if (frameworkTitle) frameworkTitle.textContent = "Cursed Damage Framework";
    if (frameworkText) frameworkText.textContent = "The curse-valid damage foundation is now part of the public release. It distinguishes ordinary physical attacks from CE-infused and cursed-technique damage while preserving ordinary Battle Brothers targets on the vanilla damage path. Actual pure curse enemies and full curse perception remain the next major development layer.";
  }

  var note = document.querySelector(".note");
  if (note) {
    note.innerHTML = "<strong>Current state:</strong> v0.22.1 is published. The next major milestone is the first Basic Curse Ecosystem; actual curse enemies and the full perception layer are still future work.";
  }

  var availableHeading = findByText("h2", "Now available in v0.21.12");
  if (availableHeading) availableHeading.textContent = "Now available in v0.22.1";

  var stabilizationTitle = findByText("h3", "v0.21.12 stabilization");
  if (stabilizationTitle) {
    stabilizationTitle.textContent = "v0.22.1 technical hotfix";
    var card = stabilizationTitle.closest(".card");
    if (card) {
      var p = card.querySelector("p");
      if (p) p.textContent = "The current release fixes generated-Sorcerer Tier initialization, tactical character-panel/hotbar refresh races, and Legends starting-body-armor compatibility while keeping development/debug menus disabled in the public configuration.";
    }
  }

  var activeTitle = findByText("h3", "v0.22 — Cursed Damage Framework");
  if (activeTitle) {
    activeTitle.textContent = "v0.23 — Basic Curse Ecosystem";
    var activeCard = activeTitle.closest(".card");
    if (activeCard) {
      var tag = activeCard.querySelector(".tag");
      var p2 = activeCard.querySelector("p");
      if (tag) {
        tag.textContent = "Planned next";
        tag.classList.remove("now");
        tag.classList.add("planned");
      }
      if (p2) p2.textContent = "Add the first actual pure curse enemies using the published v0.22 damage-validity foundation, then connect exorcism, supernatural combat behavior, Pressure/Insight, and the first dedicated curse-perception rules.";
    }
  }

  var regressionTitle = findByText("h3", "Sorcerer & compatibility regression work");
  if (regressionTitle) {
    regressionTitle.textContent = "Post-release stabilization & verification";
    var regressionCard = regressionTitle.closest(".card");
    if (regressionCard) {
      var regressionTag = regressionCard.querySelector(".tag");
      var regressionText = regressionCard.querySelector("p");
      if (regressionTag) regressionTag.textContent = "Ongoing";
      if (regressionText) regressionText.textContent = "Focused regression remains useful for generated-Sorcerer Tier repair, tactical UI stability, optional Legends compatibility, save/load persistence, and the published Cursed Damage Framework. Publication does not by itself mark those checks Verified.";
    }
  }
});
