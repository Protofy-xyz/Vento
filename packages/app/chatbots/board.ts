import { getAuth } from 'protonode'
import APIContext from "app/bundles/context";
import { Protofy, getLogger, getServiceToken, generateEvent } from "protobase";
import { Application } from 'express';
import path from "path";
import { createChatbot } from "@extensions/chatbots/createChatbot";

const root = path.join(process.cwd(), '..', '..')
const logger = getLogger()

Protofy("type", "chatGPT")

function transformChats(prevChats, prompt: string) {
    const additionalSystemMessage = {
      role: "system",
      content: prompt
    };
    return [additionalSystemMessage, ...prevChats];
  }

export default Protofy("code", async (app:Application, context: typeof APIContext) => {
    createChatbot(app, 'board', async (req, res, chatbot) => {
        const {metadata, ...body} = req.body

        const {session, token} = getAuth(req)
        // const message = "Message received"
        // chatbot.send(message)

        context.state.set({
          group: "chat",
          tag: "messages",
          name: "lastMessage",
          value: body.messages[body.messages.length - 1].content,
          emitEvent: true
        })

        context.state.set({
          group: "chat",
          tag: "messages",
          name: "list",
          value: body.messages.slice(0, body.messages.length - 1), //exclude the last message
          emitEvent: true
        })

        chatbot.end()
    })


})