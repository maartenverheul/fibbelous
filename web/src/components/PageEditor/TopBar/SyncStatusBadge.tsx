import { SyncStatus } from "@/types/sync";
import {
  CheckCircledIcon,
  ExclamationTriangleIcon,
  UpdateIcon,
} from "@radix-ui/react-icons";

type Props = {
  status: SyncStatus;
};

export default function SyncStatusBadge({ status }: Props) {
  return (
    <div className="w-[24px] h-[24px]">
      {status == "synced" && (
        <div title="Changes are saved">
          <CheckCircledIcon className="text-green-600 p-1 w-full h-full" />
        </div>
      )}
      {status == "syncing" && (
        <div title="Saving changes..">
          <UpdateIcon className="text-gray-500 p-[5px] w-full h-full animate-spin" />
        </div>
      )}
      {status == "error" && (
        <div title="Changed could not be saved">
          <ExclamationTriangleIcon className="text-white bg-red-500 p-1 w-full h-full" />
        </div>
      )}
    </div>
  );
}
