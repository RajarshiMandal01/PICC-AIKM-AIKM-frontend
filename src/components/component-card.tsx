import { ComponentModel } from '@/shared/types/building-block'
import { ComponentStatus } from '@/shared/types/component-status'
import { IconButton, Popover } from '@mui/material'
import React from 'react';
import PublicIcon from '@mui/icons-material/Public';
import { ConfigurationService } from '@/services/configuration.service';

export interface ComponentCardProps {
    data: ComponentModel,
    componentName?: string,
    componentStatus: ComponentStatus,
    isActive?: boolean,
    onClick?: (compId: string) => void,
    onComponentStatusChange?: (status: ComponentStatus) => void,
    onDelete?: (reqCompId: string) => void
}

function ComponentCard({ data, componentName, componentStatus, isActive, onClick, onComponentStatusChange, onDelete }: ComponentCardProps) {
    const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
    };

    const handlePublish = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        ConfigurationService.publishComponent({ reqId: componentStatus.reqId, reqCompId: componentStatus.reqCompId }).then((response) => {
            if (response.registerUrl) {
                alert("The deployed URL may take 5 minutes to work. Please check in sometime.");
            } else if (response.executionErrorMsg.includes('error')) {
                alert("Publish failed");
            }
            if(onComponentStatusChange){
                onComponentStatusChange(response);
            }
        });
    }

    const handleClose = () => {
        setAnchorEl(null);
    };


  const open = Boolean(anchorEl);
  return (
      <div className={`p-3 mb-2 hover:!bg-[var(--component-color-tertiary)] cursor-pointer ${isActive ? 'bg-[var(--component-color-tertiary)]' : 'bg-[var(--component-color-secondary)]'}`} onClick={() => onClick?.(data.bbComponent.compId)}>
          <div className='flex'>
              <div className='flex-1'>
                  <h3 className='font-bold text-sm mb-2 body-font'>Component</h3>
                  <div className='text-sm mb-1'>Execution Stage</div>
                  <div className='text-sm mb-1'>Status</div>
                <button
                    className="nnp-btn nnp-btn-primary bg-red-600 px-[28px] py-[14px]"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(data.reqCompId);
                    }}
                >
                    Delete
                </button>
                  {
                      componentStatus?.registerUrl && <div className='text-sm'>Published URL</div>
                  }
                  {
                      componentStatus?.isPublishApi === 'true' && componentStatus?.compExecutionStatus.includes('deploy - success') && !componentStatus?.registerUrl && <div className='text-sm h-[34px] flex items-center'>Action</div>
                  }
              </div>
              <div className='flex-col w-3/4'>
                  <h3 className='font-bold text-sm mb-2 body-font'>{componentName || data.bbComponent.compName || data.bbComponent.bb.bbName}</h3>
                  <div className='text-sm mb-1 flex justify-between'>
                      <div>{componentStatus?.executionStage}</div>
                      <div>{componentStatus?.exeDtTime && new Date(componentStatus.exeDtTime).toLocaleString()}</div>
                  </div>
                  <div className='text-sm mb-1 flex justify-between'>
                      <div className={componentStatus?.compExecutionStatus.includes('Failed') || componentStatus?.compExecutionStatus.includes('Error') ? 'text-red-500' : 'text-green-700'}>{componentStatus?.compExecutionStatus}</div>
                      <div>
                          {componentStatus?.executionErrorMsg && (
                              <>
                                  <button aria-describedby={data.bbComponent.compId} className='text-[var(--text-color-link)]' onClick={handleClick}>
                                      View Message
                                  </button>
                                  <Popover
                                      id={data.bbComponent.compId}
                                      open={open}
                                      anchorEl={anchorEl}
                                      onClose={handleClose}
                                      anchorOrigin={{
                                          vertical: 'bottom',
                                          horizontal: 'left',
                                      }}
                                  >
                                      <div className='p-4 text-red-500'>{componentStatus?.executionErrorMsg}</div>
                                  </Popover>
                              </>
                          )}
                      </div>
                  </div>

                  {
                      componentStatus?.registerUrl && <a className='text-sm text-[var(--text-color-link)] underline' href={componentStatus?.registerUrl} target='_blank' title='Click to open the published url'>{componentStatus?.registerUrl}</a>
                  }
                  {
                      componentStatus?.isPublishApi === 'true' && componentStatus?.compExecutionStatus.includes('deploy - success') && !componentStatus?.registerUrl && <IconButton aria-label="publish" size="small" onClick={handlePublish} title='Click to publish component'>
                          <PublicIcon />
                      </IconButton>
                  }
              </div>
          </div>
      </div>
  )
}

export default ComponentCard
