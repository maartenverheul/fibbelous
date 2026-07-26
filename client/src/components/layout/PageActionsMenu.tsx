import {
  PiArrowSquareOut,
  PiCopy,
  PiStar,
  PiStarFill,
  PiTrash,
} from "react-icons/pi";
import { useTabs, type TabTarget } from "../../context/TabContext";
import { cn } from "../../lib/utils";
import type { WorkspacePage } from "../../lib/page/types";

const menuItemClassName = cn(
  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-stone-800",
  "hover:bg-stone-200/80 dark:text-stone-200 dark:hover:bg-stone-800",
);

const menuIconClassName = "h-4 w-4 shrink-0";

type PageActionsMenuProps = {
  segment: string;
  target: TabTarget;
  page?: WorkspacePage;
  onClose: () => void;
  onDuplicate?: () => void;
  onToggleFavorite?: () => void;
  onTrash?: () => void;
};

export function PageActionsMenu({
  segment,
  target,
  page,
  onClose,
  onDuplicate,
  onToggleFavorite,
  onTrash,
}: PageActionsMenuProps) {
  const { openTabInNew, isTabOpen } = useTabs();
  const canOpenInNewTab = !isTabOpen(segment, target.pageId);
  const isFavorite = Boolean(page?.favorite);

  return (
    <>
      {canOpenInNewTab && (
        <button
          type="button"
          className={menuItemClassName}
          onClick={() => {
            openTabInNew(segment, target);
            onClose();
          }}
        >
          <PiArrowSquareOut className={menuIconClassName} aria-hidden />
          Open in new tab
        </button>
      )}
      {page && (
        <>
          {canOpenInNewTab && (
            <div className="my-1 h-px bg-(--app-border)" role="separator" />
          )}
          <button
            type="button"
            className={menuItemClassName}
            onClick={() => {
              onDuplicate?.();
              onClose();
            }}
          >
            <PiCopy className={menuIconClassName} aria-hidden />
            Duplicate page
          </button>
          <button
            type="button"
            className={menuItemClassName}
            onClick={() => {
              onToggleFavorite?.();
              onClose();
            }}
          >
            {isFavorite ? (
              <PiStarFill className={menuIconClassName} aria-hidden />
            ) : (
              <PiStar className={menuIconClassName} aria-hidden />
            )}
            {isFavorite ? "Remove from favorites" : "Add to favorites"}
          </button>
          <div className="my-1 h-px bg-(--app-border)" role="separator" />
          <button
            type="button"
            className={cn(
              menuItemClassName,
              "text-red-700 dark:text-red-400",
            )}
            onClick={() => {
              onTrash?.();
              onClose();
            }}
          >
            <PiTrash className={menuIconClassName} aria-hidden />
            Move to trash
          </button>
        </>
      )}
    </>
  );
}
