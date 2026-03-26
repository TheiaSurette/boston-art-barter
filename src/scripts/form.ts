interface PieceDataClient {
  title: string;
  medium: string;
  type: string;
  tradingFor: string;
  imageFile: File | null;
}

// --- Cached DOM references ---

const form = document.getElementById("signup-form") as HTMLFormElement;
const statusEl = document.getElementById("form-status") as HTMLDivElement;
const progressFill = document.getElementById("progress-fill") as HTMLDivElement;
const progressLabel = document.getElementById("progress-label") as HTMLSpanElement;
const stepProgress = document.getElementById("step-progress") as HTMLDivElement;
const piecesStore = document.getElementById("pieces-store") as HTMLDivElement;
const pieceCountInput = document.getElementById("pieceCount") as HTMLInputElement;
const thankYouEl = document.getElementById("thank-you") as HTMLDivElement;
const pieceBadge = document.getElementById("piece-badge") as HTMLDivElement;
const paperForm = document.getElementById("paper-form") as HTMLDivElement;
const pieceListDisplay = document.getElementById("piece-list-display") as HTMLUListElement;
const addPieceBtn = document.getElementById("add-piece-btn") as HTMLButtonElement;
const reviewPersonal = document.getElementById("review-personal") as HTMLDivElement;
const reviewPieces = document.getElementById("review-pieces") as HTMLDivElement;
const reviewPiecesSection = document.getElementById("review-pieces-section") as HTMLDivElement;

// Piece editor fields (cached to avoid repeated getElementById calls)
const pieceTitleInput = document.getElementById("piece-title") as HTMLInputElement;
const pieceMediumInput = document.getElementById("piece-medium") as HTMLInputElement;
const pieceImageInput = document.getElementById("piece-image") as HTMLInputElement;
const pieceTradingForInput = document.getElementById("piece-trading-for") as HTMLTextAreaElement;
const pieceImageHint = document.getElementById("piece-image-hint") as HTMLSpanElement;
const pieceTypeNaRadio = document.getElementById("pt-na") as HTMLInputElement;

// Read validation config from data attributes (shared with server)
const MAX_FILE_SIZE = Number(form.dataset.maxFileSize) || 4 * 1024 * 1024;
const ALLOWED_TYPES = (form.dataset.allowedTypes || "image/jpeg,image/png,image/webp,image/gif").split(",");

// Inline SVGs for dynamically created elements (Lucide icons can't be used in client JS)
const ICON_PENCIL = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>';
const ICON_X = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

// --- State ---

let currentStep = 1;
let pieceIndex = -1; // -1 means "new piece"
const pieces: PieceDataClient[] = [];
let editingFromList = false;
let isAnimating = false;

// --- Helpers ---

function wantsToTradePieces(): boolean {
  return (document.querySelector('input[name="hasPieces"]:checked') as HTMLInputElement)?.value === "yes";
}

function getStepEl(step: number): HTMLDivElement {
  return form.querySelector(`[data-step="${step}"]`) as HTMLDivElement;
}

function showError(msg: string): void {
  statusEl.textContent = msg;
  statusEl.className = "form-status form-status--error";
  statusEl.hidden = false;
}

function addHidden(name: string, value: string): void {
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = value;
  piecesStore.appendChild(input);
}

function createReviewRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "review-row";

  const labelEl = document.createElement("span");
  labelEl.className = "review-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("span");
  valueEl.className = value ? "review-value" : "review-value review-value--empty";
  valueEl.textContent = value || "\u2014";

  row.appendChild(labelEl);
  row.appendChild(valueEl);
  return row;
}

// --- File validation ---

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `"${file.name}" is not a valid image type. Allowed: JPEG, PNG, WebP, GIF.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" exceeds the 4 MB limit.`;
  }
  return null;
}

// --- Step navigation & animation ---

function showStep(step: number, direction: "forward" | "back" = "forward"): void {
  if (isAnimating) return;

  const oldStepEl = getStepEl(currentStep);
  const newStepEl = getStepEl(step);

  if (!oldStepEl || !newStepEl || currentStep === step) {
    form.querySelectorAll(".form-step").forEach((el) => el.classList.remove("active"));
    newStepEl?.classList.add("active");
    currentStep = step;
    paperForm.dataset.currentStep = String(step);
    updateProgress();
    statusEl.hidden = true;
    return;
  }

  isAnimating = true;

  function copyInputValues(source: HTMLElement, target: HTMLElement): void {
    const srcInputs = source.querySelectorAll("input, textarea, select");
    const tgtInputs = target.querySelectorAll("input, textarea, select");
    srcInputs.forEach((srcEl, i) => {
      const tgtEl = tgtInputs[i];
      if (!tgtEl) return;
      if (srcEl instanceof HTMLInputElement && tgtEl instanceof HTMLInputElement) {
        if (srcEl.type === "checkbox" || srcEl.type === "radio") {
          tgtEl.checked = srcEl.checked;
        } else if (srcEl.type !== "file") {
          tgtEl.value = srcEl.value;
        }
      } else if (srcEl instanceof HTMLTextAreaElement && tgtEl instanceof HTMLTextAreaElement) {
        tgtEl.value = srcEl.value;
      } else if (srcEl instanceof HTMLSelectElement && tgtEl instanceof HTMLSelectElement) {
        tgtEl.value = srcEl.value;
      }
    });
  }

  function buildOverlay(stepEl: HTMLDivElement, forStep: number): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.className = "page-overlay";
    overlay.dataset.currentStep = String(forStep);

    // Add star stamps
    for (let s = 1; s <= 5; s++) {
      const star = document.createElement("div");
      star.className = `star-stamp paper-star-${s}`;
      overlay.appendChild(star);
    }

    // Clone header + progress + step content with live values
    const header = paperForm.querySelector(".paper-header");
    const progress = document.getElementById("step-progress");
    if (header) overlay.appendChild(header.cloneNode(true));
    if (progress) {
      const progressClone = progress.cloneNode(true) as HTMLElement;
      overlay.appendChild(progressClone);
    }
    const formBody = document.createElement("div");
    formBody.className = "riso-form paper-body";
    const stepClone = stepEl.cloneNode(true) as HTMLDivElement;
    stepClone.classList.add("active");
    copyInputValues(stepEl, stepClone);
    formBody.appendChild(stepClone);
    overlay.appendChild(formBody);
    return overlay;
  }

  const wrapper = paperForm.closest(".paper-form-wrapper") as HTMLDivElement;

  if (direction === "forward") {
    const overlay = buildOverlay(oldStepEl, currentStep);
    wrapper.appendChild(overlay);

    oldStepEl.classList.remove("active");
    newStepEl.classList.add("active");

    void overlay.offsetWidth;
    overlay.classList.add("lift-off");

    overlay.addEventListener("animationend", () => {
      overlay.remove();
      isAnimating = false;
    }, { once: true });
  } else {
    const overlay = buildOverlay(newStepEl, step);
    wrapper.appendChild(overlay);

    const overlayHeight = overlay.offsetHeight;
    const currentHeight = paperForm.offsetHeight;
    if (overlayHeight > currentHeight) {
      wrapper.style.marginBottom = `${overlayHeight - currentHeight}px`;
    }

    void overlay.offsetWidth;
    overlay.classList.add("drop-on");

    overlay.addEventListener("animationend", () => {
      oldStepEl.classList.remove("active");
      newStepEl.classList.add("active");
      paperForm.dataset.currentStep = String(step);
      wrapper.style.marginBottom = "";
      overlay.remove();
      isAnimating = false;
    }, { once: true });
  }

  currentStep = step;
  if (direction === "forward") {
    paperForm.dataset.currentStep = String(step);
  }
  updateProgress();
  statusEl.hidden = true;
}

function updateProgress(): void {
  const hasPieces = pieces.length > 0 ||
    (document.querySelector('input[name="hasPieces"]:checked') as HTMLInputElement)?.value === "yes";

  let total: number;
  let current: number;

  if (hasPieces) {
    total = 4;
    if (currentStep <= 2) current = currentStep;
    else if (currentStep <= 4) current = 3;
    else current = 4;
  } else {
    total = 3;
    if (currentStep <= 2) current = currentStep;
    else current = 3;
  }

  const pct = Math.round((current / total) * 100);
  progressFill.style.width = `${pct}%`;
  progressLabel.textContent = `Step ${current} of ${total}`;
}

// --- Step validation ---

function validateStep(step: number): boolean {
  const stepEl = getStepEl(step);
  const requiredInputs = stepEl.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "input[required], textarea[required]"
  );

  for (const input of requiredInputs) {
    if (!input.checkValidity()) {
      input.reportValidity();
      return false;
    }
  }

  // Step 1: validate artist photo if one was selected
  if (step === 1) {
    const photoInput = document.getElementById("artistPhoto") as HTMLInputElement;
    if (photoInput.files && photoInput.files.length > 0) {
      const err = validateFile(photoInput.files[0]);
      if (err) {
        showError(err);
        return false;
      }
    }
  }

  // Step 3: validate piece fields manually (not named form fields)
  if (step === 3) {
    const title = pieceTitleInput.value.trim();
    const medium = pieceMediumInput.value.trim();
    const hasNewImage = pieceImageInput.files && pieceImageInput.files.length > 0;
    const hasExistingImage = pieceIndex >= 0 && pieceIndex < pieces.length && pieces[pieceIndex].imageFile !== null;

    if (!title) {
      showError("Piece title is required.");
      pieceTitleInput.focus();
      return false;
    }
    if (!medium) {
      showError("Medium & dimensions is required.");
      pieceMediumInput.focus();
      return false;
    }
    if (!hasNewImage && !hasExistingImage) {
      showError("An image is required for each piece.");
      return false;
    }
    if (hasNewImage) {
      const err = validateFile(pieceImageInput.files![0]);
      if (err) {
        showError(err);
        return false;
      }
    }
  }

  return true;
}

// --- Piece data management ---

function savePieceData(): void {
  const title = pieceTitleInput.value.trim();
  const medium = pieceMediumInput.value.trim();
  const typeRadio = document.querySelector('input[name="pieceType"]:checked') as HTMLInputElement;
  const type = typeRadio ? typeRadio.value : "N/A";
  const tradingFor = pieceTradingForInput.value.trim();
  const newImageFile = pieceImageInput.files && pieceImageInput.files.length > 0 ? pieceImageInput.files[0] : null;

  // Keep existing image if no new one was selected
  const imageFile = newImageFile ?? (pieceIndex >= 0 && pieceIndex < pieces.length ? pieces[pieceIndex].imageFile : null);

  const piece: PieceDataClient = { title, medium, type, tradingFor, imageFile };

  if (pieceIndex >= 0 && pieceIndex < pieces.length) {
    pieces[pieceIndex] = piece;
  } else {
    pieces.push(piece);
  }

  syncPiecesToHiddenInputs();
}

function loadPieceData(index: number): void {
  const piece = pieces[index];
  if (!piece) return;

  pieceTitleInput.value = piece.title;
  pieceMediumInput.value = piece.medium;
  pieceTradingForInput.value = piece.tradingFor;

  const radios = document.querySelectorAll<HTMLInputElement>('input[name="pieceType"]');
  for (const r of radios) {
    r.checked = r.value === piece.type;
  }

  // Clear file input — can't restore for security reasons
  pieceImageInput.value = "";

  // Show hint that image is already saved
  if (piece.imageFile) {
    pieceImageHint.textContent = `Current: ${piece.imageFile.name} \u2014 choose a new file to replace.`;
  } else {
    pieceImageHint.textContent = "JPEG, PNG, WebP, or GIF. 4 MB max.";
  }
}

function resetPieceFields(): void {
  pieceTitleInput.value = "";
  pieceMediumInput.value = "";
  pieceTradingForInput.value = "";
  pieceImageInput.value = "";
  pieceImageHint.textContent = "JPEG, PNG, WebP, or GIF. 4 MB max.";
  if (pieceTypeNaRadio) pieceTypeNaRadio.checked = true;
}

function syncPiecesToHiddenInputs(): void {
  piecesStore.innerHTML = "";
  if (!wantsToTradePieces()) {
    pieceCountInput.value = "0";
    return;
  }
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    addHidden(`piece_${i}_title`, p.title);
    addHidden(`piece_${i}_medium`, p.medium);
    addHidden(`piece_${i}_type`, p.type);
    addHidden(`piece_${i}_tradingFor`, p.tradingFor);
  }
  pieceCountInput.value = String(pieces.length);
}

function updatePieceBadge(): void {
  const num = pieceIndex >= 0 && pieceIndex < pieces.length ? pieceIndex + 1 : pieces.length + 1;
  pieceBadge.textContent = `Piece #${num}`;
}

// --- Piece list (Step 4) ---

function renderPieceList(): void {
  pieceListDisplay.innerHTML = "";
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    const li = document.createElement("li");
    li.className = "piece-list-item";

    const num = document.createElement("span");
    num.className = "piece-list-num";
    num.textContent = String(i + 1);

    const info = document.createElement("div");
    info.className = "piece-list-info";

    const title = document.createElement("div");
    title.className = "piece-list-title";
    title.textContent = p.title;

    const meta = document.createElement("div");
    meta.className = "piece-list-meta";
    meta.textContent = [p.medium, p.type !== "N/A" ? p.type : ""].filter(Boolean).join(" \u00B7 ");

    info.appendChild(title);
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "piece-list-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "piece-list-btn";
    editBtn.innerHTML = ICON_PENCIL;
    editBtn.title = "Edit piece";
    editBtn.addEventListener("click", () => {
      pieceIndex = i;
      editingFromList = true;
      loadPieceData(i);
      updatePieceBadge();
      showStep(3, "forward");
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "piece-list-btn piece-list-btn--remove";
    removeBtn.innerHTML = ICON_X;
    removeBtn.title = "Remove piece";
    removeBtn.addEventListener("click", () => {
      pieces.splice(i, 1);
      syncPiecesToHiddenInputs();
      renderPieceList();
      if (pieces.length === 0) {
        showStep(2, "back");
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(removeBtn);

    li.appendChild(num);
    li.appendChild(info);
    li.appendChild(actions);
    pieceListDisplay.appendChild(li);
  }
}

// --- Review screen (Step 5) ---

function buildReview(): void {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement)?.value?.trim() || "";
  const radioVal = (name: string) => (document.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement)?.value || "";

  const fields: [string, string][] = [
    ["Name", val("name")],
    ["Email", val("email")],
    ["Pronouns", val("pronouns")],
    ["Instagram", val("instagram")],
    ["Group Chat", radioVal("groupChat") === "yes" ? "Yes" : "No"],
    ["Website", val("website")],
    ["Bio", val("bio")],
    ["Artist Photo", (document.getElementById("artistPhoto") as HTMLInputElement)?.files?.[0]?.name || ""],
  ];

  reviewPersonal.innerHTML = "";
  for (const [label, value] of fields) {
    reviewPersonal.appendChild(createReviewRow(label, value));
  }

  // Pieces — only show if user selected "yes" to trading pieces
  if (wantsToTradePieces() && pieces.length > 0) {
    reviewPiecesSection.hidden = false;
    reviewPieces.innerHTML = "";
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      const card = document.createElement("div");
      card.className = "review-piece";

      const header = document.createElement("div");
      header.className = "review-piece-header";
      header.textContent = `${i + 1}. ${p.title}`;
      card.appendChild(header);

      const pieceFields: [string, string][] = [
        ["Medium", p.medium],
        ["Type", p.type],
        ["Image", p.imageFile?.name || ""],
        ["Trade for", p.tradingFor],
      ];

      for (const [label, value] of pieceFields) {
        card.appendChild(createReviewRow(label, value));
      }

      reviewPieces.appendChild(card);
    }
  } else {
    reviewPiecesSection.hidden = true;
  }
}

// --- Navigation handlers ---

addPieceBtn.addEventListener("click", () => {
  pieceIndex = -1;
  editingFromList = true;
  resetPieceFields();
  updatePieceBadge();
  showStep(3, "forward");
});

function handleNext(): void {
  if (!validateStep(currentStep)) return;

  if (currentStep === 1) {
    showStep(2, "forward");
  } else if (currentStep === 2) {
    const hasPieces = (document.querySelector('input[name="hasPieces"]:checked') as HTMLInputElement)?.value;
    if (hasPieces === "yes") {
      if (pieces.length > 0) {
        renderPieceList();
        showStep(4, "forward");
      } else {
        pieceIndex = -1;
        editingFromList = false;
        resetPieceFields();
        updatePieceBadge();
        showStep(3, "forward");
      }
    } else {
      buildReview();
      showStep(5, "forward");
    }
  } else if (currentStep === 3) {
    savePieceData();
    renderPieceList();
    showStep(4, "forward");
  } else if (currentStep === 4) {
    buildReview();
    showStep(5, "forward");
  }
}

function handleBack(): void {
  if (currentStep === 2) {
    showStep(1, "back");
  } else if (currentStep === 3) {
    if (editingFromList || pieces.length > 0) {
      renderPieceList();
      showStep(4, "back");
    } else {
      showStep(2, "back");
    }
  } else if (currentStep === 4) {
    showStep(2, "back");
  } else if (currentStep === 5) {
    if (wantsToTradePieces()) {
      renderPieceList();
      showStep(4, "back");
    } else {
      showStep(2, "back");
    }
  }
}

// Event delegation for navigation buttons
form.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (target.closest("[data-submit]")) {
    e.preventDefault();
    submitForm();
  } else if (target.closest("[data-next]")) {
    handleNext();
  } else if (target.closest("[data-back]")) {
    handleBack();
  }
});

// Prevent native form submission
form.addEventListener("submit", (e) => {
  e.preventDefault();
});

// --- Form submission ---

async function submitForm(): Promise<void> {
  const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement;
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting\u2026";
  statusEl.hidden = true;

  try {
    syncPiecesToHiddenInputs();
    const data = new FormData(form);

    // Append piece images only if user opted to trade pieces
    if (wantsToTradePieces()) {
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        if (piece.imageFile) {
          data.append(`piece_${i}_image`, piece.imageFile);
        }
      }
    }

    const res = await fetch(form.action, {
      method: "POST",
      body: data,
    });

    const json = await res.json();

    if (res.ok && json.success) {
      form.hidden = true;
      stepProgress.hidden = true;
      thankYouEl.classList.add("active");
    } else {
      throw new Error(json.error || "Something went wrong.");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    showError(message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }
}
