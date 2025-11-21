import { requireAdmin, getServiceToken, getRoot } from 'protonode'
const pdfParse = require('pdf-parse');
import { addAction } from "@extensions/actions/coreContext/addAction";
import { addCard } from "@extensions/cards/coreContext/addCard";
import fs from 'fs/promises';
import fspath from 'path';
const { PDFDocument } = require('pdf-lib');


const token = getServiceToken();

export default async (app, context) => {
    app.get('/api/v1/pdf/getTotalPages', requireAdmin(), async (req, res) => {
        const { path } = req.query;
        if (!path) {
            return res.status(400).json({ error: 'File path is required' });
        }

        try {
            const dataBuffer = await fs.readFile(fspath.join(getRoot(), path));
            if (!dataBuffer) {
                return res.status(404).json({ error: 'File not found' });
            }
            // Parse the PDF file to get the number of pages
            const data = await pdfParse(dataBuffer);
            return res.json(data.numpages);
        } catch (error) {
            console.error('Error reading PDF:', error);
            return res.status(500).json({ error: 'Failed to read PDF file' });
        }
    });

    addAction({
        group: 'pdf',
        name: 'getTotalPages',
        url: "/api/v1/pdf/getTotalPages",
        tag: 'operations',
        description: "Get total pages of a PDF file",
        params: {
            path: "pdf file path"
        },
        emitEvent: true,
        token: token
    })


    app.get('/api/v1/pdf/dumpPages', requireAdmin(), async (req, res) => {
        const { path, outputDir } = req.query;

        if (!path || !outputDir) {
            return res.status(400).json({ error: 'File path and output directory are required' });
        }

        try {
            const inputPath = fspath.join(getRoot(), path);
            const outputFolder = fspath.join(getRoot(), outputDir);

            const dataBuffer = await fs.readFile(inputPath);
            const inputPdf = await PDFDocument.load(dataBuffer);
            const numPages = inputPdf.getPageCount();

            // Asegúrate de que el directorio de salida exista
            await fs.mkdir(outputFolder, { recursive: true });

            for (let i = 0; i < numPages; i++) {
                const newPdf = await PDFDocument.create();
                const [copiedPage] = await newPdf.copyPages(inputPdf, [i]);
                newPdf.addPage(copiedPage);

                const pdfBytes = await newPdf.save();
                const outputPath = fspath.join(outputFolder, `page-${i + 1}.pdf`);

                await fs.writeFile(outputPath, pdfBytes);
                console.log(`✅ Guardado: ${outputPath}`);
            }

            return res.json({ message: 'Pages dumped successfully', total: numPages });
        } catch (error) {
            console.error('❌ Error:', error);
            return res.status(500).json({ error: 'Failed to split PDF into pages' });
        }
    });

    addAction({
        group: 'pdf',
        name: 'dumpPages',
        url: "/api/v1/pdf/dumpPages",
        tag: 'operations',
        description: "Dump all pages of a PDF file to a directory",
        params: {
            path: "pdf file path",
            outputDir: "output directory"
        },
        emitEvent: true,
        token: token
    })
}