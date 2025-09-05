import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SettingsGeneralPage from "./SettingsGeneralPage";
import SettingsWorkspacesPage from "./SettingsWorkspacePage";
import { FolderIcon, SettingsIcon } from "lucide-react";
import { Description, DialogTitle } from "@radix-ui/react-dialog";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const pages = [
  {
    key: "general",
    label: "General",
    icon: SettingsIcon,
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
      <DialogContent className="p-0 max-lg:rounded-[0px] overflow-hidden h-full w-full !max-w-5xl max-h-[800px] bg-gray-800 text-white border-gray-900">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <Description className="sr-only">Settings</Description>
        <Tabs
          value={activeTab}
          onValueChange={onTabChange}
          defaultValue={pages[0].key}
          className="w-full h-full flex flex-row"
        >
          <TabsList className="bg-gray-900 p-2 text-white block flex-col items-start gap-1 rounded-none h-full justify-end">
            {pages.map((page) => {
              const Icon = page.icon;
              return (
                <TabsTrigger
                  key={page.key}
                  className="w-full flex gap-2 items-center text-white/60 justify-start px-3 py-2 h-[40px] transition-colors border-l-4 border-transparent data-[state=active]:bg-gray-700 data-[state=active]:border-blue-500 data-[state=active]:text-blue-400"
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
