import Link from "next/link";

/**
 * Sidebar navigation link. Collapsed renders the icon only, centred, with the
 * label as `title`. Extracted from AppShell so other shells reuse one skin.
 */
export default function NavItem({
  href,
  icon: Icon,
  label,
  active = false,
  collapsed = false,
}: {
  href: string;
  icon: React.ComponentType<{ size?: string | number; className?: string }>;
  label: string;
  active?: boolean;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`flex h-[34px] items-center gap-2.5 rounded-8 px-2.5 text-[13.5px] font-medium transition-colors duration-quick ease-out-quart ${
        collapsed ? "justify-center" : ""
      } ${
        active
          ? "bg-selected text-ink"
          : "text-muted hover:bg-selected hover:text-ink"
      }`}
    >
      <Icon size={17} className={active ? "text-ink" : "text-muted"} />
      {!collapsed && label}
    </Link>
  );
}
