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

  return (
    <div className="fixed border right-5 bottom-5 w-[300px] h-[300px] overflow-y-scroll rounded-sm shadow-lg hover:shadow-gray-500 p-2">
      {events.map((event, i) => (
        <div key={i} className="flex">
          <span className="font-mono mr-2">
            {event.direction == Direction.IN ? "<-" : "->"}
          </span>
          <span>{event?.params?.path}</span>
        </div>
      ))}
    </div>
  );
}
