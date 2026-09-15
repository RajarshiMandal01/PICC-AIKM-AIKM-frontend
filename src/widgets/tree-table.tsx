import React, { useState, useMemo } from 'react';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronDownIcon from '@mui/icons-material/ExpandMore';
import { Checkbox, IconButton } from '@mui/material';

export interface TreeNode {
  key: string;
  data: Record<string, any>;
  children?: TreeNode[];
}

export interface Column {
  field: string;
  header: string;
  expander?: boolean;
  width?: string;
  className?: string;
  render?: (value: any, node: TreeNode) => React.ReactNode;
}

export interface TreeTableProps {
  value: TreeNode[];
  columns: Column[];
  onToggle?: (event: { originalEvent: React.MouseEvent; node: TreeNode }) => void;
  onSelectionChange?: (keys: string[]) => void;
  selectionKeys?: string[];
  selectionMode?: 'single' | 'multiple' | 'checkbox';
  className?: string;
  loading?: boolean;
  defaultExpandedKeys?: Record<string, boolean>;
}

export interface FlatNode extends TreeNode {
  level: number;
  parent?: string;
  expanded?: boolean;
}

export function TreeTable({
  value,
  columns,
  onToggle,
  onSelectionChange,
  selectionKeys = [],
  selectionMode,
  className = '',
  loading = false,
  defaultExpandedKeys = {}
}: TreeTableProps) {
  const [internalExpandedKeys, setInternalExpandedKeys] = useState<Record<string, boolean>>(defaultExpandedKeys);
  const [internalSelectionKeys, setInternalSelectionKeys] = useState<string[]>([]);

  const currentSelectionKeys = selectionKeys || internalSelectionKeys;

  const flattenNodes = (nodes: TreeNode[], level = 0, parentKey?: string): FlatNode[] => {
    const result: FlatNode[] = [];

    nodes.forEach(node => {
      const isExpanded = internalExpandedKeys[node.key] || false;
      const flatNode: FlatNode = {
        ...node,
        level,
        parent: parentKey,
        expanded: isExpanded
      };

      result.push(flatNode);

      if (node.children && node.children.length > 0 && isExpanded) {
        result.push(...flattenNodes(node.children, level + 1, node.key));
      }
    });

    return result;
  };

  const flatNodes = useMemo(() => flattenNodes(value), [value, internalExpandedKeys]);

  const handleToggle = (node: FlatNode, event: React.MouseEvent) => {
    event.stopPropagation();

    const newExpandedKeys = { ...internalExpandedKeys };
    if (newExpandedKeys[node.key]) {
      delete newExpandedKeys[node.key];
    } else {
      newExpandedKeys[node.key] = true;
    }

    setInternalExpandedKeys(newExpandedKeys);

    if (onToggle) {
      onToggle({ originalEvent: event, node });
    }
  };

  const handleSelection = (nodeKey: string, _event: React.MouseEvent) => {
    if (!selectionMode) return;

    let newSelection: string[] = [];

    if (selectionMode === 'single') {
      newSelection = currentSelectionKeys.includes(nodeKey) ? [] : [nodeKey];
    } else if (selectionMode === 'multiple' || selectionMode === 'checkbox') {
      if (currentSelectionKeys.includes(nodeKey)) {
        newSelection = currentSelectionKeys.filter(key => key !== nodeKey);
      } else {
        newSelection = [...currentSelectionKeys, nodeKey];
      }
    }

    if (onSelectionChange) {
      onSelectionChange(newSelection);
    } else {
      setInternalSelectionKeys(newSelection);
    }
  };

  const renderCell = (column: Column, node: FlatNode) => {
    const value = node.data[column.field];

    if (column.render) {
      return column.render(value, node);
    }

    return value;
  };

  const renderExpander = (node: FlatNode) => {
    if (!node.children || node.children.length === 0) {
      return <div className="w-4 h-4" />;
    }

    const isExpanded = internalExpandedKeys[node.key];

    return (
      <IconButton
        onClick={(e) => handleToggle(node, e)}
        aria-label={isExpanded ? 'Collapse' : 'Expand'}
      >
        {isExpanded ? (
          <ChevronDownIcon className="w-3 h-3" />
        ) : (
          <ChevronRightIcon className="w-3 h-3" />
        )}
      </IconButton>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`tree-table ${className}`}>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-[var(--grid-header-color)] text-[var(--grid-header-text-color)]">
            {columns.map((column) => (
              <th
                key={column.field}
                className={ `border border-gray-300 p-4 text-left ${column.className || ''}` }
                style={{ width: column.width }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {flatNodes.map((node) => (
            <tr
              key={node.key}
              className={`
                hover:bg-gray-50 cursor-pointer transition-colors
                ${currentSelectionKeys.includes(node.key) ? 'bg-blue-100' : ''}
              `}
              onClick={(e) => handleSelection(node.key, e)}
            >
              {columns.map((column, columnIndex) => (
                <td
                  key={`${node.key}-${column.field}`}
                  className="border border-gray-300 px-4 py-2"
                  style={{
                    paddingLeft: column.expander
                      ? `${16 + (node.level * 20)}px`
                      : '16px'
                  }}
                >
                  <div className="flex items-center gap-2">
                    {column.expander && columnIndex === 0 && renderExpander(node)}
                    {selectionMode === 'checkbox' && columnIndex === 0 && (
                      <Checkbox
                        checked={currentSelectionKeys.includes(node.key)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelection(node.key, e as any);
                        }}
                      />
                    )}
                    {renderCell(column, node)}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {flatNodes.length === 0 && (
        <div className="text-center p-8 text-gray-500">
          No data available
        </div>
      )}
    </div>
  );
}

export default TreeTable;