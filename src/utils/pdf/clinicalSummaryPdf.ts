import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Capacitor } from "@capacitor/core";

const MAX_CANVAS_HEIGHT = 12000;
const MAX_CANVAS_WIDTH = 3000;

async function renderCanvas(rootEl: HTMLElement, scale: number) {
  return html2canvas(rootEl, {
    scale,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
}

export async function generateClinicalSummaryPdfBlob(rootEl: HTMLElement): Promise<Blob> {
  const initialScale = Capacitor.isNativePlatform() ? 1 : 2;
  let canvas = await renderCanvas(rootEl, initialScale);

  // Guard: if canvas exceeds safe limits, fall back to scale 1
  if (initialScale > 1 && (canvas.height > MAX_CANVAS_HEIGHT || canvas.width > MAX_CANVAS_WIDTH)) {
    console.warn(`[PDF] Canvas too large (${canvas.width}x${canvas.height}), regenerating at scale 1`);
    canvas = await renderCanvas(rootEl, 1);
  }

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
