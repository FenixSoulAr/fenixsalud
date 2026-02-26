import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.split(",")[1];
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

const APP_FOLDER = "MiSalud";

export async function saveFileToDevice(opts: { blob: Blob; filename: string; subfolder: "Reportes" | "Adjuntos" }) {
  const base64 = await blobToBase64(opts.blob);

  const folderPath = `${APP_FOLDER}/${opts.subfolder}`;

  // Ensure subfolder exists
  try {
    await Filesystem.mkdir({
      path: folderPath,
      directory: Directory.Documents,
      recursive: true,
    });
  } catch {
    // Folder may already exist, ignore
  }

  const filePath = `${folderPath}/${opts.filename}`;

  const writeRes = await Filesystem.writeFile({
    path: filePath,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  });

  return { ...writeRes, savedPath: `Documentos/${filePath}` };
}

/** @deprecated Use saveFileToDevice instead */
export async function savePdfToDevice(opts: { blob: Blob; filename: string }) {
  return saveFileToDevice({ ...opts, subfolder: "Reportes" });
}

export async function sharePdfFromDevice(opts: { uri: string; filename: string }) {
  await Share.share({
    title: "Resumen clínico",
    text: "Te comparto el resumen clínico en PDF.",
    url: opts.uri,
    dialogTitle: "Compartir resumen",
  });
}
