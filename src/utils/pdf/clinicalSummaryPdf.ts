import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function generateClinicalSummaryPdfBlob(rootEl: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(rootEl, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");

  // A4 in pt: 595.28 x 841.89
  const pdf = new jsPDF("p", "pt", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  const imgWidth = pageWidth;
  const imgHeight = (canvasHeight * imgWidth) / canvasWidth;

  let remainingHeight = imgHeight;
  let positionY = 0;

  pdf.addImage(imgData, "PNG", 0, positionY, imgWidth, imgHeight, undefined, "FAST");
  remainingHeight -= pageHeight;

  while (remainingHeight > 0) {
    pdf.addPage();
    positionY = -(imgHeight - remainingHeight);
    pdf.addImage(imgData, "PNG", 0, positionY, imgWidth, imgHeight, undefined, "FAST");
    remainingHeight -= pageHeight;
  }

  return pdf.output("blob");
}
