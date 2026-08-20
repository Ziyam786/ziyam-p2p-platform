import React from 'react';
import LegalPage from '../../components/LegalPage';

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      updated="August 2026"
      detailsAnchor="policy"
      detailsLabel="Full Cookie Policy"
      summary={[
        { icon: '🔑', title: 'Essential', body: 'One httpOnly session cookie keeps you logged in — required, can\'t be disabled.' },
        { icon: '📊', title: 'Analytics', body: 'Mixpanel tracks product usage on the renter/host site — never sold to advertisers.' },
        { icon: '🧹', title: 'Your control', body: 'Clear cookies from your browser anytime; clearing the session cookie just logs you out.' },
      ]}
      contact={{
        body: ['Questions about cookies are covered under our full Privacy Policy — see the Grievance Officer contact there.'],
      }}
      sections={[
        {
          heading: 'Essential Cookies',
          body: ['A single httpOnly session cookie keeps you logged in securely. This cookie is required for the platform to function and cannot be disabled.'],
        },
        {
          heading: 'Analytics Cookies',
          body: ['We use Mixpanel for product analytics and session replay on the renter/host site (page views, clicks, and selected events such as sign-up and booking completed). Mixpanel may set cookies or local storage to distinguish sessions. We do not sell this data to advertisers.'],
        },
        {
          heading: 'Managing Cookies',
          body: ['You can clear cookies from your browser settings at any time. Clearing the session cookie will simply log you out.'],
        },
      ]}
    />
  );
}
