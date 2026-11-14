import React, { useState, useRef, useEffect } from 'react';

interface Props {
  onSuccess: () => void;
  onCancel?: () => void;
}

export const AdminPinAuth: React.FC<Props> = ({ onSuccess }) => {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState(false);

  const inputRef0 = useRef<HTMLInputElement>(null);
  const inputRef1 = useRef<HTMLInputElement>(null);
  const inputRef2 = useRef<HTMLInputElement>(null);
  const inputRef3 = useRef<HTMLInputElement>(null);

  const EXPECTED_PIN = import.meta.env.VITE_ADMIN_PIN || '1234';

  useEffect(() => {
    inputRef0.current?.focus();
  }, []);

  const getRef = (index: number) => {
    switch (index) {
      case 0: return inputRef0;
      case 1: return inputRef1;
      case 2: return inputRef2;
      case 3: return inputRef3;
      default: return null;
    }
  };

  const handleChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;

    const newPin = [...pin];
    newPin[index] = val.slice(-1);
    setPin(newPin);
    setError(false);

    if (val && index < 3) {
      getRef(index + 1)?.current?.focus();
    }

    if (newPin.every(d => d !== '')) {
      const entered = newPin.join('');
      if (entered === EXPECTED_PIN.trim()) {
        sessionStorage.setItem('admin_auth_token', 'true');
        onSuccess();
      } else {
        setError(true);
        setTimeout(() => {
          setPin(['', '', '', '']);
          inputRef0.current?.focus();
        }, 400);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      getRef(index - 1)?.current?.focus();
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm border border-[#e9e9e7] rounded-lg p-8 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h1 className="text-2xl font-semibold text-[#37352f] tracking-tight text-center mb-6">
          Admin Access
        </h1>

        <div className="flex justify-center gap-2.5 mb-5">
          {[0, 1, 2, 3].map((idx) => {
            const digit = pin[idx];
            const ref = getRef(idx);
            return (
              <input
                key={idx}
                ref={ref}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={`w-12 h-14 text-center text-xl font-mono border rounded transition outline-none ${
                  error
                    ? 'border-[#eb5757] bg-[#eb5757]/5 text-[#eb5757]'
                    : digit
                    ? 'border-[#37352f] text-[#37352f]'
                    : 'border-[#e9e9e7] focus:border-[#2383e2] text-[#37352f]'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <p className="text-xs text-[#eb5757] text-center mb-2">Incorrect PIN code</p>
        )}
      </div>
    </div>
  );
};
