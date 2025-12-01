import { ScrollView, XStack, Spinner } from "tamagui";
import { JSONView } from "../JSONView";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Only load Html and Markdown when actually needed (mode === 'html' or 'markdown')
// This prevents Monaco from being loaded for all cards
const Html = dynamic(() => import("../Html").then(m => m.Html), {
    ssr: false,
    loading: () => <Spinner />
});
const Markdown = dynamic(() => import("../Markdown").then(m => m.Markdown), {
    ssr: false,
    loading: () => <Spinner />
});

type CardValueProps = {
    value: any,
    style?: React.CSSProperties,
    id?: string,
    mode?: 'markdown' | 'html' | undefined,
    readOnly?: boolean,
    JSONViewProps: any,
    maxVisiblePropsInJSONView?: number,
    executeActionOnEdit?: (val: string) => void
}

function countLeaves(obj, { debug = false } = {}, seen = new WeakSet(), _path = '', leaves = []) {
  if (obj === null || typeof obj !== 'object') {
    leaves.push(_path || '(root)');
    return leaves.length;
  }
  if (seen.has(obj)) return leaves.length;
  seen.add(obj);

  for (const k in obj) {
    const val = obj[k];
    const newPath = _path ? _path + '.' + k : k;
    if (val && typeof val === 'object') {
      countLeaves(val, { debug }, seen, newPath, leaves);
    } else {
      leaves.push(newPath);
    }
  }

  if(debug) {
    console.log('Leaves:', leaves);
  }

  return leaves.length;
}


export const CardValue = ({ value, JSONViewProps = {}, maxVisiblePropsInJSONView = 50, style = {}, id = undefined, mode = undefined, readOnly = true, executeActionOnEdit = (val) => { } }: CardValueProps) => {
    let fullHeight = false;
    const [data, setData] = useState(typeof value === 'string' ? value : String(value));
    const [weight, setWeight] = useState(typeof value === 'object' ? countLeaves(value) : 0); //to measure object size and decide if json view is collapsed or not

    useEffect(() => {
        if (["markdown", "html"].includes(mode)) {
            setData(value);
        }
    }, [value, mode]);

    useEffect(() => {
        if(value && typeof value === 'object') {
            const leaves = countLeaves(value);
            console.log('Leaves count for value in CardValue:', leaves);
            setWeight(leaves);
        }
    }, [value]);

    if (mode === 'markdown') {
        return <Markdown mih="160px" width={"100%"} readOnly={readOnly} data={data} setData={(val) => { setData(val); if (executeActionOnEdit) { executeActionOnEdit(val) } }} />
    }

    if (mode === "html") {
        return <Html mih="160px" width={"100%"} readOnly={readOnly}
            data={data}
            setData={(val) => {
                setData(val);
                if (executeActionOnEdit) executeActionOnEdit(val);
            }} />
    }

    //check if value is string, number or boolean
    if (!['string', 'number', 'boolean'].includes(typeof value)) {
        return <ScrollView className="no-drag" mt="20px" mb={"10px"} width="calc(100% - 20px)" f={1} bg="$bgContent" borderRadius="$3">
            <JSONView src={value} collapsed={weight > maxVisiblePropsInJSONView ? 1 : undefined} {...JSONViewProps} />
        </ScrollView>
    }
    value = typeof value === 'string' ? value : String(value)
    if (typeof value === 'string' && value.length > 20 || value.includes("\n")) {
        return <XStack mt="20px" mb="10px" width="calc(100% - 20px)" f={1}><textarea
            className="no-drag"
            style={{
                color: "var(--color9)",
                backgroundColor: "var(--bgContent)",
                flex: 1,
                padding: "5px 10px",
                border: "0.5px solid var(--gray7)",
                borderRadius: "8px",
                boxSizing: "border-box",
                resize: "none" // o "none" si no quieres que pueda cambiar el tamaño
            }}
            value={value}
            readOnly
        /></XStack>
    }
    return <div id={id} style={{
        height: fullHeight ? '100%' : 'auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '30px',
        fontWeight: 'bold',
        marginTop: '15px',
        whiteSpace: 'pre-wrap',
        ...style
    }}>{value}</div>
}