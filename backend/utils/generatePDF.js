const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateOrderReceipt = async (orderData) => {
    return new Promise((resolve, reject) => {
        try {
            // Create a new PDF document
            const doc = new PDFDocument({ margin: 50 });
            
            // Create filename with timestamp
            const filename = `receipt_${orderData.order_id}_${Date.now()}.pdf`;
            const filepath = path.join(__dirname, '../receipts', filename);
            
            // Ensure receipts directory exists
            const receiptsDir = path.dirname(filepath);
            if (!fs.existsSync(receiptsDir)) {
                fs.mkdirSync(receiptsDir, { recursive: true });
            }
            
            // Pipe the PDF to a file
            doc.pipe(fs.createWriteStream(filepath));
            
            // Add company header
            doc.fontSize(20)
               .fillColor('#1abc9c')
               .text('Bit & Board', 50, 50)
               .fontSize(12)
               .fillColor('#333333')
               .text('Microcontroller & Electronics Store', 50, 75)
               .text('Email: info@bitandboard.com', 50, 90)
               .text('Phone: +63 912 345 6789', 50, 105);
            
            // Add horizontal line
            doc.moveTo(50, 130)
               .lineTo(550, 130)
               .strokeColor('#1abc9c')
               .lineWidth(2)
               .stroke();
            
            // Add receipt title
            doc.fontSize(18)
               .fillColor('#333333')
               .text('ORDER RECEIPT', 50, 150);
            
            // Add order information
            const orderDate = new Date(orderData.date_ordered).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            doc.fontSize(12)
               .text(`Order ID: #${orderData.order_id}`, 50, 180)
               .text(`Order Date: ${orderDate}`, 50, 195)
               .text(`Customer: ${orderData.customer_name || 'N/A'}`, 50, 210)
               .text(`Email: ${orderData.customer_email || 'N/A'}`, 50, 225)
               .text(`Status: ${orderData.status.toUpperCase()}`, 50, 240);
            
            // Add items table header
            const tableTop = 280;
            doc.fontSize(12)
               .fillColor('#1abc9c')
               .text('Item', 50, tableTop)
               .text('Description', 150, tableTop)
               .text('Qty', 350, tableTop)
               .text('Price', 400, tableTop)
               .text('Total', 480, tableTop);
            
            // Add line under header
            doc.moveTo(50, tableTop + 15)
               .lineTo(550, tableTop + 15)
               .strokeColor('#cccccc')
               .lineWidth(1)
               .stroke();
            
            // Add items
            let yPosition = tableTop + 25;
            let grandTotal = 0;
            
            if (orderData.items && orderData.items.length > 0) {
                orderData.items.forEach((item, index) => {
                    const itemTotal = parseFloat(item.price) * parseInt(item.quantity);
                    grandTotal += itemTotal;
                    
                    doc.fillColor('#333333')
                       .fontSize(10)
                       .text(item.item_name || `Item ${index + 1}`, 50, yPosition)
                       .text(item.item_description || 'No description', 150, yPosition, { width: 180 })
                       .text(item.quantity.toString(), 350, yPosition)
                       .text(`₱${parseFloat(item.price).toFixed(2)}`, 400, yPosition)
                       .text(`₱${itemTotal.toFixed(2)}`, 480, yPosition);
                    
                    yPosition += 20;
                    
                    // Add new page if needed
                    if (yPosition > 700) {
                        doc.addPage();
                        yPosition = 50;
                    }
                });
            } else {
                doc.fillColor('#666666')
                   .text('No items found', 50, yPosition);
                yPosition += 20;
            }
            
            // Add total line
            yPosition += 10;
            doc.moveTo(350, yPosition)
               .lineTo(550, yPosition)
               .strokeColor('#cccccc')
               .lineWidth(1)
               .stroke();
            
            // Add grand total
            yPosition += 15;
            doc.fontSize(14)
               .fillColor('#1abc9c')
               .text('TOTAL AMOUNT:', 350, yPosition)
               .text(`₱${grandTotal.toFixed(2)}`, 480, yPosition);
            
            // Add footer
            yPosition += 50;
            doc.fontSize(10)
               .fillColor('#666666')
               .text('Thank you for your business!', 50, yPosition)
               .text('For questions about this order, please contact us at info@bitandboard.com', 50, yPosition + 15)
               .text(`Generated on: ${new Date().toLocaleString()}`, 50, yPosition + 30);
            
            // Finalize the PDF
            doc.end();
            
            // Wait for the PDF to be written
            doc.on('end', () => {
                resolve({
                    success: true,
                    filename: filename,
                    filepath: filepath,
                    message: 'PDF receipt generated successfully'
                });
            });
            
            doc.on('error', (error) => {
                reject({
                    success: false,
                    error: error.message,
                    message: 'Failed to generate PDF receipt'
                });
            });
            
        } catch (error) {
            reject({
                success: false,
                error: error.message,
                message: 'Error creating PDF document'
            });
        }
    });
};

const cleanupOldReceipts = () => {
    const receiptsDir = path.join(__dirname, '../receipts');
    
    if (!fs.existsSync(receiptsDir)) {
        return;
    }
    
    const files = fs.readdirSync(receiptsDir);
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    
    files.forEach(file => {
        const filepath = path.join(receiptsDir, file);
        const stats = fs.statSync(filepath);
        
        if (now - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(filepath);
            console.log(`Cleaned up old receipt: ${file}`);
        }
    });
};

module.exports = {
    generateOrderReceipt,
    cleanupOldReceipts
};