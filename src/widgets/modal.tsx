import React from 'react';
import type { ModalProps } from '../shared/types/modal';

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size =  'small' }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 px-4 overflow-auto">
            <div className={`bg-white w-full shadow-2xl overflow-hidden ${size === 'small' ? 'max-w-3xl' : size === 'medium' ? 'max-w-6xl' : size === 'large' ? 'max-w-[90rem]' : 'max-w-full'}`}>

                {/* Header band */}
                <div className="flex items-center justify-between px-4 py-4 bg-secondary border-b border-gray-200">
                    {title && <div className="text-md font-semibold text-secondary_text">{title}</div>}
                    <button
                        onClick={onClose}
                        className="text-secondary_text hover:text-gray-700 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Modal content */}
                <div className="p-6 text-gray-700">
                    {children}
                </div>

            </div>
        </div>

    );
};

export default Modal;
