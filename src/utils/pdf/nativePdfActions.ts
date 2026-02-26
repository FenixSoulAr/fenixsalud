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

export async function savePdfToDevice(opts: { blob: Blob; filename: string }) {
  const base64 = await blobToBase64(opts.blob);

  // Ensure MiSalud folder exists
  try {
    await Filesystem.mkdir({
      path: APP_FOLDER,
      directory: Directory.Documents,
      recursive: true,
    });
  } catch {
    // Folder may already exist, ignore
  }

  const filePath = `${APP_FOLDER}/${opts.filename}`;

  const writeRes = await Filesystem.writeFile({
    path: filePath,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  });

  return writeRes;
}

export async function sharePdfFromDevice(opts: { uri: string; filename: string }) {
  await Share.share({
    title: "Resumen clínico",
    text: "Te comparto el resumen clínico en PDF.",
    url: opts.uri,
    dialogTitle: "Compartir resumen",
  });
}
