import { useState, isValidElement, cloneElement } from "react";
import EmojiPicker from 'emoji-picker-react';

type Props = {
  onChange?(emoji: string): void;
  children: React.ReactNode
}
export default function PickableEmoji({ children, onChange }: Props) {

  const [open, setOpen] = useState(false);

  return <>
    <EmojiPicker
      className="!absolute z-10 top-1/2 left-0 w-10 h-10 bg-white hidden"
      open={open}
      lazyLoadEmojis
      previewConfig={{
        showPreview: false,
      }}
      onEmojiClick={(emoji) => {
        setOpen(false);
        // onChange?.(emoji.unified);
        onChange?.(emoji.emoji);
      }} />
    {isValidElement(children)
      ? cloneElement(children as React.ReactElement<any>, {
        onClick: (e: any) => {
          (children as any).props?.onClick?.(e);
          setOpen(!open);
        },
      })
      : children}
  </>

}