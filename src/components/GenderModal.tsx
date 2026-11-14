import React, { useState } from 'react';
import { Check } from 'lucide-react';

interface Props {
  currentGender?: 'male' | 'female' | '';
  onSelect: (gender: 'male' | 'female') => void;
  onClose?: () => void;
}

export const GenderModal: React.FC<Props> = ({ currentGender, onSelect, onClose }) => {
  const [selected, setSelected] = useState<'male' | 'female' | ''>(currentGender || '');

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#37352f]/30 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-white border border-[#e9e9e7] rounded-lg max-w-sm w-full p-6 shadow-md">
        <h2 className="text-xl font-bold text-[#37352f] mb-6 text-center">
          เลือกเพศผู้พูด
        </h2>

        <div className="space-y-2.5 mb-6">
          {/* Male Option */}
          <button
            type="button"
            onClick={() => setSelected('male')}
            className={`w-full py-2.5 px-3.5 text-sm rounded border text-left transition cursor-pointer flex items-center justify-between ${
              selected === 'male'
                ? 'border-[#37352f] bg-[#f7f6f3] text-[#37352f] font-medium'
                : 'border-[#e9e9e7] hover:bg-[#f7f6f3] text-[#787774]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {/* Male SVG Icon */}
              <svg 
                className="w-4 h-4 stroke-current shrink-0" 
                viewBox="0 0 24 24" 
                fill="none" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="10" cy="14" r="5" />
                <path d="M19 5l-5.4 5.4" />
                <path d="M19 5h-5" />
                <path d="M19 5v5" />
              </svg>
              <span>เพศชาย (Male)</span>
            </div>
            {selected === 'male' && <Check className="w-4 h-4 text-[#37352f]" />}
          </button>

          {/* Female Option */}
          <button
            type="button"
            onClick={() => setSelected('female')}
            className={`w-full py-2.5 px-3.5 text-sm rounded border text-left transition cursor-pointer flex items-center justify-between ${
              selected === 'female'
                ? 'border-[#37352f] bg-[#f7f6f3] text-[#37352f] font-medium'
                : 'border-[#e9e9e7] hover:bg-[#f7f6f3] text-[#787774]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {/* Female SVG Icon */}
              <svg 
                className="w-4 h-4 stroke-current shrink-0" 
                viewBox="0 0 24 24" 
                fill="none" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="12" cy="9" r="5" />
                <path d="M12 14v7" />
                <path d="M9 18h6" />
              </svg>
              <span>เพศหญิง (Female)</span>
            </div>
            {selected === 'female' && <Check className="w-4 h-4 text-[#37352f]" />}
          </button>
        </div>

        <div className="flex items-center justify-end gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-[#787774] hover:bg-[#f7f6f3] rounded transition cursor-pointer"
            >
              ยกเลิก
            </button>
          )}

          <button
            type="button"
            disabled={!selected}
            onClick={handleConfirm}
            className="px-4 py-1.5 text-xs bg-[#37352f] hover:bg-[#201f1d] text-white rounded font-medium transition cursor-pointer disabled:opacity-40"
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
};
