import { CardModel } from "./cardsSchemas";
import { AutoAPI, getRoot } from 'protonode'
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as fspath from 'path';
import { API, ProtoMemDB } from "protobase";


const dataDir = (root) => fspath.join(root, "/data/cards/")

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
            try {
                const cards = await context.state.getStateTree({ chunk: 'cards' });
                const flatCards = flattenCards(cards);

                for (const card of flatCards) {
                    yield [card.id, JSON.stringify(card)];
                }
            } catch (error) {
                console.log("Error reading cards from state tree: ", error);
            }

        },

        async del(key, value) {
            const [group, tag, name] = key.split('.');
            ProtoMemDB('cards').remove(group, tag, name)
        },

        async put(key, value) {
            const card = JSON.parse(value);
            card.id = card.group + '.' + card.tag + '.' + card.name;
            ProtoMemDB('cards').set(card.group, card.tag, card.name, card)
        },

        async get(key) {
            const cards = await context.state.getStateTree({ chunk: 'cards' });
            return JSON.stringify(cards.find(card => card.id === key));
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
