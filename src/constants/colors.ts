export const ACCENT_COLORS = [
    { name: "Indigo", class: "text-indigo-500", bgClass: "bg-indigo-500", hoverTextClass: "group-hover:text-indigo-400", borderClass: "border-indigo-500", hoverBgClass: "hover:bg-indigo-600" },
    { name: "Blue", class: "text-blue-500", bgClass: "bg-blue-500", hoverTextClass: "group-hover:text-blue-400", borderClass: "border-blue-500", hoverBgClass: "hover:bg-blue-600" },
    { name: "Teal", class: "text-teal-500", bgClass: "bg-teal-500", hoverTextClass: "group-hover:text-teal-400", borderClass: "border-teal-500", hoverBgClass: "hover:bg-teal-600" },
    { name: "Green", class: "text-green-500", bgClass: "bg-green-500", hoverTextClass: "group-hover:text-green-400", borderClass: "border-green-500", hoverBgClass: "hover:bg-green-600" },
    { name: "Orange", class: "text-orange-500", bgClass: "bg-orange-500", hoverTextClass: "group-hover:text-orange-400", borderClass: "border-orange-500", hoverBgClass: "hover:bg-orange-600" },
    { name: "Rose", class: "text-rose-500", bgClass: "bg-rose-500", hoverTextClass: "group-hover:text-rose-400", borderClass: "border-rose-500", hoverBgClass: "hover:bg-rose-600" },
    { name: "Purple", class: "text-purple-500", bgClass: "bg-purple-500", hoverTextClass: "group-hover:text-purple-400", borderClass: "border-purple-500", hoverBgClass: "hover:bg-purple-600" },
    { name: "Zinc", class: "text-zinc-500", bgClass: "bg-zinc-500", hoverTextClass: "group-hover:text-zinc-200", borderClass: "border-zinc-500", hoverBgClass: "hover:bg-zinc-600" }, // Default fallback
];

export type AccentColor = typeof ACCENT_COLORS[number];
