import React from 'react';

export default function IncognitoControl() {
  const [incognitoAllowed, setIncognitoAllowed] = React.useState<boolean | null>(null);
  const [incognitoUnavailable, setIncognitoUnavailable] = React.useState(false);

  React.useEffect(() => {
    const c = (chrome as any)?.extension;
    if (c && c.isAllowedIncognitoAccess) {
      c.isAllowedIncognitoAccess((allowed: boolean) => {
        setIncognitoAllowed(allowed);
      });
    } else {
      setIncognitoUnavailable(true);
    }
  }, []);

  const openExtensionsPage = () => {
    try {
      if (chrome && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
      } else {
        window.open(`chrome://extensions/?id=${chrome.runtime.id}`, '_blank');
      }
    } catch (e) {
      window.open(`chrome://extensions/?id=${chrome.runtime.id}`, '_blank');
    }
  };

  const requestIncognito = () => {
    const c = (chrome as any)?.extension;
    if (!c || !c.setAllowedIncognitoAccess) {
      setIncognitoUnavailable(true);
      return;
    }
    // Toggle: if currently allowed, disable; otherwise enable.
    const target = incognitoAllowed ? false : true;
    c.setAllowedIncognitoAccess(target, () => {
      if (chrome.runtime.lastError) {
        console.warn('setAllowedIncognitoAccess failed', chrome.runtime.lastError);
        openExtensionsPage();
        return;
      }

      c.isAllowedIncognitoAccess((allowed: boolean) => {
        setIncognitoAllowed(allowed);
        if (allowed) {
          alert('Incognito access enabled');
        } else {
          alert('Incognito access disabled');
        }
      });
    });
  };

  return (
    <div className="pt-6">
      <div className="text-sm font-medium">Incognito access</div>
      <div className="text-xs text-gray-500 mb-2">
        {incognitoAllowed === null ? 'Checking...' : incognitoAllowed ? 'Enabled' : 'Not enabled'}
      </div>
      {incognitoUnavailable ? (
        <div className="flex gap-2 items-center">
          <div className="text-xs text-red-600">Incognito APIs unavailable here.</div>
          <button className="bg-gray-700 text-white px-3 py-1 rounded" onClick={openExtensionsPage}>
            Open Extensions
          </button>
        </div>
      ) : (
        <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={requestIncognito}>
          {incognitoAllowed ? 'Disable in Incognito' : 'Enable in Incognito'}
        </button>
      )}
    </div>
  );
}
