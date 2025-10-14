import React, { useEffect, useState } from "react";
import { BackgroundMessage } from "../consts";
import { captureGeolocation, sendMessage } from "../utils/page-utils";
import { clear } from "../utils/shared-utils";
import { exportAllData } from "../utils/shared-utils";

export default function Controls() {
  const buttonClasses = `bg-transparent hover:bg-blue-500 text-blue-700 font-semibold hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded`;

  const [links, setLinks] = useState<[string, string][]>([]);
  const [selectedHref, setSelectedHref] = useState<string | null>(null);

  useEffect(() => {
    function updateLinks() {
      const found = [...document.querySelectorAll("h1[id]")].map((el) => [
        el.textContent as string,
        `#${el.getAttribute("id")}`,
      ] as [string, string]);
      setLinks(found);
      // If nothing selected yet, default to the first section (if any)
      if (!selectedHref) {
        const first = found.length > 0 ? found[0][1] : null;
        setSelectedHref(first);
        // apply collapsing after a short tick so DOM settles
        setTimeout(() => collapseAllExcept(first), 0);
      } else {
        // ensure existing selection stays collapsed/expanded
        setTimeout(() => collapseAllExcept(selectedHref), 0);
      }
    }

    // small debounce helper to avoid rapid updates
    let timer: number | undefined;
    const debounce = (fn: () => void, wait = 120) => {
      return () => {
        if (timer !== undefined) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          timer = undefined;
          fn();
        }, wait) as unknown as number;
      };
    };

    updateLinks();

    const observer = new MutationObserver(
      debounce(() => {
        updateLinks();
      })
    );
    observer.observe(document.body, { subtree: true, childList: true });

    return () => {
      observer.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  // Collapse all sections except the given href (e.g. "#screenshots")
  function collapseAllExcept(href: string | null) {
    const headings = [...document.querySelectorAll<HTMLHeadingElement>("h1[id]")];
    headings.forEach((h1) => {
      const parent = h1.closest("div");
      if (!parent) return;
      if (href && `#${h1.getAttribute("id")}` === href) {
        // expand: ensure child nodes are shown
        Array.from(parent.children).forEach((child) => {
          (child as HTMLElement).style.display = "";
        });
      } else {
        // collapse everything except the heading itself
        Array.from(parent.children).forEach((child) => {
          if (child === h1) {
            (child as HTMLElement).style.display = "";
          } else {
            (child as HTMLElement).style.display = "none";
          }
        });
      }
    });
  }

  // handle click on a navigation link
  function onNavClick(e: React.MouseEvent, href: string) {
    e.preventDefault();
    setSelectedHref(href);
    collapseAllExcept(href);
    const target = document.querySelector(href) as HTMLElement | null;
    if (target) {
      // smooth scroll the heading into view
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="sticky top-0 p-8">
      <div className="flex flex-col gap-2">
        <button className={buttonClasses} onClick={() => clear()}>
          CLEAR STORAGE
        </button>
        <button
          className={buttonClasses}
          onClick={async () => {
            const blob = await exportAllData();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `spy-extension-export-${new Date()
              .toISOString()
              .replace(/[:.]/g, "_")}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          }}
        >
          EXPORT DATA
        </button>
        <button
          className={buttonClasses}
          onClick={() => sendMessage(BackgroundMessage.OPEN_STEALTH_TAB)}
        >
          OPEN STEALTH TAB
        </button>
        {/* <button className={buttonClasses} onClick={() => writeLog("Test log")}>
          TEST LOG
        </button> */}
        <button className={buttonClasses} onClick={() => captureGeolocation()}>
          CAPTURE GEOLOCATION
        </button>
        <button
          className={buttonClasses}
          onClick={() => sendMessage(BackgroundMessage.CAPTURE_VISIBLE_TAB)}
        >
          CAPTURE VISIBLE TAB
        </button>
        <button
          className={buttonClasses}
          onClick={() => sendMessage(BackgroundMessage.CAPTURE_COOKIES)}
        >
          CAPTURE COOKIES
        </button>
        <button
          className={buttonClasses}
          onClick={() => sendMessage(BackgroundMessage.CAPTURE_HISTORY)}
        >
          CAPTURE HISTORY
        </button>
      </div>
      <div className="flex flex-col gap-8 py-8">
        {links.map(([text, href]) => (
          <a
            key={href}
            href={href}
            onClick={(e) => onNavClick(e, href)}
            className={`text-md ${
              selectedHref === href ? "text-white bg-blue-600 px-2 py-1 rounded" : "text-blue-500 underline"
            }`}
          >
            {text}
          </a>
        ))}
      </div>
    </div>
  );
}
