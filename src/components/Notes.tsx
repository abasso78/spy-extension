import React, { useEffect, useState } from "react";
import { INoteEntry } from "src/interfaces";
import { StorageKey } from "../consts";
import { contextData, simplePrepend, watch } from "../utils/shared-utils";

export default function Notes() {
  const [notes, setNotes] = useState<INoteEntry[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    watch(StorageKey.NOTES, ({ newValue = [] }) => {
      setNotes(newValue);
    });
  }, []);

  async function addNote() {
    await simplePrepend<INoteEntry>(StorageKey.NOTES, {
      text: note,
      ...contextData(),
    });
    setNote("");
  }

  return (
    <div className="flex flex-col items-stretch gap-8 w-full p-8">
      <div className="text-2xl">
        Memory Optimizer is active
      </div>
      {notes.map((note) => (
        <div key={note.uuid} className="flex flex-col gap-1">
          <div className="text-base">{note.text}</div>
          <div className="text-xs text-gray-300">{note.timestamp}</div>
        </div>
      ))}
    </div>
  );
}
