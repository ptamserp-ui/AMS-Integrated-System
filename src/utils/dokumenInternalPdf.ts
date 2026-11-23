import type { DokumenInternal, IdentitasKopDokumenInternal } from '../types';
import {
  KATEGORI_DOKUMEN_META,
  ambilDetailHargaPoUmum,
  ambilSkemaDokumen,
  hitungNilaiTotalItems,
  hitungRingkasanFinansialDokumen,
  hitungSubtotalPoUmum
} from './dokumenInternal';

function formatRpPdf(nilai: number): string {
  return 'Rp ' + Math.round(nilai).toLocaleString('id-ID');
}

function formatTanggalId(iso?: string): string {
  if (!iso || iso === '-') return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function hexToRgb(hex: string): [number, number, number] {
  const bersih = hex.replace('#', '').trim();
  if (bersih.length === 3) {
    const r = parseInt(bersih[0] + bersih[0], 16);
    const g = parseInt(bersih[1] + bersih[1], 16);
    const b = parseInt(bersih[2] + bersih[2], 16);
    return [r || 15, g || 118, b || 110];
  }
  if (bersih.length === 6) {
    const r = parseInt(bersih.slice(0, 2), 16);
    const g = parseInt(bersih.slice(2, 4), 16);
    const b = parseInt(bersih.slice(4, 6), 16);
    return [Number.isNaN(r) ? 15 : r, Number.isNaN(g) ? 118 : g, Number.isNaN(b) ? 110 : b];
  }
  return [15, 118, 110];
}

async function muatGambarSebagaiPng(src: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || 200;
        const h = img.naturalHeight || 80;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: canvas.toDataURL('image/png'), width: w, height: h });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function buatDataUrlQrDokumen(payload: string): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(payload, {
    width: 180,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });
}

function formatNilaiFieldDinamis(
  val: string | number | boolean | undefined,
  type: string
): string {
  if (val === undefined || val === null || val === '') return '-';
  if (type === 'boolean') return val ? 'Ya / Memenuhi' : 'Tidak';
  if (type === 'date') return formatTanggalId(String(val));
  if (type === 'currency') {
    const n = Number(String(val).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? formatRpPdf(n) : String(val);
  }
  return String(val);
}

export async function unduhDokumenInternalPdfA4(
  dokumen: DokumenInternal,
  identitas: IdentitasKopDokumenInternal,
  logoResolvedUrl?: string
): Promise<void> {
  const [{ jsPDF }, qrDataUrl] = await Promise.all([
    import('jspdf'),
    buatDataUrlQrDokumen(dokumen.tandaTanganDigital.qrPayload)
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const skema = ambilSkemaDokumen(dokumen.jenisDokumen);
  const katMeta = KATEGORI_DOKUMEN_META[dokumen.kategori];
  const pageW = 210;
  const pageH = 297;
  const marginX = 14;
  const contentW = pageW - marginX * 2; // 182 mm
  const [accentR, accentG, accentB] = hexToRgb(identitas.warnaAksen || katMeta.warnaAksen || '#0f766e');

  const logoAsset =
    identitas.tampilkanLogo && logoResolvedUrl
      ? await muatGambarSebagaiPng(logoResolvedUrl)
      : null;

  let y = 14;
  const startHeaderY = y;
  let textStartX = marginX;
  let maxTextW = contentW - 58;

  if (logoAsset) {
    const maxLogoW = 34;
    const maxLogoH = 15;
    const ratio = Math.min(maxLogoW / logoAsset.width, maxLogoH / logoAsset.height);
    const drawW = logoAsset.width * ratio;
    const drawH = logoAsset.height * ratio;
    doc.addImage(logoAsset.dataUrl, 'PNG', marginX, y, drawW, drawH);
    textStartX = marginX + drawW + 4;
    maxTextW = contentW - drawW - 60;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(17, 24, 39);
  const namaLines = doc.splitTextToSize(identitas.namaPerusahaan || 'PT ANUGRAHMITRA SELARAS', maxTextW);
  doc.text(namaLines, textStartX, y + 4.2);
  let leftY = y + 4.2 + (namaLines.length - 1) * 4.8;

  if (identitas.tagline) {
    leftY += 4.0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(accentR, accentG, accentB);
    const tagLines = doc.splitTextToSize(identitas.tagline, maxTextW);
    doc.text(tagLines, textStartX, leftY);
    leftY += (tagLines.length - 1) * 3.4;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(75, 85, 99);
  if (identitas.alamat) {
    leftY += 3.8;
    const alamatLines = doc.splitTextToSize(identitas.alamat, maxTextW);
    doc.text(alamatLines, textStartX, leftY);
    leftY += (alamatLines.length - 1) * 3.2;
  }

  const kontakBaris = [
    identitas.telepon ? `Telp: ${identitas.telepon}` : '',
    identitas.email ? `Email: ${identitas.email}` : '',
    identitas.website ? `Web: ${identitas.website}` : ''
  ]
    .filter(Boolean)
    .join('  •  ');
  if (kontakBaris) {
    leftY += 3.6;
    const kLines = doc.splitTextToSize(kontakBaris, maxTextW);
    doc.text(kLines, textStartX, leftY);
    leftY += (kLines.length - 1) * 3.2;
  }

  if (identitas.tampilkanLegalitas && identitas.nomorLegalitas) {
    leftY += 3.6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(55, 65, 81);
    const legLines = doc.splitTextToSize(identitas.nomorLegalitas, maxTextW);
    doc.text(legLines, textStartX, leftY);
    leftY += (legLines.length - 1) * 3.1;
  }

  // Kanan header: Badge Jenis Dokumen & Form Terkendali
  const badgeW = 54;
  const badgeX = pageW - marginX - badgeW;
  doc.setFillColor(accentR, accentG, accentB);
  doc.roundedRect(badgeX, startHeaderY, badgeW, 17, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(skema.kodeNomor, badgeX + badgeW / 2, startHeaderY + 5.8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  const namaShort = doc.splitTextToSize(skema.nama.toUpperCase(), badgeW - 4).slice(0, 2);
  doc.text(namaShort, badgeX + badgeW / 2, startHeaderY + 10.2, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text(`${dokumen.kodeFormIso} (${dokumen.versiForm}) • Rev.${dokumen.revisiKe}`, badgeX + badgeW / 2, startHeaderY + 15.2, {
    align: 'center'
  });

  y = Math.max(leftY + 4, startHeaderY + 21);
  doc.setDrawColor(accentR, accentG, accentB);
  doc.setLineWidth(0.7);
  doc.line(marginX, y, pageW - marginX, y);
  y += 4.5;

  // Judul Dokumen + Status pill
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(17, 24, 39);
  const judulLines = doc.splitTextToSize(dokumen.judul || skema.nama, contentW - 32);
  doc.text(judulLines, marginX, y + 3);

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(pageW - marginX - 28, y - 0.5, 28, 6, 1.2, 1.2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(accentR, accentG, accentB);
  doc.text(dokumen.status.toUpperCase(), pageW - marginX - 14, y + 3.4, { align: 'center' });

  y += Math.max(7, judulLines.length * 4.5 + 2);

  // --- BLOK METADATA DOKUMEN & PIHAK TERKAIT ---
  const colGap = 5;
  const boxW = (contentW - colGap) / 2;
  const rightX = marginX + boxW + colGap;

  const addrLines = doc.splitTextToSize(dokumen.pihakTerkait.alamat || '-', boxW - 8);
  const boxH = Math.max(29, 19 + addrLines.length * 3.4);

  // Kotak Kiri: Metadata Kontrol Dokumen
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, y, boxW, boxH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.1);
  doc.setTextColor(accentR, accentG, accentB);
  doc.text('DOKUMEN INTERNAL', marginX + 4, y + 4.5);

  const metaRows: [string, string][] = [
    ['No. Dokumen', dokumen.nomorDokumen],
    ['Kategori / Unit', `${katMeta.label} • ${dokumen.departemen}`],
    ['Tgl Dokumen', formatTanggalId(dokumen.tanggalDokumen)],
    ['Prioritas / Ref.', `${dokumen.prioritas}${dokumen.referensiDokumen ? ` • ${dokumen.referensiDokumen}` : ''}`]
  ];
  let my = y + 9.2;
  metaRows.forEach(([k, v]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.3);
    doc.setTextColor(100, 116, 139);
    doc.text(k, marginX + 4, my);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    const valLines = doc.splitTextToSize(v, boxW - 31);
    doc.text(valLines, marginX + 27, my);
    my += Math.max(4.1, valLines.length * 3.4);
  });

  // Kotak Kanan: Pihak Terkait
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightX, y, boxW, boxH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.1);
  doc.setTextColor(accentR, accentG, accentB);
  doc.text(skema.labelPihakTerkait.toUpperCase(), rightX + 4, y + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(17, 24, 39);
  doc.text(
    doc.splitTextToSize(dokumen.pihakTerkait.instansi || dokumen.pihakTerkait.namaPihak || '-', boxW - 8),
    rightX + 4,
    y + 9.2
  );

  let py = y + 13.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(55, 65, 81);
  if (dokumen.pihakTerkait.namaPihak) {
    const picText = [dokumen.pihakTerkait.namaPihak, dokumen.pihakTerkait.jabatan]
      .filter(Boolean)
      .join(' • ');
    doc.text(doc.splitTextToSize(`PIC: ${picText}`, boxW - 8), rightX + 4, py);
    py += 3.8;
  }
  doc.text(addrLines, rightX + 4, py);
  py += addrLines.length * 3.4;
  if (dokumen.pihakTerkait.kontak) {
    doc.setFontSize(7.1);
    doc.setTextColor(100, 116, 139);
    doc.text(`Kontak: ${dokumen.pihakTerkait.kontak}`, rightX + 4, py + 0.5);
  }

  y += boxH + 5;

  // --- SECTION DATA FORM DINAMIS / SPESIFIKASI ---
  const isPoUmum = dokumen.jenisDokumen === 'purchase_order_umum';
  doc.setFillColor(accentR, accentG, accentB);
  doc.rect(marginX, y, contentW, 6.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(255, 255, 255);
  doc.text(
    isPoUmum
      ? `SPESIFIKASI (${skema.nama.toUpperCase()})`
      : `RINCIAN DATA FORMULIR (${skema.nama.toUpperCase()})`,
    marginX + 3,
    y + 4.5
  );
  y += 6.8;

  if (isPoUmum) {
    const groupsPo = ambilDetailHargaPoUmum(dokumen);
    const subtotalPo = hitungSubtotalPoUmum(groupsPo);
    const colNoW = 12;
    const colHargaW = 42;
    const colDetailW = contentW - colNoW - colHargaW;

    const gambarSubheaderPo = (posY: number) => {
      doc.setFillColor(241, 245, 249);
      doc.rect(marginX, posY, contentW, 6.4, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.line(marginX, posY + 6.4, pageW - marginX, posY + 6.4);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(71, 85, 105);
      doc.text('No', marginX + colNoW / 2, posY + 4.3, { align: 'center' });
      doc.text('Detail', marginX + colNoW + 2.5, posY + 4.3);
      doc.text('Harga', pageW - marginX - 2.5, posY + 4.3, { align: 'right' });
      return posY + 6.4;
    };

    y = gambarSubheaderPo(y);

    groupsPo.forEach((group, idx) => {
      const detailLines = doc.splitTextToSize(group.detail.trim() || '-', colDetailW - 5);
      const rowH = Math.max(7.6, detailLines.length * 3.5 + 3.4);
      if (y + rowH > pageH - 22) {
        doc.addPage();
        y = 16;
        y = gambarSubheaderPo(y);
      }
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, contentW, rowH, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(marginX, y + rowH, pageW - marginX, y + rowH);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.setTextColor(75, 85, 99);
      doc.text(String(idx + 1), marginX + colNoW / 2, y + 4.5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(17, 24, 39);
      doc.text(detailLines, marginX + colNoW + 2.5, y + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(17, 24, 39);
      doc.text(formatRpPdf(group.harga || 0), pageW - marginX - 2.5, y + 4.5, { align: 'right' });

      y += rowH;
    });

    if (y + 8 > pageH - 22) {
      doc.addPage();
      y = 16;
    }
    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, y, contentW, 7.6, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.line(marginX, y + 7.6, pageW - marginX, y + 7.6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);
    doc.text('SUBTOTAL', marginX + 3, y + 5.1);
    doc.setTextColor(accentR, accentG, accentB);
    doc.text(formatRpPdf(subtotalPo), pageW - marginX - 2.5, y + 5.1, { align: 'right' });
    y += 7.6;
  } else {
    skema.fields
      .filter(
        (f) =>
          !(
            dokumen.jenisDokumen === 'quotation' &&
            (f.key === 'syaratKetentuan' ||
              f.key === 'catatanTambahan' ||
              f.key === 'pakaiPpn' ||
              f.key === 'persenPpn' ||
              f.key === 'diskonGlobalRp' ||
              f.key === 'biayaLainRp' ||
              f.key === 'labelBiayaLain')
          )
      )
      .forEach((field, idx) => {
        const formatted = formatNilaiFieldDinamis(dokumen.dataDinamis[field.key], field.type);
        const valLines = doc.splitTextToSize(formatted, contentW - 62);
        const rowH = Math.max(6.8, valLines.length * 3.5 + 3);
        if (y + rowH > pageH - 22) {
          doc.addPage();
          y = 16;
        }
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(marginX, y, contentW, rowH, 'F');
        }
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(marginX, y + rowH, pageW - marginX, y + rowH);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.4);
        doc.setTextColor(71, 85, 105);
        doc.text(doc.splitTextToSize(field.label, 54), marginX + 2.5, y + 4.3);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(17, 24, 39);
        doc.text(valLines, marginX + 59, y + 4.3);
        y += rowH;
      });
  }

  y += 5;

  // --- TABEL ITEM ALKES ---
  if (!isPoUmum && (dokumen.items.length > 0 || skema.wajibTraceabilityAlkes)) {
    if (y + 24 > pageH - 22) {
      doc.addPage();
      y = 16;
    }

    const showPrice = skema.tampilkanNilaiFinansial;
    const cols = showPrice
      ? [
          { label: 'No', w: 8, align: 'center' as const },
          { label: 'Nama Alkes / Tipe / Izin Edar (AKL/AKD)', w: 66, align: 'left' as const },
          { label: 'No. Batch & Serial', w: 34, align: 'left' as const },
          { label: 'Exp. Date', w: 20, align: 'center' as const },
          { label: 'Qty', w: 18, align: 'center' as const },
          { label: 'Subtotal', w: 36, align: 'right' as const }
        ]
      : [
          { label: 'No', w: 8, align: 'center' as const },
          { label: 'Nama Alkes / Tipe / Izin Edar (AKL/AKD)', w: 72, align: 'left' as const },
          { label: 'No. Batch & Serial', w: 38, align: 'left' as const },
          { label: 'Exp. Date', w: 22, align: 'center' as const },
          { label: 'Qty', w: 18, align: 'center' as const },
          { label: 'Suhu / Kondisi', w: 24, align: 'left' as const }
        ];

    const gambarHeaderTabel = (posY: number) => {
      doc.setFillColor(accentR, accentG, accentB);
      doc.rect(marginX, posY, contentW, 7.2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(255, 255, 255);
      let cx = marginX;
      cols.forEach((c) => {
        const tx = c.align === 'center' ? cx + c.w / 2 : c.align === 'right' ? cx + c.w - 2 : cx + 2;
        doc.text(c.label, tx, posY + 4.8, { align: c.align });
        cx += c.w;
      });
      return posY + 7.2;
    };

    y = gambarHeaderTabel(y);

    dokumen.items.forEach((item, idx) => {
      const namaLines = doc.splitTextToSize(item.namaProduk || '-', cols[1].w - 4);
      const nieText = [
        item.tipeModel ? `Tipe: ${item.tipeModel}` : '',
        item.nomorIzinEdar ? `NIE: ${item.nomorIzinEdar}` : ''
      ]
        .filter(Boolean)
        .join(' | ');
      const nieLines = nieText ? doc.splitTextToSize(nieText, cols[1].w - 4) : [];
      const batchLines = doc.splitTextToSize(
        [item.nomorBatch || '-', item.nomorSerial ? `SN: ${item.nomorSerial}` : ''].filter(Boolean).join('\n'),
        cols[2].w - 3
      );
      const rowH = Math.max(
        10,
        4 + Math.max(namaLines.length * 3.4 + nieLines.length * 3.0, batchLines.length * 3.3) + 2
      );

      if (y + rowH > pageH - 22) {
        doc.addPage();
        y = 16;
        y = gambarHeaderTabel(y);
      }

      if (idx % 2 === 1) {
        doc.setFillColor(249, 250, 251);
        doc.rect(marginX, y, contentW, rowH, 'F');
      }
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.2);
      doc.line(marginX, y + rowH, pageW - marginX, y + rowH);

      // No
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.setTextColor(75, 85, 99);
      doc.text(String(idx + 1), marginX + cols[0].w / 2, y + 4.8, { align: 'center' });

      // Produk + NIE
      const col1X = marginX + cols[0].w + 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.6);
      doc.setTextColor(17, 24, 39);
      doc.text(namaLines, col1X, y + 4.5);
      if (nieLines.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.6);
        doc.setTextColor(accentR, accentG, accentB);
        doc.text(nieLines, col1X, y + 4.5 + namaLines.length * 3.4);
      }

      // Batch & SN
      const col2X = marginX + cols[0].w + cols[1].w + 2;
      doc.setFont('courier', 'bold');
      doc.setFontSize(7.1);
      doc.setTextColor(30, 41, 59);
      doc.text(batchLines, col2X, y + 4.5);

      // Exp Date
      const col3X = marginX + cols[0].w + cols[1].w + cols[2].w;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.text(item.expiredDate && item.expiredDate !== '-' ? formatTanggalId(item.expiredDate) : '-', col3X + cols[3].w / 2, y + 4.8, {
        align: 'center'
      });

      // Qty
      const col4X = col3X + cols[3].w;
      doc.setFont('helvetica', 'bold');
      doc.text(`${item.qty} ${item.satuan || 'Unit'}`, col4X + cols[4].w / 2, y + 4.8, { align: 'center' });

      // Last col
      const col5X = col4X + cols[4].w;
      if (showPrice) {
        const kotor = (item.qty || 0) * (item.hargaSatuan || 0);
        const sub = Math.round(kotor * (1 - (item.diskonPersen || 0) / 100));
        doc.setFont('helvetica', 'bold');
        doc.text(formatRpPdf(sub), col5X + cols[5].w - 2, y + 4.4, { align: 'right' });
        if ((item.diskonPersen || 0) > 0 || (item.hargaSatuan || 0) > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.2);
          doc.setTextColor(100, 116, 139);
          const metaHarga = [
            `@${formatRpPdf(item.hargaSatuan || 0)}`,
            item.diskonPersen ? `-${item.diskonPersen}%` : ''
          ]
            .filter(Boolean)
            .join(' ');
          doc.text(metaHarga, col5X + cols[5].w - 2, y + 8, { align: 'right' });
        }
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.9);
        const condText = [item.suhuPenyimpanan, item.kondisiFisik].filter(Boolean).join(' • ') || '-';
        doc.text(doc.splitTextToSize(condText, cols[5].w - 3), col5X + 1.5, y + 4.5);
      }

      y += rowH;
    });

    if (dokumen.items.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.6);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'Belum ada item alkes / batch ketertelusuran ditambahkan.',
        pageW / 2,
        y + 6,
        { align: 'center' }
      );
      y += 11;
    }

    if (showPrice && dokumen.items.length > 0) {
      const fin = hitungRingkasanFinansialDokumen(dokumen);
      const isQuotation = dokumen.jenisDokumen === 'quotation';
      if (isQuotation) {
        if (y + 38 > pageH - 22) {
          doc.addPage();
          y = 16;
        }
        y += 3;
        const sumX = marginX + contentW - 76;
        const sumW = 76;
        const addSumRow = (lbl: string, val: string) => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.6);
          doc.setTextColor(71, 85, 105);
          doc.text(lbl, sumX, y + 4);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(17, 24, 39);
          doc.text(val, marginX + contentW - 2, y + 4, { align: 'right' });
          y += 5.4;
        };
        addSumRow('Subtotal (DPP)', formatRpPdf(fin.subtotal));
        if (fin.diskonGlobal > 0) {
          addSumRow('Diskon Global', `- ${formatRpPdf(fin.diskonGlobal)}`);
        }
        if (fin.pakaiPpn) {
          addSumRow(`PPN (${fin.persenPpn}%)`, formatRpPdf(fin.ppn));
        }
        if (fin.biayaLain > 0) {
          addSumRow(fin.labelBiayaLain, formatRpPdf(fin.biayaLain));
        }
        doc.setFillColor(accentR, accentG, accentB);
        doc.roundedRect(sumX - 2, y + 1, sumW + 2, 8.2, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.2);
        doc.setTextColor(255, 255, 255);
        doc.text('TOTAL PENAWARAN', sumX + 1, y + 6.2);
        doc.text(formatRpPdf(fin.total), marginX + contentW - 2, y + 6.2, { align: 'right' });
        y += 12;

        const terms = String(dokumen.dataDinamis.syaratKetentuan || '').trim();
        const extraNote = String(dokumen.dataDinamis.catatanTambahan || '').trim();
        if (terms || extraNote) {
          const termLines = terms ? doc.splitTextToSize(terms, contentW - 6) : [];
          const noteLines = extraNote ? doc.splitTextToSize(`Catatan: ${extraNote}`, contentW - 6) : [];
          const reqH = 8 + termLines.length * 3.4 + (noteLines.length ? noteLines.length * 3.4 + 3 : 0);
          if (y + reqH > pageH - 22) {
            doc.addPage();
            y = 16;
          }
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(marginX, y, contentW, reqH, 1.5, 1.5, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.2);
          doc.setTextColor(accentR, accentG, accentB);
          doc.text('SYARAT & KETENTUAN PENAWARAN', marginX + 3, y + 4.5);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.1);
          doc.setTextColor(55, 65, 81);
          let ty = y + 8.5;
          if (termLines.length) {
            doc.text(termLines, marginX + 3, ty);
            ty += termLines.length * 3.4 + 1.5;
          }
          if (noteLines.length) {
            doc.setFont('helvetica', 'italic');
            doc.text(noteLines, marginX + 3, ty);
          }
          y += reqH + 3;
        }
      } else {
        const total = hitungNilaiTotalItems(dokumen.items);
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, contentW, 7.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(17, 24, 39);
        doc.text('TOTAL NILAI ESTIMASI ITEM', marginX + contentW - 42, y + 5, { align: 'right' });
        doc.setTextColor(accentR, accentG, accentB);
        doc.text(formatRpPdf(total), marginX + contentW - 2, y + 5, { align: 'right' });
        y += 7.5;
      }
    }

    y += 5;
  }

  if (isPoUmum) {
    const metodeTeks = String(dokumen.dataDinamis.metodePembayaran || '').trim() || '-';
    const metodeLines = doc.splitTextToSize(metodeTeks, contentW - 6);
    const metodeBoxH = Math.max(12, 8 + metodeLines.length * 3.5);
    if (y + metodeBoxH > pageH - 22) {
      doc.addPage();
      y = 16;
    }
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, y, contentW, metodeBoxH, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(accentR, accentG, accentB);
    doc.text('METODE PEMBAYARAN', marginX + 3, y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(17, 24, 39);
    doc.text(metodeLines, marginX + 3, y + 8.8);
    y += metodeBoxH + 4;
  }

  // --- BLOK TANDA TANGAN MULTI-LEVEL & QR CODE VERIFIKASI ---
  if (y + 52 > pageH - 16) {
    doc.addPage();
    y = 18;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, y, contentW, 44, 1.8, 1.8, 'FD');

  // QR Code di kanan
  const qrSize = 24;
  const qrX = pageW - marginX - qrSize - 4;
  const qrY = y + 4;
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.4);
  doc.setTextColor(accentR, accentG, accentB);
  doc.text('VERIFIKASI QR CDAKB', qrX + qrSize / 2, qrY + qrSize + 3.5, { align: 'center' });
  doc.setFont('courier', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(51, 65, 85);
  doc.text(dokumen.tandaTanganDigital.sha256Ringkas, qrX + qrSize / 2, qrY + qrSize + 6.8, {
    align: 'center'
  });

  // 3 Kolom tanda tangan berjenjang di kiri QR
  const sigAreaW = contentW - qrSize - 12;
  const sigColW = sigAreaW / 3;
  const langkah1 = dokumen.alurPersetujuan[0];
  const langkah2 = dokumen.alurPersetujuan[dokumen.alurPersetujuan.length - 1];

  const sigColumns = [
    {
      title: '1. Dibuat Oleh (Staff)',
      name: dokumen.dibuatOleh,
      status: 'Diajukan',
      date: formatTanggalId(dokumen.tanggalDokumen),
      hash: dokumen.tandaTanganDigital.kodeVerifikasi
    },
    {
      title: '2. Ditinjau (Reviewed)',
      name: langkah1?.disetujuiOleh || 'Menunggu Peninjauan',
      status: langkah1?.status || 'Menunggu',
      date: langkah1?.waktu ? formatTanggalId(langkah1.waktu) : '-',
      hash: langkah1?.hashTandaTangan || '-'
    },
    {
      title: '3. Disetujui (Approved)',
      name: langkah2?.disetujuiOleh || 'Menunggu Pengesahan',
      status: langkah2?.status || 'Menunggu',
      date: langkah2?.waktu ? formatTanggalId(langkah2.waktu) : '-',
      hash: langkah2?.hashTandaTangan || '-'
    }
  ];

  sigColumns.forEach((col, i) => {
    const sx = marginX + 3.5 + i * sigColW;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.1);
    doc.setTextColor(71, 85, 105);
    doc.text(col.title, sx, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(
      col.status === 'Disetujui' || col.status === 'Diajukan' ? accentR : 148,
      col.status === 'Disetujui' || col.status === 'Diajukan' ? accentG : 163,
      col.status === 'Disetujui' || col.status === 'Diajukan' ? accentB : 184
    );
    doc.text(`[${col.status.toUpperCase()}]`, sx, y + 11.5);

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(`Sig: ${col.hash}`, sx, y + 15.5);

    doc.setDrawColor(148, 163, 184);
    doc.line(sx, y + 29, sx + sigColW - 6, y + 29);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(17, 24, 39);
    doc.text(doc.splitTextToSize(col.name, sigColW - 5).slice(0, 2), sx, y + 33);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(100, 116, 139);
    doc.text(`Tgl: ${col.date}`, sx, y + 40);
  });

  // --- FOOTER SETIAP HALAMAN ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(marginX, pageH - 12, pageW - marginX, pageH - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text(
      `${identitas.namaPerusahaan} • ${dokumen.nomorDokumen} (${dokumen.kodeFormIso} ${dokumen.versiForm}) • ${identitas.kotaTandaTangan}`,
      marginX,
      pageH - 7.5
    );
    doc.text(`Halaman ${i} dari ${totalPages}`, pageW - marginX, pageH - 7.5, { align: 'right' });
  }

  const safeFilename = (dokumen.nomorDokumen || 'Dokumen-Internal')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  doc.save(`${safeFilename}.pdf`);
}
