
import {
  Activity,
  Building2,
  ClipboardList,
  LayoutDashboard,
  MessageSquareText,
  Server,
  Users,
} from 'lucide-react';

type DashboardSidebarProps = {
  isActive: boolean;
};

const navigation = [
  { href: '#campus', label: 'Campus overview', icon: LayoutDashboard },
  { href: '#assets', label: 'Infrastructure assets', icon: Server },
  { href: '#tenants', label: 'Tenant exposure', icon: Users },
  { href: '#work-orders', label: 'Work orders', icon: ClipboardList },
  { href: '#incidents', label: 'Incident logs', icon: Activity },
  { href: '#telemetry', label: 'Chiller telemetry', icon: Building2 },
  { href: '#ask-domino', label: 'Ask Domino AI', icon: MessageSquareText },
];

export default function DashboardSidebar({
  isActive,
}: DashboardSidebarProps) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-cbre-forest text-white lg:flex">
        <div className="px-7 pb-12 pt-10">
          <a
            href="#top"
            className="inline-flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0d4cb]"
          >
            <span aria-hidden="true" className="flex items-end gap-[3px]">
              <span className="h-4 w-[5px] -rotate-12 rounded-sm bg-[#c7e48c]" />
              <span className="h-6 w-[5px] -rotate-12 rounded-sm bg-[#c7e48c]" />
              <span className="h-8 w-[5px] -rotate-12 rounded-sm bg-[#c7e48c]" />
            </span>
            <span className="text-[26px] font-bold tracking-[-0.06em]">
              domino<span className="text-[#c7e48c]">.</span>
            </span>
          </a>

          <p className="mt-5 text-[10px] uppercase tracking-[0.24em] text-[#a8c3b5]">
            Building Intelligence
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <p className="mb-4 px-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[#9dbbab]">
            Workspace
          </p>

          <nav aria-label="Dashboard sections" className="space-y-1">
            {navigation.map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                className="group flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] font-medium text-[#d4e4dc] transition-[background-color,color,transform] duration-200 ease-out hover:translate-x-0.5 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0d4cb]"
              >
                <Icon
                  size={17}
                  strokeWidth={1.7}
                  aria-hidden="true"
                  className="shrink-0 opacity-80 transition-opacity group-hover:opacity-100"
                />
                <span>{label}</span>
              </a>
            ))}
          </nav>
        </div>

        <div className="border-t border-white/10 px-7 py-7">
          <p className="text-[11px] font-semibold text-[#d3e4c4]">
            Synthetic demonstration
          </p>

          <p className="mt-2 text-[11px] leading-5 text-[#a8c3b5]">
            Research telemetry is historical, not live.
          </p>

          <div className="mt-5 flex items-center gap-2 text-[11px] text-[#c8ddd2]">
            <span
              className={`h-2 w-2 rounded-full ${
                isActive ? 'bg-[#b7d58a]' : 'bg-amber-300'
              }`}
            />
            {isActive ? 'Database connected' : 'Connecting to database'}
          </div>
        </div>
      </aside>

      <div className="flex items-center justify-between border-b border-slate-200/70 bg-cbre-forest px-6 py-4 text-white lg:hidden">
        <a
          href="#top"
          className="text-xl font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          domino<span className="text-[#c7e48c]">.</span>
        </a>

        <span className="text-[10px] uppercase tracking-widest text-[#c0d4cb]">
          Building Intelligence
        </span>
      </div>
    </>
  );
}