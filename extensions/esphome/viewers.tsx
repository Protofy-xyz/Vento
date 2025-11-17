import { FlowsViewer } from '@extensions/files/intents'
import { loadEsphomeHelpers } from './utils'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import ESPHomeDiagram from './network/ESPHomeDiagram';

const DIAGRAM_VISIBLE = false

export default ({ ...props }: any) => {

    return <FlowsViewer
        {...props}
        codeviewProps={{
            rulesProps: {
                "title": "ESPHome YAML",
            },
            flowsProps: {
                mode: "json",
                onBeforePrepare: (sourceCode, mode) => {
                    try {
                        const obj = yamlParse(sourceCode);
                        const json = JSON.stringify(obj, null, 2);
                        return json
                    } catch (e) {
                        console.error('Error parsing YAML, using raw source:', e);
                        return sourceCode
                    }
                },
                onBeforeSave: (rawContent, mode) => {
                    try {
                        const obj = JSON.parse(rawContent);
                        return yamlStringify(obj);
                    } catch (e) {
                        console.error('Error converting JSON to YAML, keeping JSON:', e);
                        return rawContent;
                    }
                }
            },
            ...DIAGRAM_VISIBLE ? {
                extraPanels: [
                    {
                        id: "esphome",
                        content: (data) => {
                            return <ESPHomeDiagram yaml={data.code} setCode={data.setCode} />
                        }, title: "Esphome Helpers", icon: () => <div>ESP Home</div>
                    },
                ]
            } : {}
        }}
        monacoProps={{
            onLoad: loadEsphomeHelpers,
            defaultLanguage: "esphome",
        }}
    />
}