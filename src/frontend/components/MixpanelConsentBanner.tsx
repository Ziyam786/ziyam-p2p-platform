'use client';

import Link from 'next/link';

export default function MixpanelConsentBanner({
  onChoice,
}: {
  onChoice: (granted: boolean) => void;
}) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] p-4 pointer-events-none">
      <div className="pointer-events-auto max-w-3xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-lg p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="text-sm text-gray-600 flex-1">
          We use analytics (and session replay) to improve ZiyamSelfDrive. This starts only if you accept.{' '}
          <Link href="/privacy" className="font-semibold text-gray-900 underline underline-offset-2">
            Privacy policy
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onChoice(false)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => onChoice(true)}
            className="btn-gradient text-white px-4 py-2.5 rounded-xl text-sm font-bold"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
