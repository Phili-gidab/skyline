import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AdminApp from './AdminApp'

export default function AdminRoot() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    </BrowserRouter>
  )
}
