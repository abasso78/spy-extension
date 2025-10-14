import React, { useEffect, useState } from "react";
import { StorageKey } from "../consts";
import { IActivityLogEntry } from "../interfaces";
import { watch } from "../utils/shared-utils";

export default function Log() {
  const [logEntries, setLogEntries] = useState<IActivityLogEntry[]>([]);

  useEffect(() => {
    watch(StorageKey.LOG, ({ newValue = [] }) => {
      setLogEntries(newValue);
    });
  }, []);

  return (
    <>
      <div>
        <div className="flex items-center justify-between">
          <h1 className="border-b border-gray-500 font-semibold text-gray-700 text-2xl">
            Extension Activity Log
          </h1>
        </div>

        <div className="mt-2">
          <div className="overflow-auto border rounded p-2 bg-white shadow-sm max-h-72">
            <div
              className="grid grid-cols-2 gap-2 text-sm"
              style={{ gridTemplateColumns: "auto 1fr" }}
            >
              {logEntries.map((x) => (
                <React.Fragment key={x.uuid}>
                  <div className="text-xs text-gray-500">[{x.timestamp}]</div>
                  <div className="break-words">{x.message}</div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
