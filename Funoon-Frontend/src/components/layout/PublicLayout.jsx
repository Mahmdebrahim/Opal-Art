import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import FloatingActions from '../Ui/FloatingActions'

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Navbar />
      <main className="grow">
        <Outlet />
      </main>
      <Footer />
      <FloatingActions />   
    </div>
  )
}