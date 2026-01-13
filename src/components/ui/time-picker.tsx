import { useCallback, useMemo, useState } from 'react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
import { format, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';

// ==============================
// SIMPLE, RELIABLE GRID-BASED TIME PICKER
// ==============================

export function TimePicker({
    value,
    onChange,
    use12HourFormat = true,
    disabled,
    modal,
    hasError,
}: {
    use12HourFormat?: boolean;
    value: Date;
    onChange: (date: Date) => void;
    disabled?: boolean;
    className?: string;
    modal?: boolean;
    hasError?: boolean;
}) {
    const [open, setOpen] = useState(false);

    // Derive current values from the Date object
    const currentHour = useMemo(() => {
        if (use12HourFormat) {
            const h = value.getHours() % 12;
            return h === 0 ? 12 : h;
        }
        return value.getHours();
    }, [value, use12HourFormat]);

    const currentMinute = useMemo(() => value.getMinutes(), [value]);
    const currentPeriod = useMemo(() => (value.getHours() >= 12 ? 'PM' : 'AM'), [value]);

    // Generate hour options (01-12 for 12-hour, 00-23 for 24-hour)
    const hours = useMemo(
        () =>
            Array.from({ length: use12HourFormat ? 12 : 24 }, (_, i) => {
                return use12HourFormat ? i + 1 : i; // 1-12 for 12-hour, 0-23 for 24-hour
            }),
        [use12HourFormat]
    );

    // Generate minute options (0, 5, 10, ..., 55)
    const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), []);

    // Handle hour change
    const handleHourChange = useCallback(
        (newHour: number) => {
            let h24 = newHour;
            if (use12HourFormat) {
                h24 = newHour % 12;
                if (currentPeriod === 'PM') h24 += 12;
            }
            const newDate = setHours(setSeconds(setMilliseconds(value, 0), 0), h24);
            onChange(newDate);
        },
        [value, onChange, use12HourFormat, currentPeriod]
    );

    // Handle minute change
    const handleMinuteChange = useCallback(
        (newMinute: number) => {
            const newDate = setMinutes(setSeconds(setMilliseconds(value, 0), 0), newMinute);
            onChange(newDate);
        },
        [value, onChange]
    );

    // Handle period (AM/PM) change
    const handlePeriodChange = useCallback(
        (newPeriod: 'AM' | 'PM') => {
            const hours24 = value.getHours();
            let newHours24 = hours24 % 12;
            if (newPeriod === 'PM') newHours24 += 12;
            const newDate = setHours(setSeconds(setMilliseconds(value, 0), 0), newHours24);
            onChange(newDate);
        },
        [value, onChange]
    );

    // Display string
    const display = useMemo(() => {
        if (!value || isNaN(value.getTime())) return '--:--';
        return format(value, use12HourFormat ? 'hh:mm a' : 'HH:mm');
    }, [value, use12HourFormat]);

    return (
        <Popover open={open} onOpenChange={setOpen} modal={modal}>
            <PopoverTrigger asChild>
                <button
                    disabled={disabled}
                    className={cn(
                        'flex w-full h-14 px-5 items-center justify-between font-bold border border-zinc-200 dark:border-zinc-800 rounded-2xl text-lg shadow-sm bg-white dark:bg-zinc-900 transition-all active:scale-[0.98] outline-none group',
                        open && 'border-zinc-900 dark:border-zinc-100 ring-2 ring-zinc-900/10 dark:ring-zinc-100/10',
                        disabled && 'opacity-50 cursor-not-allowed',
                        hasError && 'border-red-500'
                    )}
                >
                    <span className="text-zinc-900 dark:text-zinc-100">{display}</span>
                    <Clock
                        className={cn(
                            'ml-2 size-6 text-zinc-400 transition-colors group-hover:text-zinc-900 dark:group-hover:text-zinc-100',
                            open && 'text-zinc-900 dark:text-zinc-100'
                        )}
                    />
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="p-4 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl border-2 w-auto"
                side="top"
                align="center"
                sideOffset={12}
            >
                <div className="flex gap-4">
                    {/* Hours Column */}
                    <div className="flex flex-col gap-2">
                        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center pb-1">
                            Hour
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto no-scrollbar p-1">
                            {hours.map((h) => (
                                <button
                                    key={h}
                                    onClick={() => handleHourChange(h)}
                                    className={cn(
                                        'w-10 h-10 rounded-xl font-bold text-sm transition-all',
                                        currentHour === h
                                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-lg scale-105'
                                            : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                                    )}
                                >
                                    {h.toString().padStart(2, '0')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="w-px bg-zinc-100 dark:bg-zinc-800 my-4" />

                    {/* Minutes Column */}
                    <div className="flex flex-col gap-2">
                        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center pb-1">
                            Min
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto no-scrollbar p-1">
                            {minutes.map((m) => (
                                <button
                                    key={m}
                                    onClick={() => handleMinuteChange(m)}
                                    className={cn(
                                        'w-10 h-10 rounded-xl font-bold text-sm transition-all',
                                        currentMinute === m
                                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-lg scale-105'
                                            : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                                    )}
                                >
                                    {m.toString().padStart(2, '0')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Period (AM/PM) */}
                    {use12HourFormat && (
                        <>
                            <div className="w-px bg-zinc-100 dark:bg-zinc-800 my-4" />
                            <div className="flex flex-col gap-2">
                                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center pb-1">
                                    Period
                                </div>
                                <div className="flex flex-col gap-2 p-1">
                                    {(['AM', 'PM'] as const).map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => handlePeriodChange(p)}
                                            className={cn(
                                                'w-14 h-12 rounded-xl font-bold text-sm transition-all',
                                                currentPeriod === p
                                                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-lg scale-105'
                                                    : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                                            )}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
