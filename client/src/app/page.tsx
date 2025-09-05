"use client";
import Canvas from "./_components/canvas";
import Chat from "./_components/chat";

import style from './page.module.css';

export default function Home() {
  return (
    <div className={style.page}>
      <Canvas />
      <Chat />
    </div>
  );
}
