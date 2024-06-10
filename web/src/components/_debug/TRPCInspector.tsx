import { cn } from "@/lib/utils";
import { createWSClient } from "@trpc/client";
import { useEffect, useState } from "react";

enum Direction {
  IN,
  OUT,
}

type Event = {
  id: number;
  method: "query" | "mutation" | "subscription";
  params: {
    path: string;
  };
  direction: Direction;
};

type Props = {
  client: ReturnType<typeof createWSClient>;
};

export default function TRPCInspector({ client }: Props) {
  const [open, setOpen] = useState(
    localStorage.getItem("TRPCInspector-open") == "true"
  );
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    client.connection!.ws!.onmessage = (ev: any) => {
      console.log("IN", ev.data);

      const data: Event = JSON.parse(ev.data);
      (data.direction = Direction.IN), setEvents([...events, data]);
    };

    (WebSocket.prototype as any).newsend = WebSocket.prototype.send;
    WebSocket.prototype.send = function (commands: string) {
      let data = JSON.parse(commands);
      console.log(data);
      // if (!Array.isArray(data)) data = [data];
      data = data.map((e: Event) => ({
        ...e,
        direction: Direction.OUT,
        id: e.id,
      }));

      console.log(data);

      setEvents([...events, ...data]);
      return (this as any).newsend(commands);
    };
  });

  function toggle() {
    localStorage.setItem("TRPCInspector-open", !open ? "true" : "false");
    setOpen(!open);
  }

  return (
    <div
      onClick={toggle}
      className={cn(
        "fixed border right-5 bottom-5 rounded-sm p-2 cursor-pointer transition-all duration-300",
        {
          "h-[300px] w-[300px] overflow-y-scroll shadow-lg hover:shadow-gray-500":
            open,
          "h-[40px] w-[100px] opacity-25 hover:opacity-100": !open,
        }
      )}
    >
      <p
        className={cn("text-sm text-center", {
          "opacity-0": open,
        })}
      >
        TRPC
      </p>
      <div
        className={cn("text-sm", {
          "opacity-0": !open,
        })}
      >
        {events.map((event, i) => (
          <div key={i} className="flex">
            <span className="font-mono mr-2">
              {event.direction == Direction.IN ? "<-" : "->"}
            </span>
            <span>{event?.params?.path}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
