"use client";
import { useState } from "react";
import Canvas from "./_components/canvas";
import Chat from "./_components/chat";

import style from "./page.module.css";

export default function Home() {
  const [username, setUsername] = useState<string>(
    "guest" + Math.floor(Math.random() * 1000)
  );
  return (
    <div className={style.page}>
      <Canvas username={username} />
      <Chat username={username} onChangeUsername={setUsername} />
    </div>
  );
}
