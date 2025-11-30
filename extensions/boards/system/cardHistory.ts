import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import { getRoot } from 'protonode'

const dbInstances: Map<string, Database.Database> = new Map()

const getDBPath = (boardId: string): string => {
    const root = getRoot()
    return path.join(root, 'data', 'databases', `board_history_${boardId}.db`)
}

const ensureDBDirectory = (dbPath: string): void => {
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}

/**
 * Initialize or get the history database for a board
 */
export const initHistoryDB = (boardId: string): Database.Database => {
    if (dbInstances.has(boardId)) {
        return dbInstances.get(boardId)!
    }

    const dbPath = getDBPath(boardId)
    ensureDBDirectory(dbPath)

    const db = new Database(dbPath, { fileMustExist: false })
    
    // Create the history table if it doesn't exist
    db.exec(`
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id TEXT NOT NULL,
            card_name TEXT NOT NULL,
            value TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_history_card_id ON history(card_id);
        CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at);
    `)

    dbInstances.set(boardId, db)
    return db
}

/**
 * Insert a new history entry for a card
 */
export const insertHistoryEntry = async (
    boardId: string,
    cardId: string,
    cardName: string,
    value: any
): Promise<void> => {
    const db = initHistoryDB(boardId)
    const serializedValue = JSON.stringify(value)
    const timestamp = Date.now()

    const stmt = db.prepare(`
        INSERT INTO history (card_id, card_name, value, created_at)
        VALUES (?, ?, ?, ?)
    `)
    
    stmt.run(cardId, cardName, serializedValue, timestamp)
}

/**
 * Get history entries for a card
 */
export const getCardHistory = async (
    boardId: string,
    cardId: string,
    limit?: number,
    from?: number,
    to?: number
): Promise<Array<{
    id: number
    card_id: string
    card_name: string
    value: any
    created_at: number
}>> => {
    const db = initHistoryDB(boardId)
    
    let sql = `SELECT * FROM history WHERE card_id = ?`
    const params: any[] = [cardId]

    if (from) {
        sql += ` AND created_at >= ?`
        params.push(from)
    }

    if (to) {
        sql += ` AND created_at <= ?`
        params.push(to)
    }

    sql += ` ORDER BY created_at DESC`

    if (limit) {
        sql += ` LIMIT ?`
        params.push(limit)
    }

    const stmt = db.prepare(sql)
    const rows = stmt.all(...params) as any[]

    return rows.map(row => ({
        ...row,
        value: JSON.parse(row.value)
    }))
}

/**
 * Clean up old history entries based on retention days
 */
export const cleanupOldEntries = async (
    boardId: string,
    cardId: string,
    retentionDays: number
): Promise<number> => {
    const db = initHistoryDB(boardId)
    const cutoffTimestamp = Date.now() - (retentionDays * 24 * 60 * 60 * 1000)

    const stmt = db.prepare(`
        DELETE FROM history 
        WHERE card_id = ? AND created_at < ?
    `)
    
    const result = stmt.run(cardId, cutoffTimestamp)
    return result.changes
}

/**
 * Close a specific board's history database
 */
export const closeHistoryDB = (boardId: string): void => {
    const db = dbInstances.get(boardId)
    if (db) {
        db.close()
        dbInstances.delete(boardId)
    }
}

/**
 * Close all history databases
 */
export const closeAllHistoryDBs = (): void => {
    for (const [boardId, db] of dbInstances) {
        db.close()
    }
    dbInstances.clear()
}

