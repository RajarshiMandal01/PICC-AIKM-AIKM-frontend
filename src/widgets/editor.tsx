import { Editor  as AceBuildEditor} from "ace-builds";
import { useEffect, useState } from "react";
import AceEditor from "react-ace";

export interface EditorProps {
    // Define any props you want to pass to the Editor component
    placeholder?: string;
    mode?: string;
    theme?: string;
    name?: string;
    onLoad?: (editor: AceBuildEditor) => void;
    onChange?: (newValue: string) => void;
    fontSize?: number;
    lineHeight?: number;
    showPrintMargin?: boolean;
    showGutter?: boolean;
    highlightActiveLine?: boolean;
    value?: any; // string | Record<string, any>;
    readonly?: boolean;
    setOptions?: {
        enableBasicAutocompletion?: boolean;
        enableLiveAutocompletion?: boolean;
        enableSnippets?: boolean;
        enableMobileMenu?: boolean;
        showLineNumbers?: boolean;
        tabSize?: number;
    };
    className?: string;
}

function Editor(props: EditorProps) {
    const [valueString, setValueString] = useState('');

    useEffect(() => {
        let val = props.value || '';
        if (props.mode === 'json' && typeof val !== 'string') {
            val = JSON.stringify(val, null, 2);
        }
        setValueString(val);
    }, [props]);
    return (
        <AceEditor
            className={props.className}
            placeholder={props.placeholder}
            mode={props.mode}
            theme={props.theme}
            name={props.name}
            onLoad={props.onLoad}
            onChange={props.onChange}
            fontSize={props.fontSize}
            lineHeight={19}
            showPrintMargin={true}
            showGutter={true}
            highlightActiveLine={true}
            value={valueString}
            readOnly={props.readonly}
            setOptions={{
                enableBasicAutocompletion: false,
                enableLiveAutocompletion: false,
                enableSnippets: false,
                enableMobileMenu: true,
                showLineNumbers: true,
                tabSize: 2,
            }} />
    )
}

export default Editor
