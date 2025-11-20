import { getLogger } from "protobase";
import { getRoot, processAgentResponse } from "protonode";

const logger = getLogger()
const memory = {}

export const getStatesByType = async(options: {
    board: any,
    type: string,
    key: string,
    done?: (result) => {},
    error?: (err) => {}
}) => {
    const { 
        board, 
        type, 
        key, 
        done = async (result) => result, 
        error = () => {} 
    } = options;

    const result = Object.keys(board).filter((k) => board[k] && board[k].type && board[k].type == type).map((k) => board[k][key]);
    return await done(result)
}

export const setVar = (key, value) => {
    memory[key] = value
}

export const getVar = (key, deleteOnRead=false) => {
    if(deleteOnRead) {
        const val = memory[key]
        delete memory[key]
        return val
    }
    
    return memory[key]
}

export const hasVar = (key) => {
    return memory[key] !== undefined
}

export const clearVar = (key) => {
    delete memory[key]
}

export { processAgentResponse }

export default {
    getStatesByType,
    setVar,
    getVar,
    hasVar,
    clearVar,
    processAgentResponse
}