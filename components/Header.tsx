
import React from 'react';

const Header = () => (
  <header className="bg-white shadow-md p-4 mb-6">
    <div className="container mx-auto flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v11.494m-9-5.494h18" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6.75h16.5M3.75 17.25h16.5" />
      </svg>
      <h1 className="text-2xl font-bold text-slate-800">Library Shift Scheduler AI</h1>
    </div>
  </header>
);

export default Header;
