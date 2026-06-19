import { describe, expect, it } from 'vitest';
import { sectionsToRows, type ReportExportSection } from '@/lib/reporting/report-export-utils';

describe('report actions', () => {
  it('preserva columnas adicionales al aplanar secciones', () => {
    const sections: ReportExportSection[] = [
      {
        title: 'Cotizaciones por estado',
        header: ['Estado', 'Cantidad', 'Monto (S/)'],
        rows: [['Aceptada', '10', '5000']],
      },
      {
        title: 'Desempeño del equipo',
        header: ['Responsable', 'Leads', 'Ganados'],
        rows: [['Maria', '8', '3']],
      },
    ];

    const rows = sectionsToRows('Reporte', sections);

    expect(rows[0]).toEqual(['Seccion', 'Metrica', 'Valor 1', 'Valor 2']);
    expect(rows[1]).toEqual(['Cotizaciones por estado', 'Estado', 'Cantidad', 'Monto (S/)']);
    expect(rows[2]).toEqual(['Cotizaciones por estado', 'Aceptada', '10', '5000']);
    expect(rows[3]).toEqual(['Desempeño del equipo', 'Responsable', 'Leads', 'Ganados']);
    expect(rows[4]).toEqual(['Desempeño del equipo', 'Maria', '8', '3']);
  });

  it('agrega una fila vacía cuando no hay secciones', () => {
    expect(sectionsToRows('Reporte vacío', [])).toEqual([
      ['Seccion', 'Metrica', 'Valor 1'],
      ['Reporte vacío', 'Sin datos', ''],
    ]);
  });
});
