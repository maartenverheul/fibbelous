import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";
import { useState } from "react";

function App() {
  const [greetMsg, setGreetMsg] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://v1.tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <div>
      <h1>Hello Worlds</h1>
      <button className="cursor-pointer bg-red-500" onClick={greet}>
        Greet
      </button>
      <p>{greetMsg}</p>
    </div>
  );
}

export default App;
