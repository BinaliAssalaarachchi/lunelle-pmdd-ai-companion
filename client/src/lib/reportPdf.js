export async function downloadPersonalPdf(report) {
  const { downloadPersonalPdf: download } = await import('./pdf/download.jsx');
  return download(report);
}

export async function downloadClinicianPdf(report) {
  const { downloadClinicianPdf: download } = await import('./pdf/download.jsx');
  return download(report);
}
