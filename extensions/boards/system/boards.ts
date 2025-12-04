import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as fspath from 'path';
import { getRoot } from 'protonode'
import { acquireLock, releaseLock } from './lock';
import { getLogger } from 'protobase';
import { t } from 'tar';

const logger = getLogger()

export const BoardsDir = (root) => fspath.join(root, "/data/boards/")
export const getBoards = async () => {
    try {
        await fs.access(BoardsDir(getRoot()), fs.constants.F_OK)
    } catch (error) {
        console.log("Creating boards folder")
        await fs.mkdir(BoardsDir(getRoot()))
    }
    //list all .json files in the boards folder
    return (await fs.readdir(BoardsDir(getRoot()))).filter(f => {
        const filenameSegments = f.split('.')
        return !fsSync.lstatSync(fspath.join(BoardsDir(getRoot()), f)).isDirectory() && (filenameSegments[filenameSegments.length - 1] === "json")
    }).map(f => {
        return f.split('.json')[0]
    })
}

export const getBoardFilePath = (boardId) => {
    return BoardsDir(getRoot()) + boardId + ".json";
}

export const getBoard = async (boardId) => {
    const filePath = getBoardFilePath(boardId);
    let fileContent = null;

    await acquireLock(filePath);
    try {
        fileContent = await fs.readFile(filePath, 'utf8');
    } catch (error) {
        throw new Error("Error reading board file: " + filePath);
    } finally {
        releaseLock(filePath);
    }

    try {
        fileContent = JSON.parse(fileContent);
        //iterate over cards and add the rulesCode and html properties from the card file
        for (let i = 0; i < fileContent.cards.length; i++) {
            const card = fileContent.cards[i];

            if (!card || card.rulesCode || card.html) { //legacy card, skip
                continue;
            }
            //read the card file from the board folder
            const cardFilePath = BoardsDir(getRoot()) + boardId + '/' + card.name + '.js'
            const cardHTMLFilePath = BoardsDir(getRoot()) + boardId + '/' + card.name + '_view.js'
            if (fsSync.existsSync(cardFilePath)) {
                const cardContent = await fs.readFile(cardFilePath, 'utf8')
                card.rulesCode = cardContent
            } else {
                card.rulesCode = ''
            }
            if (fsSync.existsSync(cardHTMLFilePath)) {
                const cardHTMLContent = await fs.readFile(cardHTMLFilePath, 'utf8')
                card.html = cardHTMLContent
            } else {
                card.html = ''
            }
        }
    } catch (error) {
        logger.error({ error }, "Error parsing board file: " + filePath);
        throw new Error("Error parsing board file: " + filePath);
    }

    return fileContent;
}

export const cleanObsoleteCardFiles = (boardId, newCardNames) => {
    const boardFolder = BoardsDir(getRoot()) + boardId + '/';
    if (!fsSync.existsSync(boardFolder)) return;

    const files = fsSync.readdirSync(boardFolder);

    const validFileNames = new Set();

    for (const name of newCardNames) {
        validFileNames.add(name + '.js');
        validFileNames.add(name + '_view.js');
    }

    for (const file of files) {
        if ((file.endsWith('.js') || file.endsWith('_view.js')) && !validFileNames.has(file)) {
            fsSync.unlinkSync(boardFolder + file);
        }
    }
};

// Templates functions
export const TemplatesDir = (root) => fspath.join(root, "/data/templates/boards/")

export const getTemplates = async () => {
    const templatesDir = TemplatesDir(getRoot());
    try {
        await fs.access(templatesDir, fs.constants.F_OK);
    } catch (error) {
        await fs.mkdir(templatesDir, { recursive: true });
        return [];
    }
    
    const dirs = await fs.readdir(templatesDir);
    return dirs.filter(f => fsSync.lstatSync(fspath.join(templatesDir, f)).isDirectory());
}

export const getTemplateFilePath = (templateId) => {
    return TemplatesDir(getRoot()) + templateId + '/' + templateId + ".json";
}

export const getTemplate = async (templateId) => {
    const filePath = getTemplateFilePath(templateId);
    let fileContent = null;

    await acquireLock(filePath);
    try {
        fileContent = await fs.readFile(filePath, 'utf8');
    } catch (error) {
        throw new Error("Error reading template file: " + filePath);
    } finally {
        releaseLock(filePath);
    }

    try {
        fileContent = JSON.parse(fileContent);
        
        // Check if template has cards directory (new structure)
        const templateCardsDir = TemplatesDir(getRoot()) + templateId + '/' + templateId + '/';
        const hasCardsDir = fsSync.existsSync(templateCardsDir);
        
        if (fileContent.cards && Array.isArray(fileContent.cards)) {
            for (let i = 0; i < fileContent.cards.length; i++) {
                const card = fileContent.cards[i];

                if (!card) continue;
                
                // Skip if card already has rulesCode/html (legacy inline format)
                if (card.rulesCode || card.html) continue;
                
                // Try to read from cards directory (new structure)
                if (hasCardsDir) {
                    const cardFilePath = templateCardsDir + card.name + '.js';
                    const cardHTMLFilePath = templateCardsDir + card.name + '_view.js';
                    
                    if (fsSync.existsSync(cardFilePath)) {
                        const cardContent = await fs.readFile(cardFilePath, 'utf8');
                        card.rulesCode = cardContent;
                    } else {
                        card.rulesCode = '';
                    }
                    
                    if (fsSync.existsSync(cardHTMLFilePath)) {
                        const cardHTMLContent = await fs.readFile(cardHTMLFilePath, 'utf8');
                        card.html = cardHTMLContent;
                    } else {
                        card.html = '';
                    }
                }
            }
        }
    } catch (error) {
        logger.error({ error }, "Error parsing template file: " + filePath);
        throw new Error("Error parsing template file: " + filePath);
    }

    return fileContent;
}

export const saveTemplate = async (templateId, boardData, options?: { description?: string }) => {
    const templatesDir = TemplatesDir(getRoot());
    const templateDir = templatesDir + templateId + '/';
    const templateCardsDir = templateDir + templateId + '/';
    
    // Create directories
    if (!fsSync.existsSync(templatesDir)) {
        fsSync.mkdirSync(templatesDir, { recursive: true });
    }
    if (fsSync.existsSync(templateDir)) {
        fsSync.rmSync(templateDir, { recursive: true, force: true });
    }
    fsSync.mkdirSync(templateDir, { recursive: true });
    fsSync.mkdirSync(templateCardsDir, { recursive: true });
    
    // Prepare board data - remove rulesCode and html from cards, save to files
    const templateData = JSON.parse(JSON.stringify(boardData));
    templateData.name = '{{{name}}}';
    delete templateData.version;
    delete templateData.savedAt;
    
    if (templateData.cards && Array.isArray(templateData.cards)) {
        for (const card of templateData.cards) {
            if (!card) continue;
            
            // Save rulesCode to file
            if (card.rulesCode) {
                const cardFilePath = templateCardsDir + card.name + '.js';
                fsSync.writeFileSync(cardFilePath, card.rulesCode);
                delete card.rulesCode;
            }
            
            // Save html to file  
            if (card.html) {
                const cardHTMLFilePath = templateCardsDir + card.name + '_view.js';
                fsSync.writeFileSync(cardHTMLFilePath, card.html);
                delete card.html;
            }
        }
    }
    
    // Write template JSON (without rulesCode/html in cards)
    const templateFilePath = templateDir + templateId + '.json';
    fsSync.writeFileSync(templateFilePath, JSON.stringify(templateData, null, 4));
    
    // Write README if description provided
    if (options?.description) {
        fsSync.writeFileSync(templateDir + 'README.md', options.description);
    }
    
    return templateData;
}

export const cleanObsoleteTemplateCardFiles = (templateId, newCardNames) => {
    const templateCardsDir = TemplatesDir(getRoot()) + templateId + '/' + templateId + '/';
    if (!fsSync.existsSync(templateCardsDir)) return;

    const files = fsSync.readdirSync(templateCardsDir);

    const validFileNames = new Set();

    for (const name of newCardNames) {
        validFileNames.add(name + '.js');
        validFileNames.add(name + '_view.js');
    }

    for (const file of files) {
        if ((file.endsWith('.js') || file.endsWith('_view.js')) && !validFileNames.has(file)) {
            fsSync.unlinkSync(templateCardsDir + file);
        }
    }
};