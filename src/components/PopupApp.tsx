import React, { Suspense } from "react";

const Notes = React.lazy(() => import("./Notes"));

export default function PopupApp() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Notes />
    </Suspense>
  );
}
