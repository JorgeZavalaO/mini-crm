export type ReportExportSection = {
  title: string;
  header: string[];
  rows: string[][];
};

export function sectionsToRows(title: string, sections: ReportExportSection[]): string[][] {
  const maxSectionColumns = sections.reduce(
    (max, section) =>
      Math.max(max, section.header.length, ...section.rows.map((row) => row.length)),
    0,
  );
  const columnHeaders = Array.from({ length: Math.max(2, maxSectionColumns) }, (_, index) =>
    index === 0 ? 'Metrica' : `Valor ${index}`,
  );
  const rows: string[][] = [['Seccion', ...columnHeaders]];

  function padColumns(values: string[]) {
    return [
      ...values,
      ...Array.from({ length: Math.max(0, columnHeaders.length - values.length) }, () => ''),
    ];
  }

  for (const section of sections) {
    rows.push([section.title, ...padColumns(section.header)]);
    for (const row of section.rows) {
      rows.push([section.title, ...padColumns(row)]);
    }
  }
  if (rows.length === 1) rows.push([title, ...padColumns(['Sin datos'])]);
  return rows;
}
