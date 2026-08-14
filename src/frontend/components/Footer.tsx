import React from 'react';

const links = {
  Company: ['About Us', 'Careers', 'Press', 'Blog'],
  Rentals: ['Browse Cars', 'Cities', 'Subscription Plans', 'Corporate Rentals'],
  Support: ['Help Center', 'Contact Us', 'Safety', 'Terms & Conditions'],
  'Host Your Car': ['How It Works', 'Earnings Calculator', 'Fleet Partners', 'Insurance Coverage'],
};

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="text-2xl font-extrabold text-amber-500 mb-2">ZIYAM</div>
            <p className="text-xs text-gray-500 leading-relaxed">
              India's trusted peer-to-peer self-drive car rental platform. Operated by Eightlines.
            </p>
            <div className="flex gap-3 mt-4">
              {['twitter', 'instagram', 'linkedin', 'facebook'].map((s) => (
                <a
                  key={s}
                  href={`https://${s}.com`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full bg-gray-800 hover:bg-amber-500 flex items-center justify-center transition"
                  aria-label={s}
                >
                  <span className="text-xs capitalize text-white">{s[0].toUpperCase()}</span>
                </a>
              ))}
            </div>
          </div>

          {Object.entries(links).map(([heading, items]) => (
            <div key={heading}>
              <h4 className="text-white font-semibold text-sm mb-4">{heading}</h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-xs hover:text-amber-400 transition">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-600">
          <span>© {new Date().getFullYear()} ZiyamSelfDrive (Eightlines). All rights reserved.</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-amber-400 transition">Privacy Policy</a>
            <a href="#" className="hover:text-amber-400 transition">Terms of Use</a>
            <a href="#" className="hover:text-amber-400 transition">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
