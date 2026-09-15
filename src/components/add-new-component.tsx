import { BuildingBlock } from '@/shared/types/building-block';
import { useEffect, useRef, useState } from 'react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface AddNewComponentProps {
    data: BuildingBlock[];
    onSelect?: (value: string) => void;
    pastCompIds?: any[]
}
function AddNewComponent({ data, onSelect, pastCompIds }: AddNewComponentProps) {
    const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left w-max" ref={dropdownRef}>
      <div className="flex rounded-md shadow-sm">
        {/* Main Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="nnp-btn nnp-btn-primary px-[36px] py-[18px]"
        >
          ADD NEW COMPONENT <ExpandMoreIcon className='ml-1' />
        </button>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[500px] h-[430px] bg-white border border-gray-200 rounded-md shadow-lg z-50 overflow-y-auto">
          {data.map((group) => (
            group.bb_id !== 'bb_gen' && (
            <div key={group.bb_id} className="px-2 py-1 mb-2">
              <div className="text-gray-500 font-bold text-xs uppercase px-2 py-1">{group.bbName}</div>
                {group.bbComp.map((item) => {
                  const ignorableComps = ['bbcomp_iot_ndeploy', 'bbcomp_api_ndeploy'];
                  const frontendComps = ['bbcomp_ang', 'bbcomp_bshtml', 'bbcomp_react'];
                  const anyFrontendSelected =
                    pastCompIds?.some((id) => frontendComps.includes(id)) ?? false;
                  const shouldDisableForFrontendGroup =
                    anyFrontendSelected && frontendComps.includes(item.compId);
                  const isDisabled =
                    shouldDisableForFrontendGroup ||
                    (pastCompIds?.includes(item.compId) ?? false) ||
                    !(
                      item.compStatus === 'active' &&
                      !ignorableComps.includes(item.compId)
                    );
                  if (item.compStatus === 'active' && !ignorableComps.includes(item.compId)) {
                    return (
                      <button
                        key={item.compId}
                               onClick={() => {
                          if (!isDisabled && onSelect) {
                            onSelect(item.compId);
                            setIsOpen(false);
                          }
                        }}
                        disabled={isDisabled}
                        className={`block w-full text-left px-4 py-2 text-sm rounded-md my-[1px] ${
                          isDisabled
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'hover:bg-gray-100 text-gray-800'
                        }`}
                      >
                        {item.compName}
                      </button>
                    )
                  }
                  return null;
                })}
            </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}

export default AddNewComponent
