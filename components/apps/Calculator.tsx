
import React, { useState } from 'react';

export const Calculator = () => {
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDot = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clear = () => {
    setDisplay('0');
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const performOperation = (nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (prevValue === null) {
      setPrevValue(inputValue);
    } else if (operator) {
      const currentValue = prevValue || 0;
      const newValue = calculate(currentValue, inputValue, operator);
      setPrevValue(newValue);
      setDisplay(String(newValue));
    }

    setWaitingForOperand(true);
    setOperator(nextOperator);
  };

  const calculate = (left: number, right: number, op: string) => {
    switch (op) {
      case '+': return left + right;
      case '-': return left - right;
      case '×': return left * right;
      case '÷': return left / right;
      default: return right;
    }
  };

  const Button = ({ text, onClick, className = '' }: any) => (
    <button
      onClick={onClick}
      className={`h-12 rounded-lg text-lg font-medium transition-all active:scale-95 ${className}`}
    >
      {text}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-slate-900/90 p-4 text-white">
      <div className="flex-1 flex items-end justify-end mb-4 bg-black/20 rounded-xl p-4 overflow-hidden">
        <span className="text-4xl font-light tracking-wider">{display}</span>
      </div>
      
      <div className="grid grid-cols-4 gap-3">
        <Button text="C" onClick={clear} className="bg-red-500/20 text-red-300 hover:bg-red-500/30" />
        <Button text="±" onClick={() => setDisplay(String(parseFloat(display) * -1))} className="bg-white/10 hover:bg-white/20" />
        <Button text="%" onClick={() => setDisplay(String(parseFloat(display) / 100))} className="bg-white/10 hover:bg-white/20" />
        <Button text="÷" onClick={() => performOperation('÷')} className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30" />

        <Button text="7" onClick={() => inputDigit('7')} className="bg-white/5 hover:bg-white/10" />
        <Button text="8" onClick={() => inputDigit('8')} className="bg-white/5 hover:bg-white/10" />
        <Button text="9" onClick={() => inputDigit('9')} className="bg-white/5 hover:bg-white/10" />
        <Button text="×" onClick={() => performOperation('×')} className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30" />

        <Button text="4" onClick={() => inputDigit('4')} className="bg-white/5 hover:bg-white/10" />
        <Button text="5" onClick={() => inputDigit('5')} className="bg-white/5 hover:bg-white/10" />
        <Button text="6" onClick={() => inputDigit('6')} className="bg-white/5 hover:bg-white/10" />
        <Button text="-" onClick={() => performOperation('-')} className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30" />

        <Button text="1" onClick={() => inputDigit('1')} className="bg-white/5 hover:bg-white/10" />
        <Button text="2" onClick={() => inputDigit('2')} className="bg-white/5 hover:bg-white/10" />
        <Button text="3" onClick={() => inputDigit('3')} className="bg-white/5 hover:bg-white/10" />
        <Button text="+" onClick={() => performOperation('+')} className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30" />

        <Button text="0" onClick={() => inputDigit('0')} className="col-span-2 bg-white/5 hover:bg-white/10" />
        <Button text="." onClick={inputDot} className="bg-white/5 hover:bg-white/10" />
        <Button text="=" onClick={() => performOperation('=')} className="bg-blue-500 hover:bg-blue-400" />
      </div>
    </div>
  );
};

export default Calculator;
