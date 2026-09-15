import { ApiModel, ApiWithTopParent } from '@/shared/types/api';
import { ApiReqSpecDto } from '@/shared/types/building-block';
import { useMemo, useCallback } from 'react';
import TreeTable, { TreeNode, Column, FlatNode } from '../widgets/tree-table';
import InfoOutlineIcon from '@mui/icons-material/InfoOutline';
import { Checkbox } from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';

interface ApiSpecTableProps {
    apiList: ApiModel[];
    resp: Record<string, ApiReqSpecDto>;
    apiMapWithTopParent: Record<string, ApiWithTopParent>;
    isDataLoading?: boolean;
    onRespChange?: (data: Record<string, ApiReqSpecDto>) => void;
    onActionClick?: (type: 'info' | 'launch', data: any) => void;
}

function ApiSpecTable({ apiList, resp, apiMapWithTopParent, isDataLoading, onRespChange, onActionClick }: ApiSpecTableProps) {

    const onApiChange = useCallback((data: any, isChecked: boolean, propname: string) => {
        const updatedResp: any = { ...resp };
        const apiId = data.apiId;
        const paramData = data?.[propname];

        if(isChecked) {
            if(!updatedResp[apiId]) {
                updatedResp[apiId] = {
                    apiSpecId: "",
                    apiName: data.apiName,
                    cache: true,
                    apiDto: {
                        apiId: data.apiId,
                        praApiList: []
                    },
                    apiSchema: data.apiSchema,
                    sampleJson: data.sampleJson,
                };
            }
            updatedResp[apiId] = {
                ...updatedResp[apiId],
                [propname]: paramData
            };
        } else {
            updatedResp[apiId] = {
                ...updatedResp[apiId],
                [propname]: null
            };
            if(!updatedResp[apiId].paramc && !updatedResp[apiId].paramq && !updatedResp[apiId].paraml && !updatedResp[apiId].paramu && !updatedResp[apiId].paramd) {
                delete updatedResp[apiId];
            }
        }
        onRespChange?.(updatedResp);
    }, [resp, onRespChange]);

    const createTreeNode = (api: ApiModel): TreeNode => {
        const children: TreeNode[] = api.praApiList?.map(childApi => createTreeNode(childApi)) || [];
        return {
            key: api.apiId,
            data: {
                ...api
            },
            children
        };
    };

    const treeData: TreeNode[] = useMemo(() => {
        return apiList.map(api => createTreeNode(api));
    }, [apiList]);

    const getTitleClass = useCallback((node: FlatNode) => {
        const grayClass = 'text-gray-500';
        if(!Object.values(resp).length) {
            return grayClass;
        }
        const isSelectedTopLevelRow = apiMapWithTopParent[Object.values(resp)[0].apiDto?.apiId]?.topParentId === node.key;
        if(node.level === 0) {
            return `${isSelectedTopLevelRow ? 'font-bold' : grayClass}`;
        } else {
            return '';
        }
    }, [resp, apiMapWithTopParent]);

    const columns: Column[] = useMemo(() => [
        {
            field: 'apiName',
            header: 'API Name',
            expander: true,
            render: (value: string, node: FlatNode) => {
                return <div className={getTitleClass(node)}>{value}</div>;
            }
        },
        {
            field: 'action',
            header: 'Action',
            width: '80px',
            render: (_value: string, node: FlatNode) => {
                return (
                    <div className="flex justify-center w-full">
                        {node.level === 0 ? <InfoOutlineIcon onClick={() => onActionClick('info', node.data)} /> : <LaunchIcon onClick={() => onActionClick('launch', node.data)} />}
                    </div>
                );
            }
        },
        {
            field: 'paramc',
            header: 'C',
            width: '60px',
            className: 'text-center',
            render: (_value: boolean | null, node: FlatNode) => {
                const rowResp = resp[node.key];
                const isChecked = rowResp?.paramc ? true : false;
                return (
                    <Checkbox
                        checked={isChecked}
                        disabled={!node.data.paramc}
                        onChange={(e) => onApiChange(node.data, e.target.checked, 'paramc')}
                    />
                );
            }
        },
        {
            field: 'paramq',
            header: 'Q',
            width: '60px',
            className: 'text-center',
            render: (_value: boolean | null, node: FlatNode) => {
                const rowResp = resp[node.key];
                const isChecked = rowResp?.paramq ? true : false;
                return (
                    <Checkbox
                        checked={isChecked}
                        disabled={!node.data.paramq}
                        onChange={(e) => onApiChange(node.data, e.target.checked, 'paramq')}
                    />
                );
            }
        },
        {
            field: 'paraml',
            header: 'L',
            width: '60px',
            className: 'text-center',
            render: (_value: boolean | null, node: FlatNode) => {
                const rowResp = resp[node.key];
                const isChecked = rowResp?.paraml ? true : false;
                return (
                    <Checkbox
                        checked={isChecked}
                        disabled={!node.data.paraml}
                        onChange={(e) => onApiChange(node.data, e.target.checked, 'paraml')}
                    />
                );
            }
        },
        {
            field: 'paramu',
            header: 'U',
            width: '60px',
            className: 'text-center',
            render: (_value: boolean | null, node: FlatNode) => {
                const rowResp = resp[node.key];
                const isChecked = rowResp?.paramu ? true : false;
                return (
                    <Checkbox
                        checked={isChecked}
                        disabled={!node.data.paramu}
                        onChange={(e) => onApiChange(node.data, e.target.checked, 'paramu')}
                    />
                );
            }
        },
        {
            field: 'paramd',
            header: 'D',
            width: '60px',
            className: 'text-center',
            render: (_value: boolean | null, node: FlatNode) => {
                const rowResp = resp[node.key];
                const isChecked = rowResp?.paramd ? true : false;
                return (
                    <Checkbox
                        checked={isChecked}
                        disabled={!node.data.paramd}
                        onChange={(e) => onApiChange(node.data, e.target.checked, 'paramd')}
                    />
                );
            }
        }
    ], [resp, onApiChange, getTitleClass]);


    return (
        <div className="w-full">
            <TreeTable
                value={treeData}
                columns={columns}
                className="api-spec-table"
                loading={isDataLoading}
            />
        </div>
    );
}

export default ApiSpecTable
