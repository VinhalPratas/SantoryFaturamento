const STORAGE_KEY = "controle-unimed-v1";
const SHEET_HEADERS = [
  "PEDIDO",
  "GUIA PRESTADOR",
  "GUIA OPERADORA",
  "GUIA PRINCIPAL",
  "AUTORIZAÇÃO",
  "BENEFICIÁRIO",
  "CARTEIRINHA",
  "DATA",
  "QTDE",
  "R$/UN",
  "ORIGEM",
  "CÓDIGO",
  "MODALIDADE",
  "PROCEDIMENTO",
  "VALOR (R$)",
];

const state = loadState();
applySeedData();
const editing = {
  notes: null,
  registration: null,
};

const els = {
  registrationForm: document.querySelector("#registrationForm"),
  saveRegistration: document.querySelector("#saveRegistration"),
  notesForm: document.querySelector("#notesForm"),
  saveNotes: document.querySelector("#saveNotes"),
  clearNotes: document.querySelector("#clearNotes"),
  beneficiaryName: document.querySelector("#beneficiaryName"),
  protocolNumber: document.querySelector("#protocolNumber"),
  batchNumber: document.querySelector("#batchNumber"),
  registrationReference: document.querySelector("#registrationReference"),
  referenceName: document.querySelector("#referenceName"),
  patientNotes: document.querySelector("#patientNotes"),
  registrationRows: document.querySelector("#registrationRows"),
  protocolRows: document.querySelector("#protocolRows"),
  searchInput: document.querySelector("#searchInput"),
  searchRows: document.querySelector("#searchRows"),
  resultCount: document.querySelector("#resultCount"),
  exportCsv: document.querySelector("#exportCsv"),
  importCsv: document.querySelector("#importCsv"),
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      registrations: Array.isArray(saved?.registrations) ? saved.registrations : [],
      protocols: Array.isArray(saved?.protocols) ? saved.protocols : [],
    };
  } catch {
    return { registrations: [], protocols: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applySeedData() {
  const seed = window.UNIMED_SEED;
  if (!seed) return;

  const existingRegistrations = new Set(state.registrations.map((item) => item.id));
  const existingProtocols = new Set(state.protocols.map((item) => item.id));

  seed.registrations.forEach((item) => {
    const existing = state.registrations.find((row) => row.id === item.id);
    if (existing) {
      Object.assign(existing, item);
    } else if (!existingRegistrations.has(item.id)) {
      state.registrations.push(item);
    }
  });

  seed.protocols.forEach((item) => {
    const existing = state.protocols.find((row) => row.id === item.id);
    if (existing) {
      Object.assign(existing, item);
    } else if (!existingProtocols.has(item.id)) {
      state.protocols.push(item);
    }
  });
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render() {
  renderRegistrations();
  renderProtocols();
  renderSearch();
  saveState();
}

function emptyRow(colspan, message = "Nenhum registro por enquanto.") {
  return `<tr><td class="empty" colspan="${colspan}">${message}</td></tr>`;
}

function renderProtocols() {
  if (!state.protocols.length) {
    els.protocolRows.innerHTML = emptyRow(1);
    return;
  }

  els.protocolRows.innerHTML = `
    <tr>
      <td class="combinedCell">${renderSavedSheets()}</td>
    </tr>
  `;
}

function renderSearch() {
  const query = normalizeText(els.searchInput.value);

  if (!query) {
    els.resultCount.textContent = "Digite para pesquisar";
    els.searchRows.innerHTML = emptyRow(4, "Pesquise o beneficiário para ver protocolo, lote e referência.");
    return;
  }

  const rows = state.registrations.filter((item) =>
    normalizeText(item.beneficiary).includes(query),
  );

  els.resultCount.textContent = `${rows.length} encontrado${rows.length === 1 ? "" : "s"}`;

  if (!rows.length) {
    els.searchRows.innerHTML = emptyRow(4, "Não encontrado.");
    return;
  }

  els.searchRows.innerHTML = rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.beneficiary)}</td>
          <td>${escapeHtml(item.protocol)}</td>
          <td>${escapeHtml(item.batch)}</td>
          <td>${escapeHtml(item.reference || "")}</td>
        </tr>
      `,
    )
    .join("");
}

function renderRegistrations() {
  if (!state.registrations.length) {
    els.registrationRows.innerHTML = emptyRow(5, "Nenhum nome, protocolo, lote e referência cadastrado.");
    return;
  }

  els.registrationRows.innerHTML = state.registrations
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.beneficiary)}</td>
          <td>${escapeHtml(item.protocol)}</td>
          <td>${escapeHtml(item.batch)}</td>
          <td>${escapeHtml(item.reference || "")}</td>
          <td>
            <div class="rowActions">
              <button type="button" data-edit-registration="${item.id}">Editar</button>
              <button type="button" class="delete" data-delete-registration="${item.id}">Excluir</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join("");
}

function renderNotesTable(notes) {
  const rows = parseNotesTable(notes);
  const dataRows = stripHeaderRow(rows);

  if (!dataRows.length) {
    return "";
  }

  return `
    <div class="miniSheetWrap">
      <table class="miniSheet">
        <thead>
          <tr>${SHEET_HEADERS.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${dataRows
            .map(
              (row) => `
                <tr>
                  ${row
                    .map((cell) =>
                      `<td>${escapeHtml(cell)}</td>`,
                    )
                    .join("")}
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSavedSheets() {
  const parsedRecords = state.protocols
    .map((item) => ({
      id: item.id,
      reference: item.reference || "Sem referência",
      rows: stripHeaderRow(parseNotesTable(item.patientNotes || item.patientInternals || "")),
    }))
    .filter((item) => item.rows.length);

  if (!parsedRecords.length) return "";

  const body = [];
  const groups = groupRecordsByReference(parsedRecords);

  groups.forEach((group, groupIndex) => {
    if (groupIndex > 0) {
      body.push(`<tr class="sheetSpacer"><td colspan="${SHEET_HEADERS.length + 1}"></td></tr>`);
    }

    body.push(`
      <tr class="referenceTitle">
        <td colspan="${SHEET_HEADERS.length + 1}">${escapeHtml(group.reference)}</td>
      </tr>
    `);

    group.records.forEach((record, recordIndex) => {
      const dataRows = record.rows;
      if (!dataRows.length) return;

      if (recordIndex > 0) {
        body.push(`<tr class="sheetSpacer"><td colspan="${SHEET_HEADERS.length + 1}"></td></tr>`);
      }

      let previousBeneficiary = "";

      dataRows.forEach((row, rowIndex) => {
        const currentBeneficiary = row[5] || "";
        if (
          rowIndex > 0 &&
          normalizeText(currentBeneficiary) !== normalizeText(previousBeneficiary)
        ) {
          body.push(`<tr class="patientNameSpacer"><td colspan="${SHEET_HEADERS.length + 1}"></td></tr>`);
        }

        const actionCell =
          rowIndex === dataRows.length - 1
            ? `<td class="sheetAction"><button type="button" class="delete" data-delete-protocol="${record.id}">Excluir</button></td>`
            : `<td class="sheetAction"></td>`;

        body.push(`
          <tr>
            ${SHEET_HEADERS.map((_, cellIndex) => `<td>${escapeHtml(row[cellIndex] || "")}</td>`).join("")}
            ${actionCell}
          </tr>
        `);
        previousBeneficiary = currentBeneficiary;
      });
    });
  });

  return `
    <div class="combinedSheetWrap">
      <table class="miniSheet combinedSheet">
        <thead>
          <tr>
            ${SHEET_HEADERS.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>${body.join("")}</tbody>
      </table>
    </div>
  `;
}

function groupRecordsByReference(records) {
  const groups = new Map();

  records.forEach((record) => {
    if (!groups.has(record.reference)) {
      groups.set(record.reference, []);
    }
    groups.get(record.reference).push(record);
  });

  return [...groups.entries()]
    .sort(([left], [right]) => compareReference(left, right))
    .map(([reference, groupedRecords]) => ({
      reference,
      records: groupedRecords,
    }));
}

function compareReference(left, right) {
  const leftNumber = referenceNumber(left);
  const rightNumber = referenceNumber(right);

  if (leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return normalizeText(left).localeCompare(normalizeText(right), "pt-BR");
}

function referenceNumber(value) {
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function parseNotesTable(notes) {
  const text = String(notes || "").trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hasTabs = lines.some((line) => line.includes("\t"));

  if (hasTabs) {
    return lines.map((line) => line.split("\t").map((cell) => cell.trim()));
  }

  return lines.map((line) => line.split(/\s{2,}/).map((cell) => cell.trim()));
}

function stripHeaderRow(rows) {
  if (!rows.length) return [];
  const firstRow = rows[0].map(normalizeText);
  const expectedHeaders = SHEET_HEADERS.map(normalizeText);
  const matchingHeaders = expectedHeaders.filter((header, index) =>
    firstRow[index]?.includes(header),
  );

  return matchingHeaders.length >= 5 ? rows.slice(1) : rows;
}

function extractBeneficiary(notes) {
  const rows = parseNotesTable(notes);
  const header = rows[0] || [];
  const beneficiaryIndex = header.findIndex((cell) =>
    normalizeText(cell).includes("beneficiario"),
  );

  if (beneficiaryIndex >= 0) {
    const found = rows.slice(1).find((row) => row[beneficiaryIndex]);
    if (found) return found[beneficiaryIndex];
  }

  const ignored = new Set(["PRONTO SOCORRO", "MATMED", "UNIMED"]);
  for (const line of String(notes || "").split(/\r?\n/)) {
    const matches = line.match(/[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}){1,}/g) || [];
    const name = matches.find((value) => !ignored.has(value.trim()));
    if (name) return name.trim();
  }

  return "";
}

els.notesForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const notes = els.patientNotes.value.trim();
  if (!notes) return;

  const record = {
    id: editing.notes ?? makeId(),
    beneficiary: "",
    protocol: "",
    batch: "",
    reference: els.referenceName.value.trim(),
    patientNotes: notes,
  };

  if (editing.notes) {
    const index = state.protocols.findIndex((item) => item.id === editing.notes);
    state.protocols[index] = record;
    editing.notes = null;
    els.saveNotes.textContent = "Salvar planilha";
  } else {
    state.protocols.push(record);
  }

  els.notesForm.reset();
  render();
});

els.clearNotes.addEventListener("click", () => {
  editing.notes = null;
  els.notesForm.reset();
  els.saveNotes.textContent = "Salvar planilha";
});

els.registrationForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const record = {
    id: editing.registration ?? makeId(),
    beneficiary: els.beneficiaryName.value.trim(),
    protocol: els.protocolNumber.value.trim(),
    batch: els.batchNumber.value.trim(),
    reference: els.registrationReference.value.trim(),
  };

  if (editing.registration) {
    const index = state.registrations.findIndex((item) => item.id === editing.registration);
    state.registrations[index] = record;
    editing.registration = null;
    els.saveRegistration.textContent = "Cadastrar";
  } else {
    state.registrations.push(record);
  }

  els.registrationForm.reset();
  render();
});

document.addEventListener("click", (event) => {
  const editNotes = event.target.closest("[data-edit-notes]");
  const editRegistration = event.target.closest("[data-edit-registration]");
  const deleteRegistration = event.target.closest("[data-delete-registration]");
  const deleteProtocol = event.target.closest("[data-delete-protocol]");

  if (editRegistration) {
    const item = state.registrations.find(
      (row) => row.id === editRegistration.dataset.editRegistration,
    );
    if (!item) return;
    editing.registration = item.id;
    els.beneficiaryName.value = item.beneficiary;
    els.protocolNumber.value = item.protocol;
    els.batchNumber.value = item.batch;
    els.registrationReference.value = item.reference || "";
    els.saveRegistration.textContent = "Salvar";
  }

  if (editNotes) {
    const item = state.protocols.find((row) => row.id === editNotes.dataset.editNotes);
    if (!item) return;
    editing.notes = item.id;
    els.referenceName.value = item.reference || "";
    els.patientNotes.value = item.patientNotes || item.patientInternals || "";
    els.saveNotes.textContent = "Salvar alteração";
    els.patientNotes.focus();
  }

  if (deleteProtocol) {
    state.protocols = state.protocols.filter(
      (row) => row.id !== deleteProtocol.dataset.deleteProtocol,
    );
    render();
  }

  if (deleteRegistration) {
    state.registrations = state.registrations.filter(
      (row) => row.id !== deleteRegistration.dataset.deleteRegistration,
    );
    render();
  }
});

els.searchInput.addEventListener("input", renderSearch);

els.exportCsv.addEventListener("click", () => {
  const lines = [
    ["tipo", "referencia", "nome_beneficiario", "protocolo", "lote", "observacoes"],
    ...state.registrations.map((item) => [
      "cadastro",
      item.reference || "",
      item.beneficiary,
      item.protocol,
      item.batch,
      "",
    ]),
    ...state.protocols.map((item) => [
      "planilha",
      item.reference || "",
      "",
      "",
      "",
      item.patientNotes || item.patientInternals || "",
    ]),
  ];
  const csv = lines.map((row) => row.map(csvCell).join(";")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "controle-unimed.csv";
  link.click();
  URL.revokeObjectURL(url);
});

els.importCsv.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const text = await file.text();
  const rows = parseCsv(text);
  const [header, ...data] = rows;
  const hasReferenceColumn = normalizeText(header?.[1] || "") === "referencia";
  const imported = {
    registrations: [],
    protocols: [],
  };

  data.forEach((row) => {
    const type = row[0]?.trim();

    if (type === "cadastro") {
      imported.registrations.push({
        id: makeId(),
        beneficiary: row[hasReferenceColumn ? 2 : 1]?.trim() ?? "",
        protocol: row[hasReferenceColumn ? 3 : 2]?.trim() ?? "",
        batch: row[hasReferenceColumn ? 4 : 3]?.trim() ?? "",
        reference: hasReferenceColumn ? row[1]?.trim() ?? "" : "",
      });
    }

    if (type === "planilha") {
      imported.protocols.push({
        id: makeId(),
        beneficiary: "",
        protocol: "",
        batch: "",
        reference: hasReferenceColumn ? row[1]?.trim() ?? "" : "",
        patientNotes: row[hasReferenceColumn ? 5 : 4]?.trim() ?? "",
      });
    }
  });

  state.registrations = imported.registrations;
  state.protocols = imported.protocols;
  event.target.value = "";
  render();
});

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ";" && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

render();
