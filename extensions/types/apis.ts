import { addCard } from "@extensions/cards/coreContext/addCard";
import { getServiceToken } from 'protobase';


export default (app, context) => {
    const registerCards = async (context) => {
        const token = await getServiceToken()

        addCard({
            group: "json",
            tag: "json",
            id: "json_parse",
            templateName: "JSON Parse",
            name: "JSON Parse",
            defaults: {
                name: "JSON Parse",
                description: "Parse the JSON object within a string",
                rulesCode: "const output = params.str ?? \"\";\nconst start = output.indexOf(\"{\");\nconst end = output.lastIndexOf(\"}\");\n\nif (start === -1 || end === -1 || start > end) {\n  return null;\n}\nconst candidate = output.substring(start, end + 1);\n\ntry {\n  return JSON.parse(candidate);\n} catch (e) {\n  console.error(\"Error al parsear JSON:\", e.message);\n  return null;\n}",
                params: {
                    str: "str",
                },
                returnType: "object",
                configParams: {
                    str: {
                        visible: true,
                        defaultValue: ""
                    }
                },
                type: "action",
                icon: "braces",
            },
            emitEvent: true,
            token: token
        })
    }

    registerCards(context)
}