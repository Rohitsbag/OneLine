import { useRef, ReactNode, ComponentPropsWithoutRef } from "react";

export const SpotlightCard = ({ 
    children, 
    className = "", 
    ...props 
}: { 
    children: ReactNode, 
    className?: string 
} & ComponentPropsWithoutRef<"div">) => {
    const divRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!divRef.current) return;
        const div = divRef.current;
        const rect = div.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        div.style.setProperty("--mouse-x", `${x}px`);
        div.style.setProperty("--mouse-y", `${y}px`);
    };

    return (
        <div
            ref={divRef}
            onMouseMove={handleMouseMove}
            className={`relative rounded-3xl border border-zinc-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/30 overflow-hidden group/spotlight ${className}`}
            {...props}
        >
            <div
                className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                    background: `radial-gradient(600px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), var(--spotlight-color, rgba(99, 102, 241, 0.05)), transparent 40%)`,
                }}
            />
            <div className="relative h-full">{children}</div>
        </div>
    );
};
