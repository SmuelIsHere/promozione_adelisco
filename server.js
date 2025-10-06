const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const fs = require('fs'); // Libreria nativa di Node per gestire il file system

const app = express();
const port = 3000;

app.use(express.static('public')); // Per servire file statici (HTML, CSS, JS)

// Configurazione di Nodemailer (USANDO LE CREDENZIALI GMAIL CORRETTE)
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", 
    port: 465,
    secure: true, // true per 465
    auth: {
        user: "adeliscosrls@gmail.com", 
        pass: "cbymgloitbkltufu" // ⚠️ Assicurati che sia la Password Applicazione
    }
});

// Configurazione di Multer
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // Esempio: 10 MB
 });

// Permette le chiamate cross-origin (CORS)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); 
    res.header('Access-Control-Allow-Methods', 'GET,POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// ROTTA API per la richiesta di preventivo
app.post('/api/send-quote', upload.single('logoFile'), async (req, res) => {
    
    // PASSO DI DEBUG: Controlla i dati ricevuti nel terminale
    console.log('Dati di form ricevuti (req.body):', req.body); 
    console.log('File ricevuto (req.file):', req.file);

    // 1. Estrazione dei dati e applicazione del fallback robusto per i campi vuoti
    const uploadedFile = req.file;
    const companyName = req.body.companyName || 'Non fornito';
    const vatNumber = req.body.vatNumber || 'Non fornito';
    const email = req.body.email || 'Non fornito';
    const phone = req.body.phone || 'Non fornito';
    const sdiCode = req.body.sdiCode || 'Non fornito';
    const billingAddress = req.body.billingAddress || 'Non fornito';
    const notes = req.body.notes || 'Nessuna nota aggiuntiva.';
    
    // I dati dei prodotti sono ora una stringa JSON
    const productsJson = req.body.products;
    let selectedProducts = [];
    try {
        selectedProducts = productsJson ? JSON.parse(productsJson) : [];
    } catch (e) {
        console.error('Errore nel parsing dei prodotti:', e);
    }
    
    const subtotal = req.body.subtotal || '0,00 €';
    const logoFileName = uploadedFile ? uploadedFile.originalname : 'Nessun file allegato';

    // 2. Validazione di base dei campi obbligatori
    if (!req.body.companyName || !req.body.vatNumber || !req.body.email || !req.body.sdiCode || !req.body.billingAddress || selectedProducts.length === 0) {
        if (uploadedFile) {
             fs.unlink(uploadedFile.path, err => { /* ignora l'errore di cancellazione */ });
        }
        return res.status(400).json({ success: false, message: 'Richiesta incompleta. Compila tutti i campi obbligatori e seleziona almeno un prodotto.' });
    }

    // ✅ MODIFICA: Generazione della tabella HTML per i prodotti con stili in linea più semplici e robusti (compatibilità email)
    // Utilizzato border="1" sul tavolo e bordi espliciti su ogni cella (td) per massima compatibilità (es. Outlook)
    const productsHtml = selectedProducts.length > 0
        ? `
        <table width="100%" border="1" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-top: 15px; font-size: 14px; border: 1px solid #D1D5DB;">
            <thead>
                <tr style="background-color: #000000; color: #FFFFFF;">
                    <th width="35%" style="padding: 10px; text-align: left; font-weight: bold; border-right: 1px solid #374151; border-bottom: 2px solid #D1D5DB;">Prodotto</th>
                    <th width="20%" style="padding: 10px; text-align: center; font-weight: bold; border-right: 1px solid #374151; border-bottom: 2px solid #D1D5DB;">Quantità</th>
                    <th width="25%" style="padding: 10px; text-align: right; font-weight: bold; border-right: 1px solid #374151; border-bottom: 2px solid #D1D5DB;">Prezzo Unitario</th>
                    <th width="20%" style="padding: 10px; text-align: right; font-weight: bold; border-bottom: 2px solid #D1D5DB;">Subtotale</th>
                </tr>
            </thead>
            <tbody>
                ${selectedProducts.map(p => `
                    <tr>
                        <td style="padding: 10px; text-align: left; color: #374151; vertical-align: top; border-right: 1px solid #D1D5DB; border-bottom: 1px solid #D1D5DB;">${p.name}</td>
                        <td style="padding: 10px; text-align: center; color: #374151; vertical-align: top; border-right: 1px solid #D1D5DB; border-bottom: 1px solid #D1D5DB;">${p.quantity} pezzi</td>
                        <td style="padding: 10px; text-align: right; color: #374151; vertical-align: top; border-right: 1px solid #D1D5DB; border-bottom: 1px solid #D1D5DB;">${p.price}</td>
                        <td style="padding: 10px; text-align: right; color: #000000; font-weight: bold; vertical-align: top; border-bottom: 1px solid #D1D5DB;">${p.totalPrice}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        `
        : '<p style="margin: 0; color: #EF4444; font-weight: bold;">Nessun prodotto selezionato.</p>';

    // 3. Generazione del corpo dell'email (HTML)
    const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #D1D5DB; border-radius: 8px; background-color: #FFFFFF; color: #374151;">
            
            <h1 style="color: #000000; text-align: center; border-bottom: 3px solid #000000; padding-bottom: 10px;">Ordine Promozionale Ricevuto</h1>
            
            <p style="color: #4B5563; margin-top: 20px;">
                Hai ricevuto un nuovo ordine promozionale tramite il modulo di selezione ceramiche.
            </p>

            <h2 style="color: #111827; border-bottom: 2px solid #E5E7EB; padding-bottom: 5px; margin-top: 25px; font-size: 18px;">Dati Aziendali</h2>
            <ul style="list-style-type: none; padding: 0;">
                <li style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #F3F4F6;"><strong>Nome Azienda:</strong> ${companyName}</li>
                <li style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #F3F4F6;"><strong>Partita IVA:</strong> ${vatNumber}</li>
                <li style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #F3F4F6;"><strong>Email Aziendale:</strong> ${email}</li>
                <li style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #F3F4F6;"><strong>Codice SDI:</strong> ${sdiCode}</li>
                <li style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #F3F4F6;"><strong>Indirizzo di Fatturazione:</strong> ${billingAddress}</li>
                <li style="margin-bottom: 8px;"><strong>Telefono:</strong> ${phone}</li>
            </ul>

            <h2 style="color: #111827; border-bottom: 2px solid #E5E7EB; padding-bottom: 5px; margin-top: 25px; font-size: 18px;">Riepilogo Ordine</h2>
            ${productsHtml}

            <div style="text-align: right; border-top: 2px solid #111827; padding-top: 10px; margin-top: 15px;">
                <h3 style="color: #000000; margin: 0; font-size: 18px;">Subtotale Ordine (IVA Escl.): ${subtotal}</h3>
            </div>
            
            <h2 style="color: #111827; border-bottom: 2px solid #E5E7EB; padding-bottom: 5px; margin-top: 25px; font-size: 18px;">Note e Allegati</h2>
            <p style="white-space: pre-wrap; margin: 0 0 10px 0; background-color: #F9FAFB; padding: 10px; border-radius: 5px;"><strong>Note sulla personalizzazione:</strong><br>${notes}</p>
            <p style="margin: 0;"><strong>Logo/File:</strong> ${logoFileName}</p>

            <p style="text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 30px;">
                Questa è una notifica automatica. Si prega di non rispondere a questa email.
            </p>
        </div>
    `;

    // 4. Creazione delle opzioni per l'invio
    const mailOptions = {
        from: '"Ordine Promozionale Ceramiche" <adeliscosrls@gmail.com>',
        to: 'adeliscosrls@gmail.com', 
        subject: `NUOVO Ordine Promozionale - ${companyName || 'Senza Nome Azienda'}` ,
        html: emailBody, 
        attachments: []
    };
    
    if (uploadedFile) {
        mailOptions.attachments.push({
            filename: uploadedFile.originalname,
            path: uploadedFile.path,
            contentType: uploadedFile.mimetype
        });
    }

    // 5. Invio dell'email
    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Richiesta inviata correttamente.' });

    } catch (error) {
        console.error('Errore durante l\'invio dell\'email:', error);
        // Messaggio di errore aggiornato a "Ordine Promozionale"
        res.status(500).json({ success: false, message: 'Errore durante l\'invio dell\'ordine promozionale.', details: error.message });
    } finally {
        // 6. CRUCIALE: Cancella il file temporaneo dopo l'invio
        if (uploadedFile) {
            fs.unlink(uploadedFile.path, err => {
                if (err) console.error('Errore nella cancellazione del file temporaneo:', err);
            });
        }
    }
});

// Avvia il server
app.listen(port, () => {
    console.log(`Server avviato su http://localhost:${port}`);
});