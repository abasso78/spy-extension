import React, { useEffect, useState } from "react";
import { StorageKey } from "../consts";
import { simpleGet, simpleSet } from "../utils/shared-utils";

export default function SiteList() {
  const [sites, setSites] = useState<string[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    (async () => {
      const stored = await simpleGet<string[]>(StorageKey.SITES, []);
      setSites(stored || []);
    })();
  }, []);

  async function addSite() {
    const trimmed = input.trim();
    if (!trimmed) return;
    const next = Array.from(new Set([...sites, trimmed]));
    setSites(next);
    await simpleSet<string[]>(StorageKey.SITES, next);
    setInput("");
  }

  async function removeSite(s: string) {
    const next = sites.filter((x) => x !== s);
    setSites(next);
    await simpleSet<string[]>(StorageKey.SITES, next);
  }

  return (
    <div>
      <h1 className="border-b border-gray-500 font-semibold text-gray-700 text-2xl">
        Site Filters
      </h1>
      <div className="py-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. https://example.com/* or *://*.example.com/*"
            className="border p-2 flex-1"
          />
          <button
            className="bg-blue-500 text-white px-4 rounded"
            onClick={addSite}
          >
            Add
          </button>
        </div>
        <ul className="mt-4 list-disc pl-6">
          {sites.map((s) => (
            <li key={s} className="flex justify-between items-center">
              <span className="truncate">{s}</span>
              <button
                className="text-red-500 ml-4"
                onClick={() => removeSite(s)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="text-sm text-gray-600 mt-2">
          If the list is empty, the extension will record requests for all
          sites.
        </div>
      </div>
    </div>
  );
}
