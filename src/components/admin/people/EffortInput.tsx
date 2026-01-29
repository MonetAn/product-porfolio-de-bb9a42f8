import { useState, useEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface EffortInputProps {
  value: number;
  isAuto: boolean;
  onChange: (value: number) => void;
  className?: string;
}

export default function EffortInput({ value, isAuto, onChange, className }: EffortInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  // Show empty string for zero values when editing starts
  const [localValue, setLocalValue] = useState(value === 0 ? '' : value.toString());
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    // Only update local value when not editing
    if (!isEditing) {
      setLocalValue(value === 0 ? '' : value.toString());
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEditing = () => {
    // When starting to edit, if value is 0, show empty field
    setLocalValue(value === 0 ? '' : value.toString());
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    const numValue = parseInt(localValue) || 0;
    const clampedValue = Math.max(0, Math.min(100, numValue));
    if (clampedValue !== value) {
      onChange(clampedValue);
    }
    setLocalValue(clampedValue.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setLocalValue(value.toString());
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn("w-14 h-7 text-center text-xs", className)}
        min={0}
        max={100}
      />
    );
  }

  return (
    <button
      onClick={handleStartEditing}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
        "hover:bg-muted cursor-pointer min-w-[50px] justify-center",
        isAuto 
          ? "text-muted-foreground" 
          : "text-foreground bg-primary/10 border border-primary/20",
        className
      )}
      title={isAuto ? 'Авто (из инициативы)' : 'Изменено вручную'}
    >
      <span>{value}%</span>
      {!isAuto && <Pencil className="h-3 w-3" />}
    </button>
  );
}
