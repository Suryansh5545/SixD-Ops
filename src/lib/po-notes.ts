export interface ParsedPONotes {
  additionalNotes: string;
  division: "TS" | "LSS" | null;
  scope: string;
}

function extractSection(notes: string, label: string) {
  const pattern = new RegExp(`(?:^|\\n\\n)${label}:\\s*([\\s\\S]*?)(?=\\n\\n(?:Division|Scope|Additional Notes):|$)`, "i");
  const match = notes.match(pattern);
  return match?.[1]?.trim() ?? "";
}

export function parsePONotes(notes?: string | null): ParsedPONotes {
  const raw = notes?.trim() ?? "";

  if (!raw) {
    return {
      additionalNotes: "",
      division: null,
      scope: "",
    };
  }

  const divisionRaw = extractSection(raw, "Division").toUpperCase();
  const division = divisionRaw === "TS" || divisionRaw === "LSS" ? divisionRaw : null;

  return {
    division,
    scope: extractSection(raw, "Scope"),
    additionalNotes: extractSection(raw, "Additional Notes"),
  };
}

export function composePONotes(input: {
  additionalNotes?: string | null;
  division?: "TS" | "LSS" | null;
  scope?: string | null;
}) {
  return [
    input.division ? `Division: ${input.division}` : null,
    input.scope?.trim() ? `Scope: ${input.scope.trim()}` : null,
    input.additionalNotes?.trim() ? `Additional Notes: ${input.additionalNotes.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}
