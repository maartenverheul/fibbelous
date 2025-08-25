import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SettingsGeneralPage from "./general";
import SettingsWorkspacesPage from "./workspaces";
import { Cog6ToothIcon, FolderIcon } from "@heroicons/react/24/outline";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const pages = [
  {
    key: "general",
    label: "General",
    icon: Cog6ToothIcon,
    component: <SettingsGeneralPage />,
  },
  {
    key: "workspaces",
    label: "Workspaces",
    icon: FolderIcon,
    component: <SettingsWorkspacesPage />,
  },
];

export default function SettingsDialog({
  open,
  onOpenChange,
  activeTab,
  onTabChange,
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden h-full max-h-[500px] bg-slate-800 text-white border-slate-900">
        <Tabs
          value={activeTab}
          onValueChange={onTabChange}
          defaultValue={pages[0].key}
          className="w-full h-full flex flex-row"
        >
          <TabsList className="bg-slate-900 text-white block flex-col items-start gap-1 rounded-none h-full justify-end">
            {pages.map((page) => {
              const Icon = page.icon;
              return (
                <TabsTrigger
                  key={page.key}
                  className="w-full flex gap-2 items-center text-white/60 justify-start px-3 py-2 h-[40px] transition-colors border-l-4 border-transparent data-[state=active]:bg-slate-700 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400"
                  value={page.key}
                >
                  <Icon className="w-5 h-5" />
                  {page.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {pages.map((page) => (
            <TabsContent key={page.key} value={page.key}>
              {page.component}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
