import React from 'react';
import LegalPage from '../../components/LegalPage';

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      updated="August 2026"
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
