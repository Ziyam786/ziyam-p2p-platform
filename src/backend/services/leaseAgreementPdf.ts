import PDFDocument from 'pdfkit';

interface LeaseAgreementData {
  bookingId: string;
  createdAt: Date;
  hostName: string;
  guestName: string;
  registrationNo: string;
  make: string;
  model: string;
  year: number;
  startTime: Date;
  endTime: Date;
  protectionPlan: string;
  totalAmount: number;
}

/** Renders the same lease agreement shown at /bookings/:id/agreement as a PDF buffer, for Setu eSign upload. */
export function renderLeaseAgreementPdf(data: LeaseAgreementData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).font('Helvetica-Bold').text('LEASE AGREEMENT FOR CAR SHARING', { align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor('#888').text(`Agreement ID: LA-${data.bookingId.slice(0, 8).toUpperCase()}`, { align: 'center' });
    doc.moveDown(1.5).fillColor('#000');

    doc.fontSize(11).font('Helvetica').text(
      `This Vehicle Lease Agreement (the "Agreement") is made and effective from ${data.createdAt.toLocaleString()} ` +
      `(the "Effective Date"), as reflected in the booking details on the ZiyamSelfDrive platform ` +
      `("Platform", operated by Eightlines Fleet Private Limited).`
    );
    doc.moveDown();

    doc.font('Helvetica-Bold').text('BETWEEN', { align: 'center' });
    doc.font('Helvetica').text(
      `${data.hostName} (hereinafter referred to as the "Host" or "Lessor"), the registered owner of — or duly ` +
      `authorized to list — the vehicle bearing registration number ${data.registrationNo} ("the Vehicle").`
    );
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('AND', { align: 'center' });
    doc.font('Helvetica').text(
      `${data.guestName} (hereinafter referred to as the "Guest" or "Lessee"), who has placed a request through ` +
      `the Platform bearing booking ID ${data.bookingId}.`
    );
    doc.moveDown();

    doc.font('Helvetica-Bold').fontSize(12).text('1. Vehicle & Trip Details');
    doc.font('Helvetica').fontSize(11);
    doc.text(`Vehicle: ${data.make} ${data.model} (${data.year})`);
    doc.text(`Registration No.: ${data.registrationNo}`);
    doc.text(`Rental Period: ${data.startTime.toLocaleString()} → ${data.endTime.toLocaleString()}`);
    doc.text(`Protection Plan: ${data.protectionPlan}`);
    doc.text(`Total Amount: ₹${data.totalAmount.toLocaleString('en-IN')}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').fontSize(12).text('2. Permitted Territory');
    doc.font('Helvetica').fontSize(11).text(
      'The entire territory of India, excluding any travel to connected countries including but not limited to ' +
      'Nepal, Bhutan, Bangladesh, or Pakistan, unless separately agreed in writing with the Host.'
    );
    doc.moveDown();

    doc.font('Helvetica-Bold').fontSize(12).text('3. Obligations');
    doc.font('Helvetica').fontSize(11).text(
      'The Guest agrees to operate the Vehicle in accordance with the Motor Vehicles Act, 1988, return it in the ' +
      'condition received (ordinary wear and tear excepted), and bear responsibility for any traffic violations, ' +
      'tolls, or fines incurred during the rental period. The Host warrants the Vehicle is roadworthy, insured, ' +
      'and free of undisclosed defects at handover.'
    );
    doc.moveDown(2);

    doc.font('Helvetica-Bold').fontSize(12).text('4. Signatures');
    doc.moveDown(3);
    doc.font('Helvetica').fontSize(10);
    doc.text('_______________________', 60, doc.y);
    doc.text('_______________________', 320, doc.y - doc.currentLineHeight());
    doc.text(`Host / Lessor — ${data.hostName}`, 60);
    doc.text(`Guest / Lessee — ${data.guestName}`, 320, doc.y - doc.currentLineHeight());

    doc.end();
  });
}
