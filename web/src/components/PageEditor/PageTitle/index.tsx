import { useEffect, useState } from "react";

type Props = {
  title: string;
  editable?: boolean;
  onChange?(title: string): any;
};

export default function PageTitle({ title, editable, onChange }: Props) {
  const [newTitle, setNewTitle] = useState<string | undefined>();

  useEffect(() => {
    console.log("Title changed", title);
    setNewTitle(undefined);
  }, [title]);

  function startEdit() {
    setNewTitle(title);
  }

  function stopEdit() {
    if (newTitle != title) onChange?.(newTitle!);
  }

  if (editable)
    return (
      <input
        type="text"
        className="text-4xl font-bold mb-[24px] mt-[24px] h-[60px] focus:outline-none pl-2 w-full truncate"
        value={newTitle ?? title}
        disabled={!editable}
        onFocus={() => startEdit()}
        onBlur={() => stopEdit()}
        onChange={(e) => setNewTitle(e.target.value)}
      />
    );
  else
    return (
      <h1 className="text-4xl pb-3 font-bold mb-[22px] mt-[34px] focus:outline-none pl-2 w-full truncate">
        {title}
      </h1>
    );
}
