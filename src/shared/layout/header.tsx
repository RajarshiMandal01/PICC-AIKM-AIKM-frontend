import React from 'react'
import TopBar from './topbar'

interface Props {
    children: React.ReactNode;
    title?: string; // Add title prop here
}

const HeaderLayout: React.FC<Props> = ({ children, title }) => {
    return (
        <div className='nnp-layout-container header-font flex flex-col h-screen overflow-hidden'>
            <TopBar title={title} />
            <div className='nnp-main-container flex-1 pt-0 overflow-hidden'>
                <div className='nnp-main-content h-full'>
                    {children}
                </div>
            </div>
        </div>
    )
}

export default HeaderLayout