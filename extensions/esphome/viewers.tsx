import { FlowsViewer } from '@extensions/files/intents'
import { loadEsphomeHelpers } from './utils'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import ESPHomeDiagram from './network/ESPHomeDiagram';
import { Cpu } from '@tamagui/lucide-icons';
import { useEsphomeValidationWarning } from './hooks/useEsphomeValidationWarning';

const DIAGRAM_VISIBLE = true

export default ({ ...props }: any) => {
    const validationWarning = useEsphomeValidationWarning();

    return <FlowsViewer
        {...props}
        saveButtonWarning={validationWarning}
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
                        // Disable folding to avoid multi-line block scalars such as ">-"
                        return yamlStringify(obj, { lineWidth: 0 });
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
                        }, title: "Esphome Helpers", icon: () => <Cpu color="var(--color)" size={"$1"}/>
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