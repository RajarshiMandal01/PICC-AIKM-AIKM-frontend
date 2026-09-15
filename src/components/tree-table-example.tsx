import React, { useState } from 'react';
import TreeTable, { TreeNode, Column } from '../widgets/tree-table';

const TreeTableExample: React.FC = () => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const sampleData: TreeNode[] = [
    {
      key: '1',
      data: {
        name: 'Documents',
        size: '75kb',
        type: 'Folder'
      },
      children: [
        {
          key: '1-1',
          data: {
            name: 'Work',
            size: '55kb',
            type: 'Folder'
          },
          children: [
            {
              key: '1-1-1',
              data: {
                name: 'Report.pdf',
                size: '25kb',
                type: 'PDF File'
              }
            },
            {
              key: '1-1-2',
              data: {
                name: 'Presentation.pptx',
                size: '30kb',
                type: 'PowerPoint File'
              }
            }
          ]
        },
        {
          key: '1-2',
          data: {
            name: 'Personal',
            size: '20kb',
            type: 'Folder'
          },
          children: [
            {
              key: '1-2-1',
              data: {
                name: 'Photo.jpg',
                size: '20kb',
                type: 'Image File'
              }
            }
          ]
        }
      ]
    },
    {
      key: '2',
      data: {
        name: 'Downloads',
        size: '100kb',
        type: 'Folder'
      },
      children: [
        {
          key: '2-1',
          data: {
            name: 'Software.zip',
            size: '100kb',
            type: 'ZIP File'
          }
        }
      ]
    },
    {
      key: '3',
      data: {
        name: 'README.txt',
        size: '5kb',
        type: 'Text File'
      }
    }
  ];

  const columns: Column[] = [
    {
      field: 'name',
      header: 'Name',
      expander: true,
      width: '300px'
    },
    {
      field: 'size',
      header: 'Size',
      width: '100px'
    },
    {
      field: 'type',
      header: 'Type',
      width: '150px',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded text-xs ${
          value.includes('Folder') ? 'bg-blue-100 text-blue-800' :
          value.includes('PDF') ? 'bg-red-100 text-red-800' :
          value.includes('Image') ? 'bg-green-100 text-green-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      )
    }
  ];

  const handleSelectionChange = (keys: string[]) => {
    setSelectedKeys(keys);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">TreeTable Example</h2>

      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Basic TreeTable</h3>
        <TreeTable
          value={sampleData}
          columns={columns}
          className="mb-6"
        />
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">TreeTable with Selection</h3>
        <div className="mb-2 text-sm text-gray-600">
          Selected: {selectedKeys.join(', ') || 'None'}
        </div>
        <TreeTable
          value={sampleData}
          columns={columns}
          selectionMode="multiple"
          selectionKeys={selectedKeys}
          onSelectionChange={handleSelectionChange}
          className="mb-6"
        />
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">TreeTable with Checkbox Selection</h3>
        <TreeTable
          value={sampleData}
          columns={columns}
          selectionMode="checkbox"
          selectionKeys={selectedKeys}
          onSelectionChange={handleSelectionChange}
          defaultExpandedKeys={{ '1': true }}
        />
      </div>
    </div>
  );
};

export default TreeTableExample;