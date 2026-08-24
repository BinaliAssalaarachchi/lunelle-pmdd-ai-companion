import { jsPDF } from 'jspdf';

function ensureSpace(doc, y, needed = 24) {
  if (y + needed > 280) {
    doc.addPage();
    return 20;
  }
  return y;
}

function writeWrapped(doc, text, x, y, maxWidth, lineHeight = 5) {
  const lines = doc.splitTextToSize(String(text || ''), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function addDisclaimer(doc, disclaimer, y) {
  y = ensureSpace(doc, y, 28);
  doc.setFontSize(8);
  doc.setTextColor(100);
  return writeWrapped(doc, disclaimer, 14, y, 180, 4);
}

export function downloadPersonalPdf(report) {
  const doc = new jsPDF();
  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Lunelle Personal Summary', 14, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80);
  y = writeWrapped(
    doc,
    `${report.patient.displayName} · ${report.dateRange.start} to ${report.dateRange.end}`,
    14,
    y,
    180,
  );
  y += 4;

  doc.setTextColor(30);
  doc.setFont('helvetica', 'bold');
  doc.text('Overview', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  y = writeWrapped(
    doc,
    `Days tracked: ${report.overview.daysTracked}. Average severity: ${report.overview.averageSeverity}. Average Impact: ${report.overview.averageImpact ?? 'n/a'}. Cycle length: ${report.patient.cycleLength} days.`,
    14,
    y,
    180,
  );
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.text('Phase comparison', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  for (const phase of report.phaseComparison) {
    y = ensureSpace(doc, y, 8);
    y = writeWrapped(
      doc,
      `${phase.label}: avg ${phase.averageSeverity} (${phase.daysLogged} days)`,
      14,
      y,
      180,
    );
  }
  y += 4;

  doc.setFont('helvetica', 'bold');
  y = ensureSpace(doc, y, 10);
  doc.text('Symptom frequency', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  for (const symptom of report.symptomFrequency) {
    y = ensureSpace(doc, y, 8);
    y = writeWrapped(
      doc,
      `${symptom.label}: ${symptom.daysPresent}/${symptom.totalDays} days · luteal avg ${symptom.byPhase.luteal}`,
      14,
      y,
      180,
    );
  }
  y += 4;

  doc.setFont('helvetica', 'bold');
  y = ensureSpace(doc, y, 10);
  doc.text('Notable patterns', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  for (const pattern of report.notablePatterns) {
    y = ensureSpace(doc, y, 10);
    y = writeWrapped(doc, `• ${pattern}`, 14, y, 180);
  }

  if (report.latestInsight?.excerpt) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    y = ensureSpace(doc, y, 10);
    doc.text('Latest insight excerpt', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    y = writeWrapped(doc, report.latestInsight.excerpt, 14, y, 180);
  }

  y += 8;
  addDisclaimer(doc, report.disclaimer, y);
  doc.save(`lunelle-personal-${report.dateRange.end || 'report'}.pdf`);
}

export function downloadClinicianPdf(report) {
  const doc = new jsPDF();
  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Lunelle Symptom Report', 14, y);
  y += 6;
  doc.setFontSize(11);
  doc.text('Prepared for Clinical Review', 14, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y = writeWrapped(
    doc,
    `Patient: ${report.patient.displayName} (${report.patient.email})`,
    14,
    y,
    180,
  );
  y = writeWrapped(
    doc,
    `Report range: ${report.dateRange.start} to ${report.dateRange.end}`,
    14,
    y,
    180,
  );
  y = writeWrapped(
    doc,
    `Cycle length: ${report.patient.cycleLength} days · Period length: ${report.patient.periodLength} days · Last period start: ${report.patient.lastPeriodStart || 'n/a'}`,
    14,
    y,
    180,
  );
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.text('Symptom × phase average severity', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  y = writeWrapped(
    doc,
    'Symptom | Menstrual | Follicular | Ovulatory | Luteal | Days present',
    14,
    y,
    180,
    4,
  );
  doc.setDrawColor(200);
  doc.line(14, y, 196, y);
  y += 4;

  for (const symptom of report.symptomFrequency) {
    y = ensureSpace(doc, y, 8);
    y = writeWrapped(
      doc,
      `${symptom.label} | ${symptom.byPhase.menstrual} | ${symptom.byPhase.follicular} | ${symptom.byPhase.ovulatory} | ${symptom.byPhase.luteal} | ${symptom.daysPresent}/${symptom.totalDays}`,
      14,
      y,
      180,
      4,
    );
  }

  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  y = ensureSpace(doc, y, 10);
  doc.text('Phase summary', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  for (const phase of report.phaseComparison) {
    y = ensureSpace(doc, y, 8);
    y = writeWrapped(
      doc,
      `${phase.label}: average severity ${phase.averageSeverity}; average Impact ${phase.averageImpact ?? 'n/a'} across ${phase.daysLogged} logged days`,
      14,
      y,
      180,
    );
  }

  if (report.impactSummary?.length) {
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    y = ensureSpace(doc, y, 10);
    doc.text('Impact / functional impairment', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    for (const item of report.impactSummary) {
      y = ensureSpace(doc, y, 10);
      y = writeWrapped(
        doc,
        `${item.label} | avg ${item.average} | present ${item.daysPresent}/${item.totalDays} | M ${item.byPhase.menstrual} · F ${item.byPhase.follicular} · O ${item.byPhase.ovulatory} · L ${item.byPhase.luteal}`,
        14,
        y,
        180,
        4,
      );
    }
  }

  y += 4;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  y = ensureSpace(doc, y, 10);
  doc.text('Daily log appendix', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  for (const log of report.dailyLogs) {
    y = ensureSpace(doc, y, 8);
    const impact = log.impact;
    const impactStr = impact
      ? ` · impact p:${impact.productivity ?? 1}/a:${impact.activities ?? 1}/r:${impact.relationships ?? 1}`
      : '';
    y = writeWrapped(
      doc,
      `${log.date} · day ${log.cycleDay} (${log.cyclePhase}) · avg ${log.averageSeverity}${impactStr}`,
      14,
      y,
      180,
      4,
    );
  }

  y += 8;
  doc.setFontSize(9);
  addDisclaimer(doc, report.disclaimer, y);
  doc.save(`lunelle-clinician-${report.dateRange.end || 'report'}.pdf`);
}
