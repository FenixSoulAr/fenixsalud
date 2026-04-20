// migrate-storage.mjs — My Health Hub Storage Migration
// USO: node migrate-storage.mjs TU_CONTRASENA_SUPABASE
//
// Ejemplo: node migrate-storage.mjs miPassword123
//
// Copia los 31 archivos de health-files del proyecto Lovable al nuevo proyecto.

import { Buffer } from 'buffer';

const OLD_URL  = 'https://pwwadvtoabvqvnjkcvjr.supabase.co';
const OLD_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3d2FkdnRvYWJ2cXZuamtjdmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDcyMzUsImV4cCI6MjA4NDA4MzIzNX0.ofxVPNmjnvdXuyg4NxYLV8vL8Sq0O9z8kzIvtqW9r30';
const NEW_URL  = 'https://kxkofzxfpqvpojyeguie.supabase.co';
const NEW_SR   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4a29menhmcHF2cG9qeWVndWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjA5MzM1OSwiZXhwIjoyMDkxNjY5MzU5fQ.7fMqBthACV3h9SYxQ4Fd2G93r8QfLrfoyrmu6pXgNmQ';
const BUCKET   = 'health-files';
const EMAIL    = 'jorge.perez.ar@gmail.com';

const FILES = [
  { path: '95dd7470-4445-4333-95f3-523a3e98e159/TestStudy/52dc2dd3-b7c3-49c6-a6e1-fdfb0b62fa00/1772639343551_260303_Spect_Cardiaco_Orden.pdf', mime: 'application/pdf' },
  { path: '95dd7470-4445-4333-95f3-523a3e98e159/TestStudy/58b63600-5caa-4c32-9967-13da0d9a62c4/1772726960670_260305_Resultados_Laboratorio.pdf', mime: 'application/pdf' },
  { path: '95dd7470-4445-4333-95f3-523a3e98e159/Procedure/fa983f3f-29fd-4935-bb3b-35048d0c2fb1/1773678825448_221207_Epicrisis_Fleni_Cirugia_Conflicto_neuro-vascular.pdf', mime: 'application/pdf' },
  { path: '6e6026f2-4e94-4c07-85b7-27b541386db9/TestStudy/6833c0d9-4829-43e5-b3f2-df9cfd1ad973/1775135810777_6210072518.pdf', mime: 'application/pdf' },
  { path: '66082366-b85e-4d21-80cf-547c9ed9f3cc/TestStudy/d5dd1656-54d6-44ef-8e57-3c16985162a5/1775768309823_31-03-26_Laboratorio_IDIM.pdf', mime: 'application/pdf' },
  { path: '95dd7470-4445-4333-95f3-523a3e98e159/TestStudy/84ec727f-2b3a-4235-b2c6-f7c531e41cd4/1773678529567_260316_RIESGO_QUIRURGICO.pdf', mime: 'application/pdf' },
  { path: 'ac001b42-4b35-4d51-a67d-b3e68c0eea98/TestStudy/c239edea-8fc7-44a6-acc3-cb169ca30832/1768912527543_LABORATORIO_19_ENERO_2026.pdf', mime: 'application/pdf' },
  { path: 'ac001b42-4b35-4d51-a67d-b3e68c0eea98/TestStudy/2b183b18-9727-4682-a20f-91241d82ee83/1768912821398_DOLPER_COLOR_CARDIACO_7_OCT_24.pdf', mime: 'application/pdf' },
  { path: '423cd2c1-4527-48e8-a2ff-63cd8bf67079/TestStudy/24bedae6-d87d-4d54-b351-0749017a8179/1774643071460_Screenshot_20260327-170945.png', mime: 'image/png' },
  { path: 'be364c2e-3970-4eae-a89e-2cff50ed1882/TestStudy/4d706ee7-d724-4bbb-8e18-51309f07ee5a/1775163666840_Screenshot_20260331-152411_Gmail.png', mime: 'image/png' },
  { path: '66082366-b85e-4d21-80cf-547c9ed9f3cc/TestStudy/68609e11-273a-4ecb-8f86-119eb4263015/1775768395403_Estudios_parte_blandas_Hom_bro_derecho.pdf', mime: 'application/pdf' },
  { path: 'f2991c62-a8c4-482b-befb-e7c5717db508/TestStudy/f7ee3c4c-b9e5-4a29-a356-03fff73b77fb/1769314860474_Captura_de_pantalla_2025-07-11_150807.png', mime: 'image/png' },
  { path: 'f2991c62-a8c4-482b-befb-e7c5717db508/TestStudy/f7ee3c4c-b9e5-4a29-a356-03fff73b77fb/1769314869289_Captura_de_pantalla_2025-07-15_183506.png', mime: 'image/png' },
  { path: 'f2991c62-a8c4-482b-befb-e7c5717db508/TestStudy/f7ee3c4c-b9e5-4a29-a356-03fff73b77fb/1769314877007_Captura_de_pantalla_2025-07-15_183603.png', mime: 'image/png' },
  { path: 'f2991c62-a8c4-482b-befb-e7c5717db508/TestStudy/f7ee3c4c-b9e5-4a29-a356-03fff73b77fb/1769314886380_Captura_de_pantalla_2025-07-31_162048.png', mime: 'image/png' },
  { path: 'f2991c62-a8c4-482b-befb-e7c5717db508/TestStudy/f7ee3c4c-b9e5-4a29-a356-03fff73b77fb/1769314893935_Captura_de_pantalla_2025-09-04_173817.png', mime: 'image/png' },
  { path: '95dd7470-4445-4333-95f3-523a3e98e159/TestStudy/84ec727f-2b3a-4235-b2c6-f7c531e41cd4/1773678541568_260316_RIESGO_QUIRURGICO_ECC.pdf', mime: 'application/pdf' },
  { path: '423cd2c1-4527-48e8-a2ff-63cd8bf67079/TestStudy/bffa5e1e-8b2d-4b29-b461-8424107902a1/1774643763313_Screenshot_20260327-173027.png', mime: 'image/png' },
  { path: '95dd7470-4445-4333-95f3-523a3e98e159/TestStudy/1bf474d6-e701-42c3-a85f-44f62adb9b95/1775331029091_260325_VEDA_VCC.pdf', mime: 'application/pdf' },
  { path: '95dd7470-4445-4333-95f3-523a3e98e159/TestStudy/78dd915a-6d61-42de-8a8a-799e408a0a37/1775922926910_210730_Ecograf_a_Renal_Vesical_Prostatica_4-11_12_47_45.pdf', mime: 'application/pdf' },
  { path: '95dd7470-4445-4333-95f3-523a3e98e159/TestStudy/9f9d8a43-306e-4c58-b884-26db57d6da85/1769391446817_250724_ECOGRAFIA_ABDOMINAL.pdf', mime: 'application/pdf' },
  { path: '95dd7470-4445-4333-95f3-523a3e98e159/TestStudy/7f12e6c0-462d-4351-b735-18185722feb0/1769391543981_250724_ECOGRAFIA_DOPPLER_DE_TIROIDES.pdf', mime: 'application/pdf' },
  { path: '95dd7470-4445-4333-95f3-523a3e98e159/TestStudy/1c71a464-a15a-4f11-bed7-3eb2df8c613b/1769391990252_250721_doppler-color-cardiaco.pdf', mime: 'application/pdf' },
  { path: 'ade197f7-6a6b-4156-9ec8-6864d63d09fa/TestStudy/bacd148b-2a8e-42a3-8b71-719fbe362037/1769438895233_ECO_VASICULA_26_ENERO_2026.pdf', mime: 'application/pdf' },
  { path: '768d46a9-2920-420b-b0ef-b0d824f2b1e9/TestStudy/f95cd249-c99b-44c4-88bb-6a0a7202d14c/1769526488752_ResultadosLaboratorio.pdf', mime: 'application/pdf' },
  { path: '768d46a9-2920-420b-b0ef-b0d824f2b1e9/TestStudy/22a55e6c-c996-4ffe-aa12-f6bb7bd8b52e/1769526578226_ResultadosLaboratorio__1_.pdf', mime: 'application/pdf' },
  { path: '768d46a9-2920-420b-b0ef-b0d824f2b1e9/TestStudy/ec5a68e1-a261-452e-bcda-25e237bfb20e/1769526638048_labor121213.pdf', mime: 'application/pdf' },
  { path: '768d46a9-2920-420b-b0ef-b0d824f2b1e9/TestStudy/ec5a68e1-a261-452e-bcda-25e237bfb20e/1769526662449_labor241014.pdf', mime: 'application/pdf' },
  { path: '768d46a9-2920-420b-b0ef-b0d824f2b1e9/TestStudy/65c83aa4-758d-4b2e-9842-fd99b084e098/1769526817659_LG_IGLESIAS_ROBERTO__B24-012841_2.pdf', mime: 'application/pdf' },
  { path: '95dd7470-4445-4333-95f3-523a3e98e159/Procedure/a17bfd50-70b8-44f5-9f5b-e5d6876ffa99/1769545081317_Sindrome_del_Piramidal.pdf', mime: 'application/pdf' },
  { path: '95dd7470-4445-4333-95f3-523a3e98e159/Procedure/a17bfd50-70b8-44f5-9f5b-e5d6876ffa99/1769545096835_Sistema_B-Dyn.pdf', mime: 'application/pdf' },
];

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error('\nERROR: Falta la contrasena.');
    console.error('Uso correcto:');
    console.error('  node migrate-storage.mjs TuContrasena\n');
    process.exit(1);
  }

  console.log('\n=== My Health Hub - Migracion de Storage ===\n');

  // 1. Login en proyecto viejo
  console.log('1. Autenticando en proyecto viejo (Lovable)...');
  const authRes = await fetch(`${OLD_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': OLD_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password }),
  });
  const authData = await authRes.json();
  if (!authData.access_token) {
    console.error('ERROR de login:', JSON.stringify(authData));
    process.exit(1);
  }
  const jwt = authData.access_token;
  console.log('   OK - ' + authData.user.email + '\n');

  // 2. Crear bucket en nuevo proyecto
  console.log('2. Preparando bucket en nuevo proyecto...');
  const bucketRes = await fetch(`${NEW_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      'apikey': NEW_SR,
      'Authorization': `Bearer ${NEW_SR}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, fileSizeLimit: 52428800 }),
  });
  const bucketData = await bucketRes.json();
  const bucketMsg = JSON.stringify(bucketData).toLowerCase();
  if (bucketRes.status === 200 || bucketRes.status === 201) {
    console.log('   OK - Bucket creado\n');
  } else if (bucketMsg.includes('already') || bucketMsg.includes('duplicate')) {
    console.log('   OK - Bucket ya existe\n');
  } else {
    console.log('   Respuesta bucket:', JSON.stringify(bucketData), '\n');
  }

  // 3. Migrar archivos
  console.log(`3. Migrando ${FILES.length} archivos...\n`);
  let ok = 0;
  const failed = [];

  for (let i = 0; i < FILES.length; i++) {
    const { path, mime } = FILES[i];
    const name = path.split('/').pop();
    const label = (name.length > 48 ? name.substring(0, 45) + '...' : name).padEnd(50);
    process.stdout.write(`   [${String(i + 1).padStart(2)}/${FILES.length}] ${label} `);

    try {
      // Generar signed URL en viejo proyecto
      const signRes = await fetch(
        `${OLD_URL}/storage/v1/object/sign/${BUCKET}/${encodeURIComponent(path)}`,
        {
          method: 'POST',
          headers: {
            'apikey': OLD_ANON,
            'Authorization': `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ expiresIn: 300 }),
        }
      );
      const signData = await signRes.json();
      if (!signData.signedURL) {
        throw new Error('Sin signed URL: ' + JSON.stringify(signData).substring(0, 80));
      }

      // Descargar archivo
      const dlRes = await fetch(OLD_URL + signData.signedURL);
      if (!dlRes.ok) throw new Error(`Download HTTP ${dlRes.status}`);
      const fileData = Buffer.from(await dlRes.arrayBuffer());

      // Subir al nuevo proyecto
      const upRes = await fetch(`${NEW_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'POST',
        headers: {
          'apikey': NEW_SR,
          'Authorization': `Bearer ${NEW_SR}`,
          'Content-Type': mime,
          'x-upsert': 'true',
        },
        body: fileData,
      });
      if (!upRes.ok) {
        const txt = await upRes.text();
        throw new Error(`Upload HTTP ${upRes.status}: ${txt.substring(0, 60)}`);
      }

      console.log(`OK  (${Math.round(fileData.length / 1024)} KB)`);
      ok++;
    } catch (e) {
      console.log(`ERROR: ${e.message.substring(0, 55)}`);
      failed.push({ name, error: e.message });
    }
  }

  // 4. Resumen final
  console.log('\n' + '='.repeat(58));
  if (ok === FILES.length) {
    console.log(`EXITO TOTAL: ${ok}/${FILES.length} archivos migrados`);
  } else {
    console.log(`RESULTADO: ${ok}/${FILES.length} OK  |  ${failed.length} con error`);
    failed.forEach(f => console.log(`  - ${f.name}`));
    console.log('\nEjecuta el script de nuevo para reintentar los errores.');
  }
  console.log('='.repeat(58) + '\n');
}

main().catch(e => {
  console.error('\nError fatal:', e.message);
  process.exit(1);
});
