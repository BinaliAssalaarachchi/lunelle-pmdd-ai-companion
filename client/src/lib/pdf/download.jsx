import { pdf } from '@react-pdf/renderer';
import { ClinicianReportDocument } from './ClinicianReportDocument.jsx';
import { PersonalReportDocument } from './PersonalReportDocument.jsx';

function fileName(prefix, report) {
  const end = report?.dateRange?.end || 'report';
  return `lunelle-${prefix}-${end}.pdf`;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function renderPersonalDocument(report) {
  return pdf(<PersonalReportDocument report={report} />);
}

export function renderClinicianDocument(report) {
  return pdf(<ClinicianReportDocument report={report} />);
}

export async function downloadPersonalPdf(report) {
  const blob = await renderPersonalDocument(report).toBlob();
  saveBlob(blob, fileName('personal', report));
}

export async function downloadClinicianPdf(report) {
  const blob = await renderClinicianDocument(report).toBlob();
  saveBlob(blob, fileName('clinician', report));
}

