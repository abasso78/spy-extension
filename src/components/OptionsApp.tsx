import React, { Suspense } from "react";
import ClipboardLog from "./ClipboardLog";
import Controls from "./Controls";
import Cookies from "./Cookies";
import Geolocation from "./Geolocation";
import KeyLog from "./Keylog";
import Log from "./Log";
import IncognitoControl from "./IncognitoControl";
import SiteList from "./SiteList";
const History = React.lazy(() => import("./History"));
const NavigationLog = React.lazy(() => import("./NavigationLog"));
const RequestBodyLog = React.lazy(() => import("./RequestBodyLog"));
const ScreenshotLog = React.lazy(() => import("./Screenshots"));

export default function OptionsApp() {
  return (
    <div className="grid grid-cols-12">
      <div className="col-span-2">
        <Controls />
      </div>

      <div className="flex flex-col items-stretch gap-24 col-span-6 py-8 overflow-x-scroll">
        <Geolocation />
        <SiteList />
        <ClipboardLog />
        <Suspense fallback={<div>Loading navigation...</div>}>
          <NavigationLog />
        </Suspense>
        <Suspense fallback={<div>Loading requests...</div>}>
          <RequestBodyLog />
        </Suspense>
        <KeyLog />
        <Suspense fallback={<div>Loading screenshots...</div>}>
          <ScreenshotLog />
        </Suspense>
        <Cookies />
        <Suspense fallback={<div>Loading history...</div>}>
          <History />
        </Suspense>
      </div>
      <div className="p-8 col-span-4">
        <div className="flex flex-col gap-4">
          <Log />
          <div className="pt-4 border-t">
            <IncognitoControl />
          </div>
        </div>
      </div>
    </div>
  );
}
