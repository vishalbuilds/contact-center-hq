import { useState } from "react"


// temp user details, will create process to get name of user and access
const DEFAULT_USER = {
  name: "Vishal Singh",
  access: "Admin",
}

export default function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header id="app-header" className="bg-rose-900 shadow-md">
      <div id="app-header-inner" className="w-full px-6 h-10 flex items-center justify-between">
        <span id="app-header-brand-title" className="text-xl font-semibold text-white tracking-wide">Contact Center HQ</span>

        <div className="relative">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 bg-rose-800 hover:bg-rose-700 text-white text-sm px-3 py-1 rounded transition-colors"
          >
            <span className="w-6 h-6 rounded-full bg-rose-600 flex items-center justify-center text-xs font-bold">
              {DEFAULT_USER.name.charAt(0)}
            </span>
            <span>User</span>
            <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 mt-1 w-48 bg-white rounded shadow-lg z-20 py-2 text-sm text-gray-700">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="font-semibold text-gray-900">{DEFAULT_USER.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className="inline-block bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-medium">{DEFAULT_USER.access}</span>
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
