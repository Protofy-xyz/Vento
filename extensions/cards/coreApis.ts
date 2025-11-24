import { CardModel } from "./cardsSchemas";
import { AutoAPI, getRoot } from 'protonode'
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as fspath from 'path';
import { API, getLogger, ProtoMemDB } from "protobase";


const dataDir = (root) => fspath.join(root, "/data/cards/")
if(!fsSync.existsSync(dataDir(getRoot()))) {
    fsSync.mkdirSync(dataDir(getRoot()), { recursive: true });
}

const extensionsDir = (root) => fspath.join(root, "/extensions/")

function flattenCards(obj) {
  const result = [];
  for (const key1 in obj) {
    const level2 = obj[key1];
    if (typeof level2 === "object" && level2 !== null) {
      for (const key2 in level2) {
        const level3 = level2[key2];
        if (typeof level3 === "object" && level3 !== null) {
          for (const key3 in level3) {
            result.push(level3[key3]);
          }
        }
      }
    }
  }
  return result;
}

const getDB = (path, req, session, context) => {
    const db = {
        async *iterator() {
            //old code using ProtoMemDB
            // try {
            //     const cards = await context.state.getStateTree({ chunk: 'cards' });
            //     const flatCards = flattenCards(cards);

            //     for (const card of flatCards) {
            //         yield [card.id, JSON.stringify(card)];
            //     }
            // } catch (error) {
            //     console.log("Error reading cards from state tree: ", error);
            // }

            //new code using dataDir
            const rootDir = dataDir(getRoot());
            const groupDirs = await fs.readdir(rootDir);
            for (const group of groupDirs) {
                const groupPath = fspath.join(rootDir, group);
                const tagDirs = await fs.readdir(groupPath);
                for (const tag of tagDirs) {
                    const tagPath = fspath.join(groupPath, tag);
                    const cardFiles = await fs.readdir(tagPath);
                    for (const cardFile of cardFiles) {
                        if (cardFile.endsWith('.json')) {
                            const cardPath = fspath.join(tagPath, cardFile);
                            const cardContent = await fs.readFile(cardPath, 'utf-8');
                            const card = JSON.parse(cardContent);
                            yield [card.id, JSON.stringify(card)];
                        }
                    }
                }
            }

            //iterate extensionsDir to find extensions with a cards folder, and read cards from there
            const extensionsPath = extensionsDir(getRoot());
            const extensions = await fs.readdir(extensionsPath);
            for (const extension of extensions) {
                const extensionPath = fspath.join(extensionsPath, extension);
                const cardsPath = fspath.join(extensionPath, 'cards');
                if (fsSync.existsSync(cardsPath) && fsSync.lstatSync(cardsPath).isDirectory()) {
                    const cardFiles = await fs.readdir(cardsPath);
                    for (const cardFile of cardFiles) {
                        if (cardFile.endsWith('.json')) {
                            const cardPath = fspath.join(cardsPath, cardFile);
                            const cardContent = await fs.readFile(cardPath, 'utf-8');
                            const card = JSON.parse(cardContent);
                            yield [card.id, JSON.stringify(card)];
                        }
                    }
                }
            }
        },

        async del(key, value) {
            const [group, tag, name] = key.split('.');
            const cardPath = fspath.join(dataDir(getRoot()), group, tag, name + '.json');
            if(fsSync.existsSync(cardPath)) {
                fsSync.unlinkSync(cardPath);
            }
        },

        async put(key, value) {
            const card = JSON.parse(value);
            card.id = card.group + '.' + card.tag + '.' + card.name;
            //create card.group folder inside dataDir if it doesn't exist
            const groupDir = fspath.join(dataDir(getRoot()), card.group);
            if(!fsSync.existsSync(groupDir)) {
                fsSync.mkdirSync(groupDir, { recursive: true });
            }
            //create tag folder inside group folder if it doesn't exist
            const tagDir = fspath.join(groupDir, card.tag);
            if(!fsSync.existsSync(tagDir)) {
                fsSync.mkdirSync(tagDir, { recursive: true });
            }
            const cardPath = fspath.join(tagDir, card.id + '.json');
            if(!fsSync.existsSync(cardPath)) {
                fsSync.writeFileSync(cardPath, JSON.stringify(card, null, 2));
            } else {
                getLogger().debug({}, "Card already exists: " + cardPath);
            }
        },

        async get(key) {
            const [group, tag, name] = key.split('.');
            //read card from filesystem
            const cardPath = fspath.join(dataDir(getRoot()), group, tag, name + '.json');
            if(fsSync.existsSync(cardPath)) {
                const cardContent = await fs.readFile(cardPath, 'utf-8');
                return cardContent;
            } else {
                return null;
            }
        }
    };

    return db;
}

const CardsAutoAPI = AutoAPI({
    modelName: 'cards',
    modelType: CardModel,
    prefix: '/api/core/v1/',
    dbName: 'cards',
    getDB: getDB,
    requiresAdmin: ['*'],
    itemsPerPage: 1000000,
    ephemeralEvents: true
})

export default (app, context) => {
    CardsAutoAPI(app, context)
}
